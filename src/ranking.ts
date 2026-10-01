// Online ranking client (the server is server/ on Vercel). Requests are
// signed with an app secret that only release builds carry: CI writes it
// into electron/ranking-config.json (gitignored) from a GitHub secret, so a
// build from source — or a hand-made request — can't submit.
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Difficulty } from './monsters.ts';

const DIFFICULTY_MULT: Record<Difficulty, number> = { easy: 0.7, normal: 1, hard: 1.5 };

// Keep in sync with server/lib.js (a test checks they agree).
export function scoreFor({ floors, bosses, xp, difficulty }: { floors: number; bosses: number; xp: number; difficulty: string }): number {
  return Math.round((floors * 100 + bosses * 400 + xp) * (DIFFICULTY_MULT[difficulty as Difficulty] ?? 1));
}

export function signBody(body: Record<string, unknown>, secret: string): string {
  const canonical = JSON.stringify(body, Object.keys(body).sort());
  return crypto.createHmac('sha256', secret).update(canonical).digest('hex');
}

export interface RankingConfig {
  url: string;
  secret: string;
}

// The build-time config ({ url, key } with the secret lightly masked so it
// isn't a plain string in the bundle); env vars override for development.
export function loadRankingConfig(file: string, env: Record<string, string | undefined> = process.env): RankingConfig | null {
  let url = env.PROMPTBATTLE_RANKING_URL ?? '';
  let secret = env.PROMPTBATTLE_RANKING_SECRET ?? '';
  try {
    const raw = JSON.parse(readFileSync(file, 'utf-8'));
    url ||= typeof raw.url === 'string' ? raw.url : '';
    if (!secret && typeof raw.key === 'string') secret = unmask(raw.key);
  } catch {}
  // No secret (a build from source): the ranking can be viewed, not joined.
  return url ? { url: url.replace(/\/+$/, ''), secret } : null;
}

const MASK = 'prompt-battle';
export function mask(secret: string): string {
  return Buffer.from([...Buffer.from(secret)].map((b, i) => b ^ MASK.charCodeAt(i % MASK.length))).toString('base64');
}
function unmask(key: string): string {
  return Buffer.from([...Buffer.from(key, 'base64')].map((b, i) => b ^ MASK.charCodeAt(i % MASK.length))).toString('utf-8');
}

async function post(config: RankingConfig, query: string, body: Record<string, unknown>) {
  const res = await fetch(`${config.url}/api/ranking${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Signature': signBody(body, config.secret) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`);
  return data;
}

// A run token from the server when a run starts (needed to submit it later).
export async function startRankedRun(config: RankingConfig): Promise<string | null> {
  if (!config.secret) return null;
  try {
    const data = await post(config, '?action=start', { ts: Date.now() });
    return typeof data.runToken === 'string' ? data.runToken : null;
  } catch {
    return null;
  }
}

export interface RankedRun {
  runToken: string;
  name: string;
  // How far the run got (absolute floor), and where this play started.
  floors: number;
  startFloor: number;
  bosses: number;
  xp: number;
  difficulty: string;
  theme: string;
  heroClass: string;
  level: number;
  prestige?: number;
  avatar?: Record<string, string>; // the hero's look (cosmetic, shown in the table)
  // 일일 도전 date: the run also goes on that day's board.
  daily?: string;
}

export async function submitScore(config: RankingConfig, run: RankedRun): Promise<{ rank: number | null; score: number; weeklyRank: number | null; dailyRank?: number | null }> {
  const body = { ...run, score: scoreFor(run), ts: Date.now() };
  const data = await post(config, '', body);
  const rankOf = (v: unknown) => (typeof v === 'number' ? v : null);
  return { rank: rankOf(data.rank), score: Number(data.score), weeklyRank: rankOf(data.weeklyRank), ...('dailyRank' in data ? { dailyRank: rankOf(data.dailyRank) } : {}) };
}

// board: 'all' | 'weekly' | 'daily' (with the daily dungeon's date).
export async function fetchRanking(url: string, board = 'all', date?: string): Promise<unknown[]> {
  const query = new URLSearchParams({ board, ...(date ? { date } : {}) });
  const res = await fetch(`${url.replace(/\/+$/, '')}/api/ranking?${query}`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { entries?: unknown[] };
  return Array.isArray(data.entries) ? data.entries : [];
}
