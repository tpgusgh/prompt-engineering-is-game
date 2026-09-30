import { calculateDamage } from './damage.ts';
import { spawnMonster, listMonsters, MONSTER_COUNT, TRAITS, ROSTER_NAMES, DIFFICULTY_REWARD, type Difficulty, type TraitId } from './monsters.ts';
import { THEME_RULES, themeRules } from './themes.ts';
import type { TurnResult, AgentEvent } from './agent.ts';
import { getItem, shopOffer, rollChestItem, POTION_HEAL, BANDAGE_HEAL, CRYSTAL_MAX_HP, COIN_CHARM_BONUS, BOMB_DAMAGE, SCROLL_XP, type Item } from './items.ts';
import { contractMods, pactOf, signContract, BREAK_PENALTY, type Contract, type Demon } from './contracts.ts';
import { EMPTY_STATS, VITALITY_HP, raiseStat, allMaxed, isStatId, attackMultiplier, defenseReduction, type Stats, type StatId } from './stats.ts';
import { enhanceOdds, swordMultiplier, SWORD_MAX_LEVEL, type EnhanceOdds } from './forge.ts';
import { emptyRunStats, isTestCommand, type RunStats } from './progress.ts';

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
      // Chapter bosses fight with a special rule.
      gimmick?: BossGimmick;
      trait?: { id: TraitId; name: string; text: string };
    }
  | { type: 'traitThorns'; damage: number }
  // The monster hit 0 HP mid-turn: it falls, and later hits go to a chest.
  | { type: 'monsterDown' }
  | { type: 'contractSigned'; kind: Contract['kind']; id: string; name: string; text: string; hpCost: number }
  | { type: 'contractBroken'; penalty: number; maxHp: number }
  | { type: 'relicGained'; itemId: string }
  | { type: 'bombHit'; damage: number }
  | { type: 'bonusXp'; amount: number }
  | { type: 'reflectHit'; damage: number }
  | { type: 'chestHit'; damage: number; total: number }
  | { type: 'chestOpened'; grade: ChestGrade['id']; name: string; overkill: number; coins: number; items: string[] }
  | { type: 'traitRegen'; amount: number }
  | { type: 'gimmickBlocked'; text: string }
  | { type: 'gimmickHeal'; amount: number }
  | { type: 'hesitate' }
  | { type: 'monsterWaits' }
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
  // reason 'new': the player asked for a fresh session (/new).
  | { type: 'sessionReset'; reason?: 'new' }
  | { type: 'sessionNearlyFull'; usedTokens: number; contextWindow: number }
  | { type: 'sessionSaved'; sessionId: string }
  | { type: 'fleeAttempt'; success: boolean }
  | { type: 'fleeBlocked' }
  | { type: 'coinsChanged'; coins: number; gained: number }
  | { type: 'merchantOpen'; coins: number; items: Item[] }
  | { type: 'purchased'; itemId: string; coins: number }
  | { type: 'purchaseFailed'; itemId: string; reason: string }
  | { type: 'merchantClosed' }
  | { type: 'betResult'; choice: 'odd' | 'even'; roll: number; won: boolean; amount: number; coins: number }
  | { type: 'betFailed'; reason: string }
  | { type: 'bagChanged'; bag: Record<string, number> }
  | { type: 'itemUsed'; itemId: string }
  | { type: 'itemUseFailed'; itemId: string }
  | { type: 'counterBlocked' }
  | { type: 'typingHit'; damage: number }
  | { type: 'turnInterrupted' }
  | { type: 'contextUsage'; usedTokens: number; contextWindow: number }
  | { type: 'statPointsChanged'; points: number; stats: Stats }
  | { type: 'statRaised'; stat: StatId; stats: Stats; points: number }
  | { type: 'statRaiseFailed'; reason: string }
  | { type: 'blacksmithOpen'; swordLevel: number; coins: number; odds: EnhanceOdds; maxLevel: number }
  | { type: 'enhanceResult'; outcome: 'success' | 'fail' | 'broken'; swordLevel: number; coins: number; odds: EnhanceOdds }
  | { type: 'enhanceFailed'; reason: string }
  | { type: 'blacksmithClosed' }
  // slot 1..SAVE_SLOTS = a manual save; slot 0 = the autosave taken every
  // time the game waits for input (the host keys it by Claude session).
  | { type: 'snapshot'; slot: number; state: RunState }
  | { type: 'saveFailed'; reason: string }
  | { type: 'sessionSwitched'; sessionId: string }
  | ({ type: 'runEnded' } & BattleSummary);

// Everything a save slot needs to resume a run, including the current
// monster's HP when saved mid-fight.
export interface RunState {
  floor: number;
  playerHp: number;
  playerMaxHp: number;
  coins: number;
  bag: Record<string, number>;
  stats: Stats;
  statPoints: number;
  swordLevel: number;
  sessionId?: string;
  // HP of the monster being fought when saved (absent if saved at a shop).
  monsterHp?: number;
}

// Chapter boss rules, in chapter order (then repeating). Conditional ones
// undo the turn's damage when the condition isn't met; "clean" heals the
// boss whenever a tool call fails.
export interface BossGimmick {
  id: 'clean' | 'tests' | 'files3' | 'brief';
  text: string;
}
export const BOSS_GIMMICKS: BossGimmick[] = [
  { id: 'clean', text: '🩹 재생: 도구가 한 번이라도 실패하면 보스가 체력을 회복한다' },
  { id: 'tests', text: '🧪 테스트 결계: 이번 턴에 테스트가 통과해야만 피해가 들어간다' },
  { id: 'files3', text: '📝 서류 더미: 한 턴에 파일을 3개 이상 고쳐야 피해가 들어간다' },
  { id: 'brief', text: '🤐 침묵의 저주: 120자 이하로 짧게 명령해야 피해가 들어간다' },
];
export const BRIEF_LIMIT = 120;
const gimmickFor = (chapter: number) => BOSS_GIMMICKS[(chapter - 1) % BOSS_GIMMICKS.length];

// Treasure chests: the damage dealt past a monster's last HP (the rest of the
// AI's work, the closing blow's excess, typing hits) decides the grade.
// Coins always; an item only by chance (rollChestItem in src/items.ts).
export interface ChestGrade {
  id: 'wood' | 'iron' | 'silver' | 'gold' | 'legend';
  name: string;
  min: number;
  coins: number;
}
export const CHEST_GRADES: ChestGrade[] = [
  { id: 'wood', name: '나무 상자', min: 0, coins: 5 },
  { id: 'iron', name: '철 상자', min: 20, coins: 15 },
  { id: 'silver', name: '은 상자', min: 60, coins: 30 },
  { id: 'gold', name: '금 상자', min: 150, coins: 60 },
  { id: 'legend', name: '전설의 상자', min: 300, coins: 120 },
];
export function chestFor(overkill: number): ChestGrade {
  return [...CHEST_GRADES].reverse().find((g) => overkill >= g.min) ?? CHEST_GRADES[0];
}

export const SAVE_SLOTS = 3;
// Slot written automatically at the start of every floor (not by /save).
export const AUTO_SAVE_SLOT = SAVE_SLOTS + 1;

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
  // Current HP to start at (a loaded save); defaults to full.
  playerHp?: number;
  // HP of the first floor's monster (a loaded mid-fight save).
  monsterHp?: number;
  // Carried over between runs via the profile.
  coins?: number;
  bag?: Record<string, number>;
  // Resume a Claude session saved for this project folder.
  initialSessionId?: string;
  // Permanent progression carried in the profile.
  stats?: Stats;
  statPoints?: number;
  swordLevel?: number;
  // The host gets a function that lands extra hits (the typing mini-game)
  // while an AI turn is running; it returns false when no turn is running.
  bindExternalHit?: (hit: (damage: number) => boolean) => void;
  // Flee and merchant rolls; injectable so tests are deterministic.
  random?: () => number;
  // The model the next attack uses (for per-model win records).
  getModel?: () => string;
  // Story theme: picks the monster rosters and the theme's rules.
  themeId?: string;
  // Treasure chests from overkill (default on; tests of coin math turn them off).
  chests?: boolean;
  // Carried in the profile: the hero's contract (god or demon) and relics
  // (permanent items like the coin charm).
  contract?: Contract | null;
  relics?: string[];
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
  stats: Stats;
  statPoints: number;
  swordLevel: number;
  runStats: RunStats;
  contract: Contract | null;
  relics: string[];
  // Max HP lost for good this run (broken contracts).
  maxHpPenalty: number;
}

const BOSS_HP_MULTIPLIER = 1.5;
// Monster traits (src/monsters.ts TRAITS).
const FIERCE = 1.3;
const THORNS_DAMAGE = 2;
const REGEN_RATIO = 0.05;
const FLOOR_CLEAR_HEAL = 25;
const SESSION_WARN_RATIO = 0.8;
const FLEE_CHANCE = 0.5;
const MERCHANT_CHANCE = 0.3;
const BLACKSMITH_CHANCE = 0.2;
const BOSS_COIN_MULTIPLIER = 3;

function xpForFloor(floor: number): number {
  return 20 + floor * 5;
}

// Damage of one successful tool action: a quarter of the prompt's damage,
// at least 1 and at most 12 (so a crit prompt doesn't one-shot per action).
export function actionDamage(promptDamage: number): number {
  return Math.min(12, Math.max(1, Math.round(promptDamage * 0.25)));
}

function coinsForFloor(floor: number, isBoss: boolean): number {
  return (10 + floor * 2) * (isBoss ? BOSS_COIN_MULTIPLIER : 1);
}

// Does the reply end by asking the player something? (Same rule as the
// quest modal: the last line ends with "?", or a trailing choice list
// follows a line that does.) Then the monster waits for the answer.
export function endsWithQuestion(text: string): boolean {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const isQ = (l?: string) => Boolean(l && /[?？][*_`)\s]*$/.test(l));
  if (isQ(lines.at(-1))) return true;
  const isItem = (l: string) => /^([-*+]|\d+[.)])\s/.test(l);
  let i = lines.length - 1;
  if (i < 0 || !isItem(lines[i])) return false;
  while (i >= 0 && isItem(lines[i])) i--;
  return isQ(lines[i]);
}

function counterDamage(monsterMaxHp: number, punished: boolean): number {
  const base = Math.max(3, Math.round(monsterMaxHp * 0.1));
  return punished ? Math.round(base * 1.5) : base;
}

// Bestiary entries: each monster as first met (normal difficulty) — its HP,
// the counterattack it deals, and a boss's rule.
// Stats are for its earliest appearance in any theme (theme bonuses aside);
// appearances list every theme and chapter it shows up in.
export function bestiary() {
  return listMonsters().map((m) => {
    const slot = m.index % MONSTER_COUNT;
    const appearances = THEME_RULES.flatMap((t) => {
      const i = t.rosters.indexOf(m.roster);
      return i === -1 ? [] : [{ themeId: t.id, chapter: i + 1 }];
    });
    const first = appearances.reduce((a, b) => (b.chapter < a.chapter ? b : a), appearances[0] ?? { themeId: THEME_RULES[0].id, chapter: 1 });
    const floor = (first.chapter - 1) * MONSTER_COUNT + slot;
    const spawned = spawnMonster(floor, 'normal', first.themeId);
    const maxHp = m.isBoss ? Math.round(spawned.maxHp * BOSS_HP_MULTIPLIER) : spawned.maxHp;
    const counter = Math.round(counterDamage(maxHp, false) * (m.trait === 'fierce' ? FIERCE : 1));
    return {
      ...m,
      rosterName: ROSTER_NAMES[m.roster],
      appearances,
      exclusiveTo: appearances.length === 1 ? appearances[0].themeId : undefined,
      chapter: first.chapter,
      firstFloor: floor,
      maxHp,
      counter,
      trait: { id: m.trait, ...TRAITS[m.trait] },
      gimmick: m.isBoss ? gimmickFor(first.chapter) : undefined,
    };
  });
}

export async function runDungeon(deps: BattleDeps): Promise<BattleSummary> {
  const random = deps.random ?? Math.random;
  const theme = themeRules(deps.themeId);
  let playerMaxHp = deps.playerMaxHp ?? 100;
  let playerHp = Math.min(playerMaxHp, deps.playerHp ?? playerMaxHp);
  let coins = deps.coins ?? 0;
  const bag: Record<string, number> = {};
  for (const [id, count] of Object.entries(deps.bag ?? {})) if (count > 0) bag[id] = count;
  let stats: Stats = { ...EMPTY_STATS, ...deps.stats };
  let statPoints = deps.statPoints ?? 0;
  let swordLevel = deps.swordLevel ?? 0;
  // The current monster's HP: -1 while at a shop / between floors.
  let hp = -1;
  let currentMaxHp = 0;
  let pendingMonsterHp = deps.monsterHp;
  let turnRunning = false;
  let sharpened = false; // whetstone: next attack x2
  const chests = deps.chests ?? true;
  let contract: Contract | null = deps.contract ?? null;
  let mods = contractMods(contract);
  const relics = [...(deps.relics ?? [])];
  let maxHpPenalty = 0;
  let shopVisits = 0;
  const coinGain = (n: number) => Math.round(n * mods.coinMult * (relics.includes('coinCharm') ? COIN_CHARM_BONUS : 1));
  // This turn's damage past the monster's last HP, and whether it has fallen.
  let overkill = 0;
  let monsterDown = false;
  const hitChest = (damage: number) => {
    overkill += damage;
    deps.onBattleEvent({ type: 'chestHit', damage, total: overkill });
  };
  let shielded = false; // amulet: next counterattack blocked
  // Input typed at the merchant that wasn't a shop command: replayed as the
  // next floor's first input, so a prompt typed there isn't lost.
  let carried: string | null = null;
  const nextInput = async () => {
    autosave();
    if (carried === null) return deps.readInput();
    const input = carried;
    carried = null;
    return input;
  };
  let floor = deps.startFloor ?? 0;
  let floorsCleared = 0;
  let floorsEngaged = 0;
  const runStats = emptyRunStats();
  let floorModel = '';
  const modelRecord = (model: string) => (runStats.byModel[model] ??= { engaged: 0, cleared: 0 });
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
    damage = Math.max(1, Math.round(damage * (1 - defenseReduction(stats)) * mods.counterMult));
    playerHp = Math.max(0, playerHp - damage);
    deps.onBattleEvent({ type: 'monsterAttack', damage });
    deps.onBattleEvent({ type: 'playerHpChanged', hp: playerHp, maxHp: playerMaxHp });
    if (mods.reflect > 0 && hp > 0) {
      const back = Math.max(1, Math.round(damage * mods.reflect));
      hp = Math.max(1, hp - back); // envy wounds, it doesn't finish the fight
      deps.onBattleEvent({ type: 'reflectHit', damage: back });
      deps.onBattleEvent({ type: 'hpChanged', hp, maxHp: currentMaxHp });
    }
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
    const usable = ['bandage', 'potion', 'whetstone', 'amulet', 'elixir', 'bomb', 'scroll', 'contract', 'devilContract'];
    // The bomb needs a monster to throw it at (not at a shop).
    if (!usable.includes(id) || (id === 'bomb' && hp <= 0) || !takeItem(id)) {
      deps.onBattleEvent({ type: 'itemUseFailed', itemId: id });
      return;
    }
    if (id === 'potion' || id === 'bandage' || id === 'elixir') {
      playerHp = id === 'elixir' ? playerMaxHp : Math.min(playerMaxHp, playerHp + (id === 'potion' ? POTION_HEAL : BANDAGE_HEAL));
      emitPlayerHp();
    } else if (id === 'whetstone') {
      sharpened = true;
    } else if (id === 'amulet') {
      shielded = true;
    } else if (id === 'bomb') {
      const before = hp;
      hp = Math.max(0, hp - BOMB_DAMAGE);
      if (chests && hp === 0) overkill = BOMB_DAMAGE - before;
      deps.onBattleEvent({ type: 'bombHit', damage: BOMB_DAMAGE });
      deps.onBattleEvent({ type: 'hpChanged', hp, maxHp: currentMaxHp });
    } else if (id === 'scroll') {
      xpGained += SCROLL_XP;
      deps.onBattleEvent({ type: 'bonusXp', amount: SCROLL_XP });
    } else {
      signWith(id === 'contract' ? 'god' : 'demon');
    }
    deps.onBattleEvent({ type: 'itemUsed', itemId: id });
  };

  // A contract scroll: a new pact, or — if one is already held — every pact
  // breaks and max HP drops for good.
  const signWith = (kind: Contract['kind']) => {
    const result = signContract(contract, kind, random);
    if (result.broken) {
      contract = null;
      maxHpPenalty += BREAK_PENALTY;
      playerMaxHp = Math.max(20, playerMaxHp - BREAK_PENALTY);
      playerHp = Math.min(playerHp, playerMaxHp);
      deps.onBattleEvent({ type: 'contractBroken', penalty: BREAK_PENALTY, maxHp: playerMaxHp });
    } else {
      contract = result.contract;
      const pact = pactOf(contract)!;
      const hpCost = kind === 'demon' ? Math.round(playerMaxHp * (pact as Demon).hpCost) : 0;
      playerHp = Math.max(1, playerHp - hpCost);
      deps.onBattleEvent({ type: 'contractSigned', kind, id: pact.id, name: pact.name, text: pact.text, hpCost });
    }
    mods = contractMods(contract);
    emitPlayerHp();
  };

  // The merchant's odd/even dice game: `/bet odd|even|홀|짝 <coins>`.
  // A win pays the stake back double (net +stake); a loss takes it.
  const placeBet = (input: string) => {
    const match = /^\/bet\s+(\S+)\s+(\d+)$/.exec(input);
    const choice = match && ({ odd: 'odd', 홀: 'odd', even: 'even', 짝: 'even' } as const)[match[1] as 'odd'];
    const amount = match ? Number(match[2]) : 0;
    if (!choice) {
      deps.onBattleEvent({ type: 'betFailed', reason: '홀 또는 짝에 걸어야 한다' });
      return;
    }
    if (amount < 1 || amount > coins) {
      deps.onBattleEvent({ type: 'betFailed', reason: `1~${coins} 코인 사이로 걸어야 한다` });
      return;
    }
    const roll = Math.floor(random() * 6) + 1;
    const won = (roll % 2 === 1) === (choice === 'odd');
    coins += won ? amount : -amount;
    if (won) runStats.betsWon += 1;
    deps.onBattleEvent({ type: 'betResult', choice, roll, won, amount, coins });
  };

  // Free action, allowed anywhere: spend a stat point from defeated monsters.
  const spendStatPoint = (input: string) => {
    const id = input.slice('/stat '.length).trim();
    const fail = (reason: string) => deps.onBattleEvent({ type: 'statRaiseFailed', reason });
    if (!isStatId(id)) return fail('그런 능력치는 없다');
    if (statPoints < 1) return fail('능력치 포인트가 없다 (몬스터를 쓰러뜨리면 얻는다)');
    const raised = raiseStat(stats, id);
    if (!raised) return fail('이미 최대 레벨이다');
    stats = raised;
    statPoints -= 1;
    if (id === 'vitality') {
      playerMaxHp += VITALITY_HP;
      playerHp += VITALITY_HP;
      emitPlayerHp();
    }
    deps.onBattleEvent({ type: 'statRaised', stat: id, stats: { ...stats }, points: statPoints });
  };

  // floor is the one being fought, or (at a shop) the next one.
  const currentState = (): RunState => ({
    floor, playerHp, playerMaxHp, coins, bag: { ...bag }, stats: { ...stats }, statPoints, swordLevel,
    ...(sessionId ? { sessionId } : {}),
    ...(hp > 0 ? { monsterHp: hp } : {}),
  });
  const autosave = () => deps.onBattleEvent({ type: 'snapshot', slot: 0, state: currentState() });

  // `/save N` and `/session <id>` — free actions allowed anywhere, like /stat.
  const freeCommand = (input: string): boolean => {
    if (input.startsWith('/stat ')) {
      spendStatPoint(input);
      return true;
    }
    if (input === '/save' || input.startsWith('/save ')) {
      const slot = Number(input.slice('/save'.length).trim() || '1');
      if (!Number.isInteger(slot) || slot < 1 || slot > SAVE_SLOTS) {
        deps.onBattleEvent({ type: 'saveFailed', reason: `슬롯은 1~${SAVE_SLOTS}번이다` });
        return true;
      }
      deps.onBattleEvent({ type: 'snapshot', slot, state: currentState() });
      return true;
    }
    if (input.startsWith('/session ')) {
      const id = input.slice('/session '.length).trim();
      if (!id) return true;
      sessionId = id;
      sessionConfirmed = false;
      warnedSessionFull = false;
      deps.onBattleEvent({ type: 'sessionSwitched', sessionId: id });
      return true;
    }
    return false;
  };

  // Shared shop loop (merchant, blacksmith). `handle` returns true when it
  // consumed the input; anything else closes the shop, and a prompt typed
  // there is replayed as the next floor's first input. Returns false if the
  // player left the dungeon from the shop.
  const visitShop = async (handle: (input: string) => boolean, onClose: () => void): Promise<boolean> => {
    while (true) {
      autosave();
      const raw = await deps.readInput();
      if (raw === null) return false;
      const input = raw.trim();
      if (input === '/quit') return false;
      if (freeCommand(input) || handle(input)) continue;
      onClose();
      if (input !== '/leave' && input !== '') carried = raw;
      return true;
    }
  };

  const tryEnhance = () => {
    const odds = enhanceOdds(swordLevel);
    if (swordLevel >= SWORD_MAX_LEVEL) {
      deps.onBattleEvent({ type: 'enhanceFailed', reason: '이미 최대 강화다' });
      return;
    }
    if (coins < odds.cost) {
      deps.onBattleEvent({ type: 'enhanceFailed', reason: `코인이 부족하다 (${odds.cost} 필요)` });
      return;
    }
    coins -= odds.cost;
    let outcome: 'success' | 'fail' | 'broken';
    if (random() < odds.successChance) {
      swordLevel += 1;
      outcome = 'success';
    } else if (odds.breakChance > 0 && random() < odds.breakChance) {
      swordLevel = 0;
      outcome = 'broken';
    } else {
      outcome = 'fail';
    }
    deps.onBattleEvent({ type: 'enhanceResult', outcome, swordLevel, coins, odds: enhanceOdds(swordLevel) });
  };

  const visitBlacksmith = () => {
    deps.onBattleEvent({ type: 'blacksmithOpen', swordLevel, coins, odds: enhanceOdds(swordLevel), maxLevel: SWORD_MAX_LEVEL });
    return visitShop(
      (input) => {
        if (input !== '/enhance') return false;
        tryEnhance();
        return true;
      },
      () => deps.onBattleEvent({ type: 'blacksmithClosed' }),
    );
  };

  const visitMerchant = () => {
    const offer = shopOffer(shopVisits++, relics);
    deps.onBattleEvent({ type: 'merchantOpen', coins, items: offer });
    return visitShop((input) => {
      if (input.startsWith('/bet ')) {
        placeBet(input);
        return true;
      }
      if (!input.startsWith('/buy ')) return false;
      const id = input.slice('/buy '.length).trim();
      const item = offer.find((i) => i.id === id);
      if (!item) {
        deps.onBattleEvent({ type: 'purchaseFailed', itemId: id, reason: getItem(id) ? '오늘은 안 파는 물건이다' : '그런 물건은 없다' });
      } else if (relics.includes(item.id)) {
        deps.onBattleEvent({ type: 'purchaseFailed', itemId: id, reason: '이미 가지고 있다 (한 번만 살 수 있다)' });
      } else if (coins < item.price) {
        deps.onBattleEvent({ type: 'purchaseFailed', itemId: id, reason: '코인이 부족하다' });
      } else {
        coins -= item.price;
        if (item.id === 'crystal') {
          playerMaxHp += CRYSTAL_MAX_HP;
          playerHp += CRYSTAL_MAX_HP;
          emitPlayerHp();
        } else if (item.id === 'coinCharm') {
          relics.push(item.id);
          deps.onBattleEvent({ type: 'relicGained', itemId: item.id });
        } else {
          bag[item.id] = (bag[item.id] ?? 0) + 1;
          emitBag();
        }
        deps.onBattleEvent({ type: 'purchased', itemId: item.id, coins });
      }
      return true;
    }, () => deps.onBattleEvent({ type: 'merchantClosed' }));
  };

  deps.bindExternalHit?.((damage) => {
    if (!turnRunning) return false;
    damage *= mods.typingDamage;
    if (hp <= 0) {
      if (!chests) return false;
      runStats.typingLines += 1;
      hitChest(damage);
      return true;
    }
    hp = Math.max(0, hp - damage);
    runStats.typingLines += 1;
    deps.onBattleEvent({ type: 'typingHit', damage });
    deps.onBattleEvent({ type: 'hpChanged', hp, maxHp: currentMaxHp });
    return true;
  });

  while (true) {
    const spawned = spawnMonster(floor, deps.difficulty, deps.themeId);
    const monsterIndex = spawned.index;
    const isBoss = floor % MONSTER_COUNT === MONSTER_COUNT - 1;
    const chapter = Math.floor(floor / MONSTER_COUNT) + 1;
    const maxHp = isBoss ? Math.round(spawned.maxHp * BOSS_HP_MULTIPLIER * theme.bossHp) : spawned.maxHp;
    const gimmick = isBoss ? gimmickFor(chapter) : undefined;
    if (!runStats.seen.includes(monsterIndex)) runStats.seen.push(monsterIndex);
    const trait = spawned.trait;
    let turnFailedTool = false; // debug-quest: a failed tool call hardens the counter
    const counter = (punished: boolean) =>
      Math.round(counterDamage(maxHp, punished) * (trait === 'fierce' ? FIERCE : 1) * (turnFailedTool ? theme.failCounter : 1));
    currentMaxHp = maxHp;
    hp = Math.min(maxHp, pendingMonsterHp ?? maxHp);
    pendingMonsterHp = undefined;
    deps.onBattleEvent({
      type: 'floorStart',
      floor,
      chapter,
      isBoss,
      monsterIndex,
      monsterName: spawned.name,
      monsterArt: spawned.art,
      maxHp,
      ...(gimmick ? { gimmick } : {}),
      trait: { id: trait, ...TRAITS[trait] },
    });
    if (hp < maxHp) deps.onBattleEvent({ type: 'hpChanged', hp, maxHp });
    // Floor autosave: this floor, from the start of the fight.
    deps.onBattleEvent({ type: 'snapshot', slot: AUTO_SAVE_SLOT, state: { ...currentState(), monsterHp: undefined } });

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
        const success = smoke || random() < (mods.fleeChance ?? FLEE_CHANCE);
        deps.onBattleEvent({ type: 'fleeAttempt', success });
        if (success) {
          fled = true;
          break;
        }
        // A failed escape wastes the turn: the monster gets a free hit.
        takeHit(counter(false));
        if (playerHp <= 0) break;
        continue;
      }
      if (freeCommand(prompt)) continue;
      if (prompt.startsWith('/use ')) {
        useItem(prompt.slice('/use '.length).trim());
        continue;
      }
      if (prompt === '/new' || prompt.startsWith('/new ')) {
        sessionId = undefined;
        warnedSessionFull = false;
        deps.onBattleEvent({ type: 'sessionReset', reason: 'new' });
        prompt = prompt.slice('/new'.length).trim();
        if (prompt.length === 0) continue;
      }
      if (prompt.length === 0) {
        deps.onBattleEvent({ type: 'hesitate' });
        takeHit(counter(true));
        if (playerHp <= 0) break;
        continue;
      }

      currentFloorEngaged = true;
      const base = calculateDamage(prompt);
      let damage = Math.round(
        base.damage * (deps.getDamageMultiplier?.() ?? 1) * attackMultiplier(stats) * swordMultiplier(swordLevel),
      );
      if (sharpened) {
        damage *= 2;
        sharpened = false;
      }
      const { crit, matchedKeywords } = base;
      deps.onBattleEvent({ type: 'turnStart', prompt });
      runStats.turns += 1;
      floorModel = deps.getModel?.() ?? 'unknown';
      const turnStartedAt = Date.now();
      let turnTests = 0;
      let turnEdits = 0;
      let turnFailures = 0;
      let turnActionDamage = 0;
      turnFailedTool = false;
      overkill = 0;
      monsterDown = false;
      // A boss whose rule is only settled at the end of the turn can't fall early.
      const canFallEarly = !gimmick || gimmick.id === 'clean';

      // Work is damage: every tool action that succeeds (a command, an edit,
      // a subagent's read) lands its own hit as its result comes in — failed
      // ones don't — and the prompt's full damage lands as the closing blow
      // when the turn ends normally (not on error or stop). So a short
      // prompt that makes the AI do a lot still hits hard.
      const baseAction = actionDamage(damage) + mods.actionBonus + mods.flat;
      const actionHit = mods.noActionHits ? 0 : trait === 'armor' ? Math.max(1, Math.round(baseAction / 2)) : baseAction;
      const calls = new Map<string, AgentEvent>();
      const onAgentEvent = (event: AgentEvent) => {
        deps.onBattleEvent({ type: 'agentEvent', agentEvent: event });
        if ((event.type === 'command' || event.type === 'file') && event.toolId) calls.set(event.toolId, event);
        if (event.type === 'toolResult') {
          const call = calls.get(event.toolId);
          calls.delete(event.toolId);
          if (!call) return;
          if (event.isError) {
            turnFailures += 1;
            turnFailedTool = true;
            if (trait === 'thorns' && playerHp > 0) {
              playerHp = Math.max(0, playerHp - THORNS_DAMAGE);
              deps.onBattleEvent({ type: 'traitThorns', damage: THORNS_DAMAGE });
              emitPlayerHp();
            }
            return;
          }
          if (call.type === 'file') {
            runStats.filesEdited += 1;
            turnEdits += 1;
          } else if (call.type === 'command' && isTestCommand(call.value)) {
            runStats.testsPassed += 1;
            turnTests += 1;
          }
          if (actionHit === 0) return; // sloth: work deals nothing
          if (hp <= 0) {
            if (chests) hitChest(actionHit);
            return;
          }
          const before = hp;
          turnActionDamage += Math.min(hp, actionHit);
          hp = Math.max(0, hp - actionHit);
          deps.onBattleEvent({ type: 'partialHit', damage: actionHit, agentEvent: call });
          deps.onBattleEvent({ type: 'hpChanged', hp, maxHp });
          if (hp === 0 && chests) {
            overkill += actionHit - before;
            if (canFallEarly && !monsterDown) {
              monsterDown = true;
              deps.onBattleEvent({ type: 'monsterDown' });
            }
          }
        }
      };

      let turn: TurnResult;
      turnRunning = true;
      try {
        turn = await deps.runTurn(prompt, deps.cwd, sessionId, onAgentEvent);
      } catch (err) {
        turn = { summary: '', filesChanged: [], commandsRun: [], error: err instanceof Error ? err.message : String(err) };
      } finally {
        turnRunning = false;
      }
      runStats.tokens += turn.tokensUsed ?? 0;
      runStats.longestTurnMs = Math.max(runStats.longestTurnMs, Date.now() - turnStartedAt);
      // Boss rule not met: the turn's work hits are undone and the closing
      // blow doesn't land.
      const gimmickMet =
        gimmick?.id === 'tests' ? turnTests > 0 : gimmick?.id === 'files3' ? turnEdits >= 3 : gimmick?.id === 'brief' ? prompt.length <= BRIEF_LIMIT : true;
      if (!gimmickMet && gimmick) {
        hp = Math.min(maxHp, hp + turnActionDamage);
        overkill = 0;
        deps.onBattleEvent({ type: 'gimmickBlocked', text: gimmick.text });
      }
      if (gimmick?.id === 'clean' && turnFailures > 0 && hp > 0) {
        const heal = Math.round(maxHp * 0.1) * turnFailures;
        hp = Math.min(maxHp, hp + heal);
        deps.onBattleEvent({ type: 'gimmickHeal', amount: heal });
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
      } else if (turn.interrupted) {
        // Stopped by the player: hits so far stay, no closing blow.
        deps.onBattleEvent({ type: 'turnInterrupted' });
        if (turn.summary) deps.onBattleEvent({ type: 'agentSummary', summary: turn.summary });
      } else if (gimmickMet) {
        if (trait === 'frail') damage = Math.round(damage * 1.25);
        if (trait === 'keywordWeak' && crit) damage = Math.round(damage * 1.3);
        if (trait === 'testWeak' && turnTests > 0) damage = Math.round(damage * 1.5);
        if (turnTests > 0) damage = Math.round(damage * theme.testBonus);
        damage = Math.round((damage + mods.flat) * mods.closingMult * (crit ? mods.critMult : 1) * (isBoss ? mods.bossMult : 1) * (playerHp <= playerMaxHp / 2 ? mods.lowHpMult : 1));
        if (chests) overkill += Math.max(0, damage - hp);
        hp = Math.max(0, hp - damage);
        runStats.bestHit = Math.max(runStats.bestHit, damage);
        if (crit) runStats.crits += 1;
        deps.onBattleEvent({ type: 'attack', damage, crit, matchedKeywords });
        if (turn.summary) deps.onBattleEvent({ type: 'agentSummary', summary: turn.summary });
      } else {
        if (turn.summary) deps.onBattleEvent({ type: 'agentSummary', summary: turn.summary });
      }
      deps.onBattleEvent({ type: 'hpChanged', hp, maxHp });

      if (turn.contextTokens !== undefined && turn.contextWindow !== undefined) {
        deps.onBattleEvent({ type: 'contextUsage', usedTokens: turn.contextTokens, contextWindow: turn.contextWindow });
      }
      if (
        !warnedSessionFull &&
        turn.contextTokens !== undefined &&
        turn.contextWindow !== undefined &&
        turn.contextTokens >= turn.contextWindow * SESSION_WARN_RATIO
      ) {
        warnedSessionFull = true;
        deps.onBattleEvent({ type: 'sessionNearlyFull', usedTokens: turn.contextTokens, contextWindow: turn.contextWindow });
      }

      if (playerHp <= 0) break; // thorns finished the hero mid-turn
      if (hp > 0 && !turn.error && endsWithQuestion(turn.summary)) {
        deps.onBattleEvent({ type: 'monsterWaits' });
      } else if (hp > 0) {
        takeHit(counter(Boolean(turn.error)));
        if (playerHp <= 0) break;
      }
      if (mods.healPerTurn > 0 && playerHp < playerMaxHp) {
        playerHp = Math.min(playerMaxHp, playerHp + mods.healPerTurn);
        emitPlayerHp();
      }
      if (trait === 'regen' && hp > 0 && hp < maxHp) {
        const amount = Math.min(maxHp - hp, Math.max(1, Math.round(maxHp * REGEN_RATIO)));
        hp += amount;
        deps.onBattleEvent({ type: 'traitRegen', amount });
        deps.onBattleEvent({ type: 'hpChanged', hp, maxHp });
      }
    }

    hp = -1; // between floors / at a shop: no monster to save
    if (currentFloorEngaged) {
      floorsEngaged += 1;
      modelRecord(floorModel).engaged += 1;
    }
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

    const rewardMult = theme.rewards * (DIFFICULTY_REWARD[deps.difficulty] ?? 1);
    if (chests && overkill > 0) {
      const grade = chestFor(overkill);
      const chestCoins = coinGain(grade.coins * rewardMult * (1 + floor * 0.1));
      coins += chestCoins;
      const loot = rollChestItem(grade.id, random);
      if (loot?.id === 'crystal') {
        playerMaxHp += CRYSTAL_MAX_HP;
        playerHp += CRYSTAL_MAX_HP;
        emitPlayerHp();
      } else if (loot) {
        bag[loot.id] = (bag[loot.id] ?? 0) + 1;
      }
      deps.onBattleEvent({ type: 'chestOpened', grade: grade.id, name: grade.name, overkill, coins: chestCoins, items: loot ? [loot.id] : [] });
      deps.onBattleEvent({ type: 'coinsChanged', coins, gained: chestCoins });
      if (loot && loot.id !== 'crystal') emitBag();
      overkill = 0;
    }
    const gained = Math.round(xpForFloor(floor) * rewardMult);
    xpGained += gained;
    floorsCleared += 1;
    runStats.floorsCleared += 1;
    if (isBoss) runStats.bossesDefeated += 1;
    runStats.kills[monsterIndex] = (runStats.kills[monsterIndex] ?? 0) + 1;
    if (currentFloorEngaged) modelRecord(floorModel).cleared += 1;
    deps.onBattleEvent({ type: 'floorCleared', monsterName: spawned.name, xpGained: gained });
    if (isBoss) deps.onBattleEvent({ type: 'chapterCleared', chapter });
    playerHp = Math.min(playerMaxHp, playerHp + FLOOR_CLEAR_HEAL * mods.clearHealMult + mods.clearHealBonus);
    emitPlayerHp();
    const coinsGained = coinGain(coinsForFloor(floor, isBoss) * rewardMult);
    coins += coinsGained;
    deps.onBattleEvent({ type: 'coinsChanged', coins, gained: coinsGained });
    if (!allMaxed(stats)) {
      statPoints += 1;
      deps.onBattleEvent({ type: 'statPointsChanged', points: statPoints, stats: { ...stats } });
    }
    floor += 1;
    const encounter = random();
    if (encounter < MERCHANT_CHANCE * theme.shopChance) {
      if (!(await visitMerchant())) break;
    } else if (encounter < (MERCHANT_CHANCE + BLACKSMITH_CHANCE) * theme.shopChance) {
      if (!(await visitBlacksmith())) break;
    }
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
    stats: { ...stats },
    statPoints,
    swordLevel,
    runStats: { ...runStats, byModel: { ...runStats.byModel }, seen: [...runStats.seen], kills: { ...runStats.kills } },
    contract,
    relics: [...relics],
    maxHpPenalty,
  };
  deps.onBattleEvent({ type: 'runEnded', ...summary });
  return summary;
}
