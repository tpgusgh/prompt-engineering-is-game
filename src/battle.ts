import { calculateDamage } from './damage.ts';
import { spawnMonster, MONSTER_COUNT, type Difficulty } from './monsters.ts';
import type { TurnResult, AgentEvent } from './agent.ts';
import { ITEMS, getItem, POTION_HEAL, CRYSTAL_MAX_HP, type Item } from './items.ts';

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
  | { type: 'turnStart'; prompt: string }
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
  | { type: 'sessionSaved'; sessionId: string }
  | { type: 'fleeAttempt'; success: boolean }
  | { type: 'fleeBlocked' }
  | { type: 'coinsChanged'; coins: number; gained: number }
  | { type: 'merchantOpen'; coins: number; items: Item[] }
  | { type: 'purchased'; itemId: string; coins: number }
  | { type: 'purchaseFailed'; itemId: string; reason: string }
  | { type: 'merchantClosed' }
  | { type: 'bagChanged'; bag: Record<string, number> }
  | { type: 'itemUsed'; itemId: string }
  | { type: 'itemUseFailed'; itemId: string }
  | { type: 'counterBlocked' }
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
  // Carried over between runs via the profile.
  coins?: number;
  bag?: Record<string, number>;
  // Resume a Claude session saved for this project folder.
  initialSessionId?: string;
  // Flee and merchant rolls; injectable so tests are deterministic.
  random?: () => number;
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
  coins: number;
  bag: Record<string, number>;
  playerMaxHp: number;
}

const BOSS_HP_MULTIPLIER = 1.5;
const FLOOR_CLEAR_HEAL = 25;
const SESSION_WARN_RATIO = 0.8;
const FLEE_CHANCE = 0.5;
const MERCHANT_CHANCE = 0.3;
const BOSS_COIN_MULTIPLIER = 3;

function xpForFloor(floor: number): number {
  return 20 + floor * 5;
}

function coinsForFloor(floor: number, isBoss: boolean): number {
  return (10 + floor * 2) * (isBoss ? BOSS_COIN_MULTIPLIER : 1);
}

function counterDamage(monsterMaxHp: number, punished: boolean): number {
  const base = Math.max(3, Math.round(monsterMaxHp * 0.1));
  return punished ? Math.round(base * 1.5) : base;
}

export async function runDungeon(deps: BattleDeps): Promise<BattleSummary> {
  const random = deps.random ?? Math.random;
  let playerMaxHp = deps.playerMaxHp ?? 100;
  let playerHp = playerMaxHp;
  let coins = deps.coins ?? 0;
  const bag: Record<string, number> = {};
  for (const [id, count] of Object.entries(deps.bag ?? {})) if (count > 0) bag[id] = count;
  let sharpened = false; // whetstone: next attack x2
  let shielded = false; // amulet: next counterattack blocked
  // Input typed at the merchant that wasn't a shop command: replayed as the
  // next floor's first input, so a prompt typed there isn't lost.
  let carried: string | null = null;
  const nextInput = async () => {
    if (carried === null) return deps.readInput();
    const input = carried;
    carried = null;
    return input;
  };
  let floor = deps.startFloor ?? 0;
  let floorsCleared = 0;
  let floorsEngaged = 0;
  let xpGained = 0;
  let defeated = false;
  // A run starts a fresh Claude session unless resuming this folder's saved
  // one; turns within the run resume it. A resumed id that has never worked
  // this run is dropped on its first failure (it may no longer exist).
  let sessionId: string | undefined = deps.initialSessionId;
  let sessionConfirmed = false;
  let warnedSessionFull = false;

  deps.onBattleEvent({ type: 'runStart', playerHp, playerMaxHp });

  const takeHit = (damage: number) => {
    if (shielded) {
      shielded = false;
      deps.onBattleEvent({ type: 'counterBlocked' });
      return;
    }
    playerHp = Math.max(0, playerHp - damage);
    deps.onBattleEvent({ type: 'monsterAttack', damage });
    deps.onBattleEvent({ type: 'playerHpChanged', hp: playerHp, maxHp: playerMaxHp });
  };

  const emitPlayerHp = () => deps.onBattleEvent({ type: 'playerHpChanged', hp: playerHp, maxHp: playerMaxHp });
  const emitBag = () => deps.onBattleEvent({ type: 'bagChanged', bag: { ...bag } });
  const takeItem = (id: string): boolean => {
    if (!bag[id]) return false;
    bag[id] -= 1;
    if (bag[id] === 0) delete bag[id];
    emitBag();
    return true;
  };

  // Free action: never costs a turn or draws a counterattack.
  const useItem = (id: string) => {
    if ((id !== 'potion' && id !== 'whetstone' && id !== 'amulet') || !takeItem(id)) {
      deps.onBattleEvent({ type: 'itemUseFailed', itemId: id });
      return;
    }
    if (id === 'potion') {
      playerHp = Math.min(playerMaxHp, playerHp + POTION_HEAL);
      emitPlayerHp();
    } else if (id === 'whetstone') {
      sharpened = true;
    } else {
      shielded = true;
    }
    deps.onBattleEvent({ type: 'itemUsed', itemId: id });
  };

  // Returns false if the player left the dungeon from the shop.
  const visitMerchant = async (): Promise<boolean> => {
    deps.onBattleEvent({ type: 'merchantOpen', coins, items: ITEMS });
    while (true) {
      const raw = await deps.readInput();
      if (raw === null) return false;
      const input = raw.trim();
      if (input === '/quit') return false;
      if (input.startsWith('/buy ')) {
        const id = input.slice('/buy '.length).trim();
        const item = getItem(id);
        if (!item) {
          deps.onBattleEvent({ type: 'purchaseFailed', itemId: id, reason: '그런 물건은 없다' });
        } else if (coins < item.price) {
          deps.onBattleEvent({ type: 'purchaseFailed', itemId: id, reason: '코인이 부족하다' });
        } else {
          coins -= item.price;
          if (item.id === 'crystal') {
            playerMaxHp += CRYSTAL_MAX_HP;
            playerHp += CRYSTAL_MAX_HP;
            emitPlayerHp();
          } else {
            bag[item.id] = (bag[item.id] ?? 0) + 1;
            emitBag();
          }
          deps.onBattleEvent({ type: 'purchased', itemId: item.id, coins });
        }
        continue;
      }
      deps.onBattleEvent({ type: 'merchantClosed' });
      if (input !== '/leave' && input !== '') carried = raw;
      return true;
    }
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
    let fled = false;
    let currentFloorEngaged = false;
    while (hp > 0) {
      const raw = await nextInput();
      if (raw === null) {
        left = true;
        break;
      }
      let prompt = raw.trim();
      if (prompt === '/quit') {
        left = true;
        break;
      }
      if (prompt === '/flee' || prompt === '/use smoke') {
        if (isBoss) {
          deps.onBattleEvent({ type: 'fleeBlocked' });
          continue;
        }
        const smoke = prompt === '/use smoke';
        if (smoke && !takeItem('smoke')) {
          deps.onBattleEvent({ type: 'itemUseFailed', itemId: 'smoke' });
          continue;
        }
        const success = smoke || random() < FLEE_CHANCE;
        deps.onBattleEvent({ type: 'fleeAttempt', success });
        if (success) {
          fled = true;
          break;
        }
        // A failed escape wastes the turn: the monster gets a free hit.
        takeHit(counterDamage(maxHp, false));
        if (playerHp <= 0) break;
        continue;
      }
      if (prompt.startsWith('/use ')) {
        useItem(prompt.slice('/use '.length).trim());
        continue;
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
      let damage = Math.round(base.damage * (deps.getDamageMultiplier?.() ?? 1));
      if (sharpened) {
        damage *= 2;
        sharpened = false;
      }
      const { crit, matchedKeywords } = base;
      deps.onBattleEvent({ type: 'turnStart', prompt });

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
      if (!turn.error && turn.sessionId) {
        sessionId = turn.sessionId;
        sessionConfirmed = true;
        deps.onBattleEvent({ type: 'sessionSaved', sessionId });
      } else if (turn.error && sessionId && !sessionConfirmed) {
        sessionId = undefined;
        deps.onBattleEvent({ type: 'sessionReset' });
      }

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
    if (fled) {
      floor += 1;
      continue;
    }

    const gained = xpForFloor(floor);
    xpGained += gained;
    floorsCleared += 1;
    deps.onBattleEvent({ type: 'floorCleared', monsterName: spawned.name, xpGained: gained });
    if (isBoss) deps.onBattleEvent({ type: 'chapterCleared', chapter });
    playerHp = Math.min(playerMaxHp, playerHp + FLOOR_CLEAR_HEAL);
    emitPlayerHp();
    const coinsGained = coinsForFloor(floor, isBoss);
    coins += coinsGained;
    deps.onBattleEvent({ type: 'coinsChanged', coins, gained: coinsGained });
    floor += 1;
    if (random() < MERCHANT_CHANCE && !(await visitMerchant())) break;
  }

  const summary: BattleSummary = {
    floorsCleared,
    floorsEngaged,
    xpGained,
    defeated,
    nextFloor: floor,
    chaptersCleared: Math.floor(floor / MONSTER_COUNT),
    coins,
    bag: { ...bag },
    playerMaxHp,
  };
  deps.onBattleEvent({ type: 'runEnded', ...summary });
  return summary;
}
