import { calculateDamage } from './damage.ts';
import { spawnMonster, MONSTER_COUNT, type Difficulty } from './monsters.ts';
import type { TurnResult, AgentEvent } from './agent.ts';

export type BattleEvent =
  | { type: 'runStart'; playerHp: number; playerMaxHp: number }
  | {
      type: 'floorStart';
      floor: number;
      chapter: number;
      isBoss: boolean;
      monsterIndex: number;
      monsterName: string;
      monsterArt: string;
      maxHp: number;
    }
  | { type: 'hesitate' }
  | { type: 'turnStart' }
  | { type: 'partialHit'; damage: number; agentEvent: AgentEvent }
  | { type: 'attack'; damage: number; crit: boolean; matchedKeywords: string[] }
  | { type: 'agentEvent'; agentEvent: AgentEvent }
  | { type: 'agentError'; error: string }
  | { type: 'agentSummary'; summary: string }
  | { type: 'hpChanged'; hp: number; maxHp: number }
  | { type: 'monsterAttack'; damage: number }
  | { type: 'playerHpChanged'; hp: number; maxHp: number }
  | { type: 'playerDefeated' }
  | { type: 'floorCleared'; monsterName: string; xpGained: number }
  | { type: 'chapterCleared'; chapter: number }
  | { type: 'sessionReset' }
  | { type: 'sessionNearlyFull'; usedTokens: number; contextWindow: number }
  | ({ type: 'runEnded' } & BattleSummary);

export interface BattleDeps {
  runTurn: (prompt: string, cwd: string, sessionId?: string, onEvent?: (event: AgentEvent) => void) => Promise<TurnResult>;
  readInput: () => Promise<string | null>;
  onBattleEvent: (event: BattleEvent) => void;
  cwd: string;
  difficulty: Difficulty;
  // Read fresh every turn, so switching weapons (models) mid-run applies to
  // the very next attack.
  getDamageMultiplier?: () => number;
  // Resume a story mid-way: chapter N starts at floor (N-1) * MONSTER_COUNT.
  startFloor?: number;
  playerMaxHp?: number;
}

export interface BattleSummary {
  floorsCleared: number;
  floorsEngaged: number;
  xpGained: number;
  defeated: boolean;
  // Absolute floor the next run would start on, and how many chapter bosses
  // that floor is past — what the profile saves as story progress.
  nextFloor: number;
  chaptersCleared: number;
}

const BOSS_HP_MULTIPLIER = 1.5;
const FLOOR_CLEAR_HEAL = 25;
const SESSION_WARN_RATIO = 0.8;

function xpForFloor(floor: number): number {
  return 20 + floor * 5;
}

function counterDamage(monsterMaxHp: number, punished: boolean): number {
  const base = Math.max(3, Math.round(monsterMaxHp * 0.1));
  return punished ? Math.round(base * 1.5) : base;
}

export async function runDungeon(deps: BattleDeps): Promise<BattleSummary> {
  const playerMaxHp = deps.playerMaxHp ?? 100;
  let playerHp = playerMaxHp;
  let floor = deps.startFloor ?? 0;
  let floorsCleared = 0;
  let floorsEngaged = 0;
  let xpGained = 0;
  let defeated = false;
  // Every run starts a fresh Claude session; turns within the run resume it.
  let sessionId: string | undefined;
  let warnedSessionFull = false;

  deps.onBattleEvent({ type: 'runStart', playerHp, playerMaxHp });

  const takeHit = (damage: number) => {
    playerHp = Math.max(0, playerHp - damage);
    deps.onBattleEvent({ type: 'monsterAttack', damage });
    deps.onBattleEvent({ type: 'playerHpChanged', hp: playerHp, maxHp: playerMaxHp });
  };

  while (true) {
    const spawned = spawnMonster(floor, deps.difficulty);
    const monsterIndex = floor % MONSTER_COUNT;
    const isBoss = monsterIndex === MONSTER_COUNT - 1;
    const chapter = Math.floor(floor / MONSTER_COUNT) + 1;
    const maxHp = isBoss ? Math.round(spawned.maxHp * BOSS_HP_MULTIPLIER) : spawned.maxHp;
    let hp = maxHp;
    deps.onBattleEvent({
      type: 'floorStart',
      floor,
      chapter,
      isBoss,
      monsterIndex,
      monsterName: spawned.name,
      monsterArt: spawned.art,
      maxHp,
    });

    let left = false;
    let currentFloorEngaged = false;
    while (hp > 0) {
      const raw = await deps.readInput();
      if (raw === null) {
        left = true;
        break;
      }
      let prompt = raw.trim();
      if (prompt === '/quit' || prompt === '/flee') {
        left = true;
        break;
      }
      if (prompt === '/new' || prompt.startsWith('/new ')) {
        sessionId = undefined;
        warnedSessionFull = false;
        deps.onBattleEvent({ type: 'sessionReset' });
        prompt = prompt.slice('/new'.length).trim();
        if (prompt.length === 0) continue;
      }
      if (prompt.length === 0) {
        deps.onBattleEvent({ type: 'hesitate' });
        takeHit(counterDamage(maxHp, true));
        if (playerHp <= 0) break;
        continue;
      }

      currentFloorEngaged = true;
      const base = calculateDamage(prompt);
      const damage = Math.round(base.damage * (deps.getDamageMultiplier?.() ?? 1));
      const { crit, matchedKeywords } = base;
      deps.onBattleEvent({ type: 'turnStart' });

      // The prompt's total damage (still purely prompt-shape-based, times the
      // weapon multiplier) is spent across the turn as live tool-use events
      // arrive, tapering by 40% of what's left each time, instead of landing
      // as one lump sum at the end. Partial hits land for real immediately,
      // even if the turn later errors; only the leftover "closing" chunk is
      // skipped on error (below), matching the "no bonus on error" rule.
      let remaining = damage;
      const onAgentEvent = (event: AgentEvent) => {
        deps.onBattleEvent({ type: 'agentEvent', agentEvent: event });
        if (remaining > 0) {
          const hit = Math.min(remaining, Math.max(1, Math.round(remaining * 0.4)));
          remaining -= hit;
          hp = Math.max(0, hp - hit);
          deps.onBattleEvent({ type: 'partialHit', damage: hit, agentEvent: event });
          deps.onBattleEvent({ type: 'hpChanged', hp, maxHp });
        }
      };

      let turn: TurnResult;
      try {
        turn = await deps.runTurn(prompt, deps.cwd, sessionId, onAgentEvent);
      } catch (err) {
        turn = { summary: '', filesChanged: [], commandsRun: [], error: err instanceof Error ? err.message : String(err) };
      }
      // Only adopt a session id from a turn that actually succeeded — resuming
      // a session captured from a failed turn (a broken/never-saved session)
      // would make every later turn fail the same way for the rest of the run.
      if (!turn.error && turn.sessionId) sessionId = turn.sessionId;

      if (turn.error) {
        deps.onBattleEvent({ type: 'agentError', error: turn.error });
      } else {
        hp = Math.max(0, hp - remaining);
        deps.onBattleEvent({ type: 'attack', damage: remaining, crit, matchedKeywords });
        if (turn.summary) deps.onBattleEvent({ type: 'agentSummary', summary: turn.summary });
      }
      deps.onBattleEvent({ type: 'hpChanged', hp, maxHp });

      if (
        !warnedSessionFull &&
        turn.contextTokens !== undefined &&
        turn.contextWindow !== undefined &&
        turn.contextTokens >= turn.contextWindow * SESSION_WARN_RATIO
      ) {
        warnedSessionFull = true;
        deps.onBattleEvent({ type: 'sessionNearlyFull', usedTokens: turn.contextTokens, contextWindow: turn.contextWindow });
      }

      if (hp > 0) {
        takeHit(counterDamage(maxHp, Boolean(turn.error)));
        if (playerHp <= 0) break;
      }
    }

    if (currentFloorEngaged) floorsEngaged += 1;
    if (playerHp <= 0) {
      defeated = true;
      deps.onBattleEvent({ type: 'playerDefeated' });
      break;
    }
    if (left) break;

    const gained = xpForFloor(floor);
    xpGained += gained;
    floorsCleared += 1;
    deps.onBattleEvent({ type: 'floorCleared', monsterName: spawned.name, xpGained: gained });
    if (isBoss) deps.onBattleEvent({ type: 'chapterCleared', chapter });
    playerHp = Math.min(playerMaxHp, playerHp + FLOOR_CLEAR_HEAL);
    deps.onBattleEvent({ type: 'playerHpChanged', hp: playerHp, maxHp: playerMaxHp });
    floor += 1;
  }

  const summary: BattleSummary = {
    floorsCleared,
    floorsEngaged,
    xpGained,
    defeated,
    nextFloor: floor,
    chaptersCleared: Math.floor(floor / MONSTER_COUNT),
  };
  deps.onBattleEvent({ type: 'runEnded', ...summary });
  return summary;
}
