import { calculateDamage } from './damage.ts';
import { spawnMonster, type Difficulty } from './monsters.ts';
import type { TurnResult, AgentEvent } from './agent.ts';

export type BattleEvent =
  | { type: 'floorStart'; floor: number; monsterName: string; monsterArt: string; maxHp: number }
  | { type: 'hesitate' }
  | { type: 'turnStart' }
  | { type: 'partialHit'; damage: number; agentEvent: AgentEvent }
  | { type: 'attack'; damage: number; crit: boolean; matchedKeywords: string[] }
  | { type: 'agentEvent'; agentEvent: AgentEvent }
  | { type: 'agentError'; error: string }
  | { type: 'agentSummary'; summary: string }
  | { type: 'hpChanged'; hp: number; maxHp: number }
  | { type: 'floorCleared'; monsterName: string; xpGained: number }
  | { type: 'runEnded'; floorsCleared: number; floorsEngaged: number; xpGained: number };

export interface BattleDeps {
  runTurn: (prompt: string, cwd: string, sessionId?: string, onEvent?: (event: AgentEvent) => void) => Promise<TurnResult>;
  readInput: () => Promise<string | null>;
  onBattleEvent: (event: BattleEvent) => void;
  cwd: string;
  difficulty: Difficulty;
}

export interface BattleSummary {
  floorsCleared: number;
  floorsEngaged: number;
  xpGained: number;
}

function xpForFloor(floor: number): number {
  return 20 + floor * 5;
}

export async function runDungeon(deps: BattleDeps): Promise<BattleSummary> {
  let floor = 0;
  let floorsCleared = 0;
  let floorsEngaged = 0;
  let xpGained = 0;
  let sessionId: string | undefined;

  while (true) {
    const monster = spawnMonster(floor, deps.difficulty);
    let hp = monster.maxHp;
    deps.onBattleEvent({ type: 'floorStart', floor, monsterName: monster.name, monsterArt: monster.art, maxHp: hp });

    let left = false;
    let currentFloorEngaged = false;
    while (hp > 0) {
      const raw = await deps.readInput();
      if (raw === null) {
        left = true;
        break;
      }
      const prompt = raw.trim();
      if (prompt === '/quit' || prompt === '/flee') {
        left = true;
        break;
      }
      if (prompt.length === 0) {
        deps.onBattleEvent({ type: 'hesitate' });
        continue;
      }

      currentFloorEngaged = true;
      const { damage, crit, matchedKeywords } = calculateDamage(prompt);
      deps.onBattleEvent({ type: 'turnStart' });

      // The prompt's total damage (unchanged, still purely prompt-shape-based)
      // is spent across the turn as live tool-use events arrive, tapering by
      // 40% of what's left each time, instead of landing as one lump sum at
      // the end — the same total, just felt as the work actually happens.
      // Partial hits land for real immediately, even if the turn later
      // errors; only the leftover "closing" chunk is skipped on error (below),
      // matching the existing "no bonus for a failed turn" rule.
      let remaining = damage;
      const onAgentEvent = (event: AgentEvent) => {
        deps.onBattleEvent({ type: 'agentEvent', agentEvent: event });
        if (remaining > 0) {
          const hit = Math.min(remaining, Math.max(1, Math.round(remaining * 0.4)));
          remaining -= hit;
          hp = Math.max(0, hp - hit);
          deps.onBattleEvent({ type: 'partialHit', damage: hit, agentEvent: event });
          deps.onBattleEvent({ type: 'hpChanged', hp, maxHp: monster.maxHp });
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
      deps.onBattleEvent({ type: 'hpChanged', hp, maxHp: monster.maxHp });
    }

    if (currentFloorEngaged) floorsEngaged += 1;
    if (left) break;

    const gained = xpForFloor(floor);
    xpGained += gained;
    floorsCleared += 1;
    deps.onBattleEvent({ type: 'floorCleared', monsterName: monster.name, xpGained: gained });
    floor += 1;
  }

  deps.onBattleEvent({ type: 'runEnded', floorsCleared, floorsEngaged, xpGained });
  return { floorsCleared, floorsEngaged, xpGained };
}
