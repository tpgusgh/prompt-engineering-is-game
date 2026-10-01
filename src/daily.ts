// 일일 도전: one dungeon a day, the same for everyone — the date seeds which
// theme it's told in, which monster areas each chapter visits, and every
// roll (merchants, chests, flee). Always normal difficulty from floor 1, no
// saving (a reload would reroll the day), with its own daily ranking board.
import { ROSTER_NAMES } from './monsters.ts';
import { THEME_RULES } from './themes.ts';

// mulberry32: tiny, fast, good enough for game rolls.
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dateSeed(date: string): number {
  let h = 2166136261; // FNV-1a
  for (const ch of `promptbattle-daily:${date}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const DAILY_CHAPTERS = 10;

export interface DailyDungeon {
  date: string;
  themeId: string;
  rosters: number[]; // roster index per chapter
}

export function dailyDungeon(date: string): DailyDungeon {
  const random = seededRandom(dateSeed(date));
  const themeId = THEME_RULES[Math.floor(random() * THEME_RULES.length)].id;
  const pool = ROSTER_NAMES.map((_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return { date, themeId, rosters: pool.slice(0, DAILY_CHAPTERS) };
}

// The run's rolls for that day (separate stream from the layout).
export const dailyRandom = (date: string) => seededRandom(dateSeed(date) ^ 0x9e3779b9);

export const isDailyDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
