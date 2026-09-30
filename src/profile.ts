import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MONSTER_COUNT, spawnMonster } from './monsters.ts';
import type { BattleSummary } from './battle.ts';
import { getHeroClass, DEFAULT_CLASS_ID, type HeroClassId } from './classes.ts';
import { coerceClaudeSettings, DEFAULT_CLAUDE_SETTINGS, type ClaudeSettings } from './claude-settings.ts';
import { readStore, writeStore } from './store.ts';
import { applyProgress, coerceDaily, coerceRecords, emptyRecords, emptyRunStats, localDate, type DailyState, type ProgressResult, type Records } from './progress.ts';

export interface Profile {
  level: number;
  xp: number;
  totalWins: number;
  totalBattles: number;
  // Floor to resume from per story theme, so the next run picks the story up
  // exactly where "오늘 모험 종료하기" left it.
  storyFloors: Record<string, number>;
  coins: number;
  bag: Record<string, number>;
  maxHp: number;
  // Permanent: the blacksmith's +N. (Hero stats are per-run, not saved here.)
  swordLevel: number;
  // Last class picked on the setup screen (names the weapons).
  heroClass: HeroClassId;
  // Settings-tab controls for the game's Claude sessions.
  claude: ClaudeSettings;
  // Lifetime records (stats screen), unlocked achievement ids, today's quest.
  records: Records;
  achievements: string[];
  daily?: DailyState;
}

const BASE_MAX_HP = 100;
const DEFAULT_PROFILE: Profile = { level: 1, xp: 0, totalWins: 0, totalBattles: 0, storyFloors: {}, coins: 0, bag: {}, maxHp: BASE_MAX_HP, swordLevel: 0, heroClass: DEFAULT_CLASS_ID, claude: DEFAULT_CLAUDE_SETTINGS, records: emptyRecords(), achievements: [] };

function profilePath(homeDir: string): string {
  return path.join(homeDir, '.promptbattle', 'profile.json');
}

function isValidCount(value: unknown, min: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min;
}

function coerceCounts(value: unknown, min: number): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, count] of Object.entries(value)) {
    if (isValidCount(count, min)) out[key] = count;
  }
  return out;
}

// Older profiles saved chapters cleared (storyChapters); resume those at the
// start of the next chapter.
function coerceStoryFloors(p: Record<string, unknown> | null | undefined): Record<string, number> {
  const legacy = coerceCounts(p?.storyChapters, 0);
  const out: Record<string, number> = {};
  for (const [themeId, chapters] of Object.entries(legacy)) out[themeId] = chapters * MONSTER_COUNT;
  return { ...out, ...coerceCounts(p?.storyFloors, 0) };
}

// Profiles from before records existed: what they already show — wins,
// level, sword, and the story floors reached count as monsters met (and the
// ones before it as defeated) in the bestiary.
function legacyRecords(p: Record<string, unknown> | null | undefined): Records {
  const floors = Object.values(coerceStoryFloors(p));
  const reached = floors.length ? Math.max(...floors) : 0;
  const seen = Array.from({ length: reached + 1 }, (_, floor) => spawnMonster(floor, 'normal').index);
  const kills: Record<string, number> = {};
  for (let floor = 0; floor < reached; floor++) {
    const index = spawnMonster(floor, 'normal').index;
    kills[index] = (kills[index] ?? 0) + 1;
  }
  return {
    ...emptyRecords(),
    floorsCleared: isValidCount(p?.totalWins, 0) ? p.totalWins : 0,
    maxLevel: isValidCount(p?.level, 1) ? p.level : 1,
    maxSwordLevel: isValidCount(p?.swordLevel, 0) ? p.swordLevel : 0,
    seen: [...new Set(seen)].sort((x, y) => x - y),
    kills,
  };
}

function coerceProfile(parsed: unknown): Profile {
  const p = parsed as Record<string, unknown> | null | undefined;
  return {
    level: isValidCount(p?.level, 1) ? p.level : DEFAULT_PROFILE.level,
    xp: isValidCount(p?.xp, 0) ? p.xp : DEFAULT_PROFILE.xp,
    totalWins: isValidCount(p?.totalWins, 0) ? p.totalWins : DEFAULT_PROFILE.totalWins,
    totalBattles: isValidCount(p?.totalBattles, 0) ? p.totalBattles : DEFAULT_PROFILE.totalBattles,
    storyFloors: coerceStoryFloors(p),
    coins: isValidCount(p?.coins, 0) ? p.coins : DEFAULT_PROFILE.coins,
    bag: coerceCounts(p?.bag, 1),
    maxHp: isValidCount(p?.maxHp, BASE_MAX_HP) ? p.maxHp : BASE_MAX_HP,
    swordLevel: isValidCount(p?.swordLevel, 0) ? p.swordLevel : 0,
    heroClass: getHeroClass(typeof p?.heroClass === 'string' ? p.heroClass : undefined).id,
    claude: coerceClaudeSettings(p?.claude),
    // Profiles from before records existed start from what they already show.
    records: p?.records ? coerceRecords(p.records) : legacyRecords(p),
    achievements: Array.isArray(p?.achievements) ? p.achievements.filter((a): a is string => typeof a === 'string') : [],
    ...(coerceDaily(p?.daily) ? { daily: coerceDaily(p?.daily) } : {}),
  };
}

export async function loadProfile(homeDir: string = os.homedir()): Promise<Profile> {
  try {
    return coerceProfile(await readStore(profilePath(homeDir), homeDir));
  } catch (err) {
    // Unreadable (not just missing): keep a copy before the next save replaces it.
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      await fs.copyFile(profilePath(homeDir), `${profilePath(homeDir)}.broken-${Date.now()}`).catch(() => {});
    }
    return { ...DEFAULT_PROFILE, storyFloors: {}, bag: {}, records: emptyRecords(), achievements: [] };
  }
}

export async function saveProfile(profile: Profile, homeDir: string = os.homedir()): Promise<void> {
  await writeStore(profilePath(homeDir), profile, homeDir);
}

// Flat curve: every XP_PER_LEVEL XP is a level (the UI's XP bar fills toward it).
export const XP_PER_LEVEL = 100;

export function levelForXp(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

// Titles unlocked by hero level (the highest reached applies).
export const TITLES: { level: number; title: string }[] = [
  { level: 1, title: '견습 용사' },
  { level: 3, title: '초보 모험가' },
  { level: 5, title: '숙련된 모험가' },
  { level: 8, title: '베테랑 용사' },
  { level: 12, title: '버그 사냥꾼' },
  { level: 16, title: '프롬프트 마스터' },
  { level: 20, title: '전설의 프롬프터' },
  { level: 30, title: 'AI 파티의 왕' },
];

export function titleForLevel(level: number): string {
  return TITLES.filter((t) => t.level <= level).pop()?.title ?? TITLES[0].title;
}

// Leveling up pays off in every new run: it starts with one stat point per
// hero level (a loaded save keeps that run's own points).
export function startingStatPoints(profile: Profile): number {
  return profile.level;
}

export function addXp(profile: Profile, gained: number): Profile {
  const xp = profile.xp + gained;
  return { ...profile, xp, level: levelForXp(xp) };
}

// Folds a finished run into the profile. Defeat rewinds story progress to the
// start of the chapter it happened in; progress never moves backwards (a run
// started from floor 0 doesn't erase a further-along save).
export function applyRun(profile: Profile, summary: BattleSummary, themeId: string | undefined): Profile {
  const updated = addXp(profile, summary.xpGained);
  updated.totalWins += summary.floorsCleared;
  updated.totalBattles += summary.floorsEngaged;
  updated.coins = summary.coins;
  updated.bag = { ...summary.bag };
  // Max HP bonuses (vitality, life crystals) last one run: the next starts at base.
  updated.maxHp = BASE_MAX_HP;
  updated.swordLevel = summary.swordLevel;
  if (themeId) {
    const reached = summary.defeated ? summary.chaptersCleared * MONSTER_COUNT : summary.nextFloor;
    updated.storyFloors = { ...profile.storyFloors, [themeId]: Math.max(profile.storyFloors[themeId] ?? 0, reached) };
  }
  return updated;
}

// applyRun plus long-term progress: records, achievements and the daily
// quest, whose coin rewards are added to the profile.
export function finishRun(profile: Profile, summary: BattleSummary, themeId: string | undefined, date: string = localDate()): { profile: Profile; progress: ProgressResult } {
  const base = applyRun(profile, summary, themeId);
  const progress = applyProgress(
    { records: base.records, achievements: base.achievements, daily: base.daily },
    summary.runStats ?? emptyRunStats(),
    { swordLevel: base.swordLevel, level: base.level },
    date,
  );
  return {
    profile: { ...base, records: progress.records, achievements: progress.achievements, daily: progress.daily, coins: base.coins + progress.rewardCoins },
    progress,
  };
}
