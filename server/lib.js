// Ranking backend logic (Vercel function in api/ranking.js). Pure over an
// injected Redis `run(commands)` so it can be tested without a server.
//
// Only the released app can submit: every request is HMAC-signed with an app
// secret injected at build time (not in the repo), each run needs a
// server-issued single-use token, and the server recomputes and sanity-checks
// the score. ponytail: a local game can't be fully trusted — someone who
// extracts the secret from the app binary can still forge a plausible run;
// the checks keep that expensive and bounded.
import crypto from 'node:crypto';

export const TOP_N = 100;
const BOARD = 'ranking:board';
const ENTRIES = 'ranking:entries';
const MAX_SKEW_MS = 5 * 60_000; // request timestamps must be this fresh
const MIN_RUN_MS = 30_000; // a run token must be at least this old to submit
const MAX_RUN_MS = 7 * 24 * 3600_000;
const FLOORS_PER_MINUTE = 6; // generous: an AI turn takes seconds at best
const RATE_LIMIT_S = 20;

const DIFFICULTY_MULT = { easy: 0.7, normal: 1, hard: 1.5 };

// Keep in sync with src/ranking.ts (a test checks they agree).
export function scoreFor({ floors, bosses, xp, difficulty }) {
  return Math.round((floors * 100 + bosses * 400 + xp) * (DIFFICULTY_MULT[difficulty] ?? 1));
}

const hmac = (secret, text) => crypto.createHmac('sha256', secret).update(text).digest('hex');
const safeEqual = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// The body the app signs: stable key order.
export function canonical(body) {
  return JSON.stringify(body, Object.keys(body).sort());
}

export function issueRunToken(serverSecret, now, rid = crypto.randomBytes(12).toString('hex')) {
  const payload = Buffer.from(JSON.stringify({ rid, iat: now })).toString('base64url');
  return `${payload}.${hmac(serverSecret, payload)}`;
}

function readRunToken(serverSecret, token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!safeEqual(sig, hmac(serverSecret, payload))) return null;
  try {
    const { rid, iat } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    return typeof rid === 'string' && Number.isFinite(iat) ? { rid, iat } : null;
  } catch {
    return null;
  }
}

const cleanName = (name) =>
  typeof name === 'string' ? name.normalize('NFC').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 16) : '';

const isCount = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;

async function top(run) {
  const [ids] = await run([['ZREVRANGE', BOARD, '0', String(TOP_N - 1), 'WITHSCORES']]);
  const pairs = [];
  for (let i = 0; i < (ids?.length ?? 0); i += 2) pairs.push([ids[i], Number(ids[i + 1])]);
  if (!pairs.length) return [];
  const [details] = await run([['HMGET', ENTRIES, ...pairs.map(([id]) => id)]]);
  return pairs.map(([id, score], i) => {
    let d = {};
    try {
      d = JSON.parse(details[i] ?? '{}');
    } catch {}
    return { rank: i + 1, score, ...d };
  });
}

// method/path/body/headers → { status, body }.
export async function handle({ method, query = {}, body = {}, headers = {}, ip = '' }, { run, env, now = Date.now() }) {
  const appSecret = env.RANKING_APP_SECRET;
  const serverSecret = env.RANKING_SERVER_SECRET;
  if (!appSecret || !serverSecret) return { status: 500, body: { error: 'server not configured' } };

  if (method === 'GET') return { status: 200, body: { entries: await top(run) } };
  if (method !== 'POST') return { status: 405, body: { error: 'method not allowed' } };

  // Everything below must come from the app: signed, fresh.
  const signature = headers['x-signature'];
  if (!safeEqual(signature, hmac(appSecret, canonical(body)))) return { status: 401, body: { error: 'bad signature' } };
  if (!Number.isFinite(body.ts) || Math.abs(now - body.ts) > MAX_SKEW_MS) return { status: 401, body: { error: 'stale request' } };

  if (query.action === 'start') return { status: 200, body: { runToken: issueRunToken(serverSecret, now) } };

  const run0 = readRunToken(serverSecret, body.runToken);
  if (!run0) return { status: 401, body: { error: 'bad run token' } };
  const age = now - run0.iat;
  if (age < MIN_RUN_MS || age > MAX_RUN_MS) return { status: 400, body: { error: 'run too short or too old' } };

  const name = cleanName(body.name);
  const { floors, bosses, xp, difficulty } = body;
  if (!name) return { status: 400, body: { error: 'name required' } };
  if (!isCount(floors, 10_000) || !isCount(bosses, 2_000) || !isCount(xp, 10_000_000) || !(difficulty in DIFFICULTY_MULT)) {
    return { status: 400, body: { error: 'bad stats' } };
  }
  if (bosses > Math.ceil(floors / 6)) return { status: 400, body: { error: 'impossible run' } };
  if (floors > (age / 60_000) * FLOORS_PER_MINUTE + 5) return { status: 400, body: { error: 'impossible run' } };
  const score = scoreFor({ floors, bosses, xp, difficulty });
  if (body.score !== score) return { status: 400, body: { error: 'score mismatch' } };
  if (score <= 0) return { status: 400, body: { error: 'nothing to rank' } };

  // One submission per run token, and a short cooldown per address.
  const [fresh, allowed] = await run([
    ['SET', `ranking:used:${run0.rid}`, '1', 'NX', 'EX', String(Math.ceil(MAX_RUN_MS / 1000))],
    ['SET', `ranking:ip:${ip || 'unknown'}`, '1', 'NX', 'EX', String(RATE_LIMIT_S)],
  ]);
  if (fresh !== 'OK') return { status: 409, body: { error: 'run already submitted' } };
  if (allowed !== 'OK') return { status: 429, body: { error: 'too many submissions, wait a moment' } };

  // Only a top-100 score is stored: anything lower is compared, then dropped.
  const [count, lowest] = await run([['ZCARD', BOARD], ['ZRANGE', BOARD, '0', '0', 'WITHSCORES']]);
  if (count >= TOP_N && lowest?.length && score <= Number(lowest[1])) {
    return { status: 200, body: { rank: null, score, kept: false } };
  }

  const id = run0.rid;
  const entry = {
    name,
    floors,
    bosses,
    difficulty,
    theme: typeof body.theme === 'string' ? body.theme.slice(0, 24) : '',
    heroClass: typeof body.heroClass === 'string' ? body.heroClass.slice(0, 16) : '',
    level: isCount(body.level, 100_000) ? body.level : 1,
    at: now,
  };
  await run([
    ['ZADD', BOARD, String(score), id],
    ['HSET', ENTRIES, id, JSON.stringify(entry)],
  ]);
  // Keep the top 100: drop the rest and their details.
  const [card] = await run([['ZCARD', BOARD]]);
  if (card > TOP_N) {
    const [dropped] = await run([['ZRANGE', BOARD, '0', String(card - TOP_N - 1)]]);
    await run([['ZREMRANGEBYRANK', BOARD, '0', String(card - TOP_N - 1)], ...(dropped.length ? [['HDEL', ENTRIES, ...dropped]] : [])]);
  }
  const [rank] = await run([['ZREVRANK', BOARD, id]]);
  return { status: 200, body: { rank: rank === null ? null : rank + 1, score, kept: rank !== null } };
}

// Upstash Redis REST pipeline. The Vercel Marketplace integration names its
// variables KV_REST_API_URL/TOKEN (or with a custom prefix, e.g.
// STORAGE_KV_REST_API_URL); a direct Upstash setup uses UPSTASH_REDIS_REST_*.
const findEnv = (env, suffixes) => {
  for (const suffix of suffixes) {
    const key = Object.keys(env).find((k) => k === suffix || k.endsWith(`_${suffix}`));
    if (key && env[key]) return env[key];
  }
  return undefined;
};
export function upstash(env) {
  const url = findEnv(env, ['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL']);
  const token = findEnv(env, ['KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN']);
  return async (commands) => {
    if (!url || !token) throw new Error('redis not configured (connect Upstash for Redis to the project, then redeploy)');
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
    });
    if (!res.ok) throw new Error(`redis ${res.status}`);
    const out = await res.json();
    return out.map((r) => {
      if (r.error) throw new Error(r.error);
      return r.result;
    });
  };
}
