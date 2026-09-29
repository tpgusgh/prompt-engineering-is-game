import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MONSTER_COUNT } from './monsters.ts';
import type { BattleSummary } from './battle.ts';
import { VITALITY_HP } from './stats.ts';
import { getHeroClass, DEFAULT_CLASS_ID, type HeroClassId } from './classes.ts';
import { coerceClaudeSettings, DEFAULT_CLAUDE_SETTINGS, type ClaudeSettings } from './claude-settings.ts';

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
}

const BASE_MAX_HP = 100;
const DEFAULT_PROFILE: Profile = { level: 1, xp: 0, totalWins: 0, totalBattles: 0, storyFloors: {}, coins: 0, bag: {}, maxHp: BASE_MAX_HP, swordLevel: 0, heroClass: DEFAULT_CLASS_ID, claude: DEFAULT_CLAUDE_SETTINGS };

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
  };
}

export async function loadProfile(homeDir: string = os.homedir()): Promise<Profile> {
  try {
    const raw = await fs.readFile(profilePath(homeDir), 'utf-8');
    const parsed = JSON.parse(raw);
    return coerceProfile(parsed);
  } catch {
    return { ...DEFAULT_PROFILE, storyFloors: {}, bag: {} };
  }
}

export async function saveProfile(profile: Profile, homeDir: string = os.homedir()): Promise<void> {
  const filePath = profilePath(homeDir);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(profile, null, 2), 'utf-8');
}

// Flat curve: every XP_PER_LEVEL XP is a level (the UI's XP bar fills toward it).
export const XP_PER_LEVEL = 100;

export function levelForXp(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
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
  // Vitality is a per-run stat: strip its bonus so only permanent max HP
  // (life crystals) carries over.
  updated.maxHp = Math.max(BASE_MAX_HP, summary.playerMaxHp - summary.stats.vitality * VITALITY_HP);
  updated.swordLevel = summary.swordLevel;
  if (themeId) {
    const reached = summary.defeated ? summary.chaptersCleared * MONSTER_COUNT : summary.nextFloor;
    updated.storyFloors = { ...profile.storyFloors, [themeId]: Math.max(profile.storyFloors[themeId] ?? 0, reached) };
  }
  return updated;
}
