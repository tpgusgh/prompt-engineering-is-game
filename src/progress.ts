// Long-term progress kept in the profile: lifetime records (the stats
// screen), achievements, and one daily quest. A run reports what happened in
// RunStats; applyProgress folds it in at the end of the run.
import { MONSTER_COUNT, ROSTER_COUNT } from './monsters.ts';

const TOTAL_MONSTERS = MONSTER_COUNT * ROSTER_COUNT;

export interface ModelRecord {
  engaged: number; // floors fought with this model
  cleared: number; // floors won with it
}

export interface RunStats {
  turns: number;
  tokens: number;
  bestHit: number;
  longestTurnMs: number;
  crits: number;
  bossesDefeated: number;
  floorsCleared: number;
  testsPassed: number;
  filesEdited: number;
  typingLines: number;
  betsWon: number;
  contractsBroken: number;
  deathsByContract: number; // fell while bound to a demon
  bestTypingCpm: number;
  richest: number; // most coins held at once
  shelvesCleared: number; // bought every good on a merchant's shelf in one visit
  nightBuys: number;
  springsDrunk: number;
  dailyRuns: number;
  awakenedBossKills: number;
  gearWorn: number; // most relics worn at once
  bothAis: number; // runs fought with more than one AI
  byModel: Record<string, ModelRecord>;
  // Bestiary: monster indexes met, and kills per monster index.
  seen: number[];
  kills: Record<string, number>;
}

export type Records = RunStats & { runs: number; maxSwordLevel: number; maxLevel: number };

export const emptyRunStats = (): RunStats => ({
  turns: 0, tokens: 0, bestHit: 0, longestTurnMs: 0, crits: 0, bossesDefeated: 0,
  floorsCleared: 0, testsPassed: 0, filesEdited: 0, typingLines: 0, betsWon: 0, byModel: {}, seen: [], kills: {},
  contractsBroken: 0, deathsByContract: 0, bestTypingCpm: 0, richest: 0, shelvesCleared: 0, nightBuys: 0, springsDrunk: 0,
  dailyRuns: 0, awakenedBossKills: 0, gearWorn: 0, bothAis: 0,
});
export const emptyRecords = (): Records => ({ ...emptyRunStats(), runs: 0, maxSwordLevel: 0, maxLevel: 1 });

// A shell command that runs a test suite (so "tests passed" can be counted).
const TEST_COMMAND = /\b(npm|pnpm|yarn|bun)\s+(run\s+)?test\b|\bnpx\s+(jest|vitest|mocha|playwright\s+test)\b|\b(pytest|jest|vitest|mocha|rspec|phpunit|ctest)\b|\bnode\s+--test\b|\bgo\s+test\b|\bcargo\s+(test|nextest)\b|\bdotnet\s+test\b|\bmvn\s+(\S+\s+)*test\b|\bgradlew?\s+(\S+\s+)*test\b|\bswift\s+test\b|\bflutter\s+test\b|\bmake\s+(test|check)\b|\bpython3?\s+-m\s+(pytest|unittest)\b/;
export const isTestCommand = (command: string) => TEST_COMMAND.test(command);

const MAX_KEYS: (keyof RunStats)[] = ['bestHit', 'longestTurnMs', 'bestTypingCpm', 'richest', 'gearWorn'];
const NOT_COUNTS: (keyof RunStats)[] = ['byModel', 'seen', 'kills'];

export function mergeRecords(records: Records, run: RunStats, extra: { swordLevel: number; level: number }): Records {
  const out: Records = { ...records, byModel: { ...records.byModel }, seen: [...new Set([...records.seen, ...run.seen])].sort((a, b) => a - b), kills: { ...records.kills } };
  for (const [index, n] of Object.entries(run.kills)) out.kills[index] = (out.kills[index] ?? 0) + n;
  for (const key of Object.keys(run) as (keyof RunStats)[]) {
    if (NOT_COUNTS.includes(key)) continue;
    const value = (run[key] as number) ?? 0;
    (out[key] as number) = MAX_KEYS.includes(key) ? Math.max(out[key] as number, value) : (out[key] as number) + value;
  }
  for (const [model, r] of Object.entries(run.byModel)) {
    const prev = out.byModel[model] ?? { engaged: 0, cleared: 0 };
    out.byModel[model] = { engaged: prev.engaged + r.engaged, cleared: prev.cleared + r.cleared };
  }
  out.runs += 1;
  out.maxSwordLevel = Math.max(out.maxSwordLevel, extra.swordLevel);
  out.maxLevel = Math.max(out.maxLevel, extra.level);
  return out;
}

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  coins: number;
  done: (r: Records) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-win', icon: '🗡', title: '첫 승리', description: '몬스터 1마리 처치', coins: 20, done: (r) => r.floorsCleared >= 1 },
  { id: 'first-boss', icon: '👑', title: '보스 사냥꾼', description: '챕터 보스 처치', coins: 60, done: (r) => r.bossesDefeated >= 1 },
  { id: 'boss-3', icon: '🐉', title: '용 잡는 자', description: '챕터 보스 3마리 처치', coins: 150, done: (r) => r.bossesDefeated >= 3 },
  { id: 'floors-30', icon: '🏔', title: '던전 탐험가', description: '누적 30층 클리어', coins: 120, done: (r) => r.floorsCleared >= 30 },
  { id: 'crit-10', icon: '💥', title: '크리티컬 장인', description: '크리티컬 10회', coins: 50, done: (r) => r.crits >= 10 },
  { id: 'big-hit', icon: '☄️', title: '한 방의 미학', description: '한 번에 300 이상 피해', coins: 80, done: (r) => r.bestHit >= 300 },
  { id: 'tests-10', icon: '🧪', title: '테스트 신봉자', description: '테스트 통과 10회', coins: 60, done: (r) => r.testsPassed >= 10 },
  { id: 'edits-50', icon: '📝', title: '성실한 대장장이', description: '파일 50번 수정', coins: 60, done: (r) => r.filesEdited >= 50 },
  { id: 'typing-20', icon: '⌨️', title: '타자의 달인', description: '코딩 타자 20줄 완성', coins: 40, done: (r) => r.typingLines >= 20 },
  { id: 'gambler', icon: '🎲', title: '홀짝의 신', description: '홀짝 5번 이기기', coins: 30, done: (r) => r.betsWon >= 5 },
  { id: 'sword-5', icon: '⚒', title: '명검 제작', description: '무기 +5 달성', coins: 100, done: (r) => r.maxSwordLevel >= 5 },
  { id: 'marathon', icon: '⏳', title: '끈기', description: '한 턴에 10분 이상 AI 작업', coins: 40, done: (r) => r.longestTurnMs >= 10 * 60_000 },
  { id: 'level-5', icon: '🎖', title: '숙련된 모험가', description: '용사 레벨 5 달성', coins: 80, done: (r) => r.maxLevel >= 5 },
  { id: 'million', icon: '🪙', title: '백만 토큰', description: '누적 토큰 100만', coins: 100, done: (r) => r.tokens >= 1_000_000 },
  { id: 'bestiary-half', icon: '📖', title: '몬스터 연구가', description: `도감 몬스터 ${TOTAL_MONSTERS / 2}종 발견`, coins: 80, done: (r) => r.seen.length >= TOTAL_MONSTERS / 2 },
  { id: 'pact-breaker', icon: '💔', title: '계약 파괴자', description: '계약을 강제로 파기한 자', coins: 50, done: (r) => (r.contractsBroken ?? 0) >= 1 },
  { id: 'pact-victim', icon: '😈', title: '계약에게 당한 자', description: '악마와 계약한 채 쓰러지기', coins: 40, done: (r) => (r.deathsByContract ?? 0) >= 1 },
  { id: 'typing-god', icon: '⌨️', title: '타자의 신', description: '코딩 타자 분당 700타 이상', coins: 150, done: (r) => (r.bestTypingCpm ?? 0) >= 700 },
  { id: 'rich', icon: '💰', title: '부자', description: '코인 3,000개 이상 보유', coins: 100, done: (r) => (r.richest ?? 0) >= 3000 },
  { id: 'shelf-sweep', icon: '🛒', title: '싹쓸이 손님', description: '상인의 물건을 한 번에 전부 사기', coins: 80, done: (r) => (r.shelvesCleared ?? 0) >= 1 },
  { id: 'night-regular', icon: '🏮', title: '야시장 단골', description: '야시장에서 3번 사기', coins: 60, done: (r) => (r.nightBuys ?? 0) >= 3 },
  { id: 'spring-lover', icon: '💧', title: '샘물 애호가', description: '회복의 샘 3번 마시기', coins: 40, done: (r) => (r.springsDrunk ?? 0) >= 3 },
  { id: 'daily-runner', icon: '📅', title: '오늘의 도전자', description: '오늘의 도전 한 판 끝내기', coins: 40, done: (r) => (r.dailyRuns ?? 0) >= 1 },
  { id: 'awakened-slayer', icon: '🔥', title: '각성 진압', description: '각성한 보스 쓰러뜨리기', coins: 100, done: (r) => (r.awakenedBossKills ?? 0) >= 1 },
  { id: 'fully-geared', icon: '⚙️', title: '장비빨', description: '보스 유물 2개 장착', coins: 80, done: (r) => (r.gearWorn ?? 0) >= 2 },
  { id: 'two-ais', icon: '🤝', title: 'AI 양다리', description: '한 판에 AI를 둘 이상 쓰기', coins: 50, done: (r) => (r.bothAis ?? 0) >= 1 },
  { id: 'bestiary-all', icon: '📚', title: '도감 완성', description: `도감 몬스터 ${TOTAL_MONSTERS}종 모두 처치`, coins: 300, done: (r) => Object.keys(r.kills).length >= TOTAL_MONSTERS },
];

// Daily quest: one per local calendar day, the same all day.
export interface DailyQuest {
  id: string;
  icon: string;
  title: string;
  metric: keyof Omit<RunStats, 'byModel' | 'seen' | 'kills'>;
  target: number;
  coins: number;
}

export const DAILY_QUESTS: DailyQuest[] = [
  { id: 'tests-3', icon: '🧪', title: '테스트 3번 통과시키기', metric: 'testsPassed', target: 3, coins: 40 },
  { id: 'edits-5', icon: '📝', title: '파일 5번 수정하기', metric: 'filesEdited', target: 5, coins: 40 },
  { id: 'floors-3', icon: '⚔️', title: '몬스터 3마리 처치', metric: 'floorsCleared', target: 3, coins: 40 },
  { id: 'crits-2', icon: '💥', title: '크리티컬 2번 터뜨리기', metric: 'crits', target: 2, coins: 40 },
  { id: 'typing-5', icon: '⌨️', title: '코딩 타자 5줄 완성', metric: 'typingLines', target: 5, coins: 30 },
  { id: 'turns-5', icon: '🗨', title: 'AI에게 5번 공격 명령', metric: 'turns', target: 5, coins: 30 },
  { id: 'boss-1', icon: '👑', title: '챕터 보스 1마리 처치', metric: 'bossesDefeated', target: 1, coins: 80 },
];

export interface DailyState {
  date: string; // YYYY-MM-DD, local time
  questId: string;
  progress: number;
  done: boolean;
}

export const localDate = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function dailyQuestFor(date: string): DailyQuest {
  let h = 0;
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return DAILY_QUESTS[h % DAILY_QUESTS.length];
}

// Today's quest state (a new day starts a fresh quest).
export function currentDaily(daily: DailyState | undefined, date: string): DailyState {
  if (daily && daily.date === date) return daily;
  return { date, questId: dailyQuestFor(date).id, progress: 0, done: false };
}

export interface ProgressResult {
  records: Records;
  achievements: string[];
  daily: DailyState;
  unlocked: Achievement[];
  dailyCompleted: DailyQuest | null;
  rewardCoins: number;
}

export function applyProgress(
  prev: { records: Records; achievements: string[]; daily?: DailyState },
  run: RunStats,
  extra: { swordLevel: number; level: number },
  date: string,
): ProgressResult {
  const records = mergeRecords(prev.records, run, extra);
  const unlocked = ACHIEVEMENTS.filter((a) => !prev.achievements.includes(a.id) && a.done(records));
  const achievements = [...prev.achievements, ...unlocked.map((a) => a.id)];
  let daily = currentDaily(prev.daily, date);
  let dailyCompleted: DailyQuest | null = null;
  if (!daily.done) {
    const quest = DAILY_QUESTS.find((q) => q.id === daily.questId) ?? dailyQuestFor(date);
    const progress = Math.min(quest.target, daily.progress + (run[quest.metric] as number));
    daily = { ...daily, progress, done: progress >= quest.target };
    if (daily.done) dailyCompleted = quest;
  }
  const rewardCoins = unlocked.reduce((sum, a) => sum + a.coins, 0) + (dailyCompleted?.coins ?? 0);
  return { records, achievements, daily, unlocked, dailyCompleted, rewardCoins };
}

// Profile JSON from disk: keep only well-formed numbers.
export function coerceRecords(value: unknown): Records {
  const v = (value ?? {}) as Record<string, unknown>;
  const out = emptyRecords();
  for (const key of Object.keys(out) as (keyof Records)[]) {
    if (NOT_COUNTS.includes(key as keyof RunStats)) continue;
    const n = v[key];
    if (typeof n === 'number' && Number.isFinite(n) && n >= 0) (out[key] as number) = n;
  }
  if (v.byModel && typeof v.byModel === 'object') {
    for (const [model, r] of Object.entries(v.byModel as Record<string, any>)) {
      if (Number.isFinite(r?.engaged) && Number.isFinite(r?.cleared)) out.byModel[model] = { engaged: r.engaged, cleared: r.cleared };
    }
  }
  if (Array.isArray(v.seen)) out.seen = v.seen.filter((i): i is number => Number.isInteger(i) && i >= 0);
  if (v.kills && typeof v.kills === 'object') {
    for (const [index, n] of Object.entries(v.kills as Record<string, unknown>)) if (Number.isInteger(n) && (n as number) > 0) out.kills[index] = n as number;
  }
  return out;
}

export function coerceDaily(value: unknown): DailyState | undefined {
  const v = value as Partial<DailyState> | undefined;
  if (!v || typeof v.date !== 'string' || typeof v.questId !== 'string' || !Number.isFinite(v.progress)) return undefined;
  return { date: v.date, questId: v.questId, progress: v.progress as number, done: Boolean(v.done) };
}
