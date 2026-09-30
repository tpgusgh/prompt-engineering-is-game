import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { handle, canonical, scoreFor, TOP_N } from '../server/lib.js';
import { scoreFor as appScoreFor, signBody } from '../src/ranking.ts';

const env = { RANKING_APP_SECRET: 'app-secret', RANKING_SERVER_SECRET: 'server-secret' };

// Just the Redis commands the handler uses.
function fakeRedis() {
  const zsets = new Map<string, Map<string, number>>();
  const hashes = new Map<string, Map<string, string>>();
  const keys = new Set<string>();
  const z = (k: string) => zsets.get(k) ?? zsets.set(k, new Map()).get(k)!;
  const h = (k: string) => hashes.get(k) ?? hashes.set(k, new Map()).get(k)!;
  const sorted = (k: string) => [...z(k).entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  const one = ([cmd, key, ...a]: string[]): unknown => {
    switch (cmd) {
      case 'ZADD': z(key).set(a[1], Number(a[0])); return 1;
      case 'ZCARD': return z(key).size;
      case 'ZREVRANGE': return sorted(key).reverse().slice(Number(a[0]), Number(a[1]) + 1).flatMap(([m, s]) => [m, String(s)]);
      case 'ZRANGE': return sorted(key).slice(Number(a[0]), Number(a[1]) + 1).map(([m]) => m);
      case 'ZREMRANGEBYRANK': for (const [m] of sorted(key).slice(Number(a[0]), Number(a[1]) + 1)) z(key).delete(m); return 1;
      case 'ZREVRANK': { const i = sorted(key).reverse().findIndex(([m]) => m === a[0]); return i === -1 ? null : i; }
      case 'HSET': h(key).set(a[0], a[1]); return 1;
      case 'HMGET': return a.map((f) => h(key).get(f) ?? null);
      case 'HDEL': for (const f of a) h(key).delete(f); return 1;
      case 'SET': if (keys.has(key)) return null; keys.add(key); return 'OK';
      default: throw new Error(`unsupported ${cmd}`);
    }
  };
  return async (cmds: string[][]) => cmds.map(one);
}

const signed = (body: Record<string, unknown>) => ({ body, headers: { 'x-signature': signBody(body, env.RANKING_APP_SECRET) } });

async function startRun(run: ReturnType<typeof fakeRedis>, now: number) {
  const res = await handle({ method: 'POST', query: { action: 'start' }, ...signed({ ts: now }) }, { run, env, now });
  return res.body.runToken as string;
}

function submission(runToken: string, now: number, extra: Record<string, unknown> = {}) {
  const stats = { floors: 7, bosses: 1, xp: 180, difficulty: 'hard' };
  return { ts: now, runToken, name: '용사', ...stats, score: scoreFor(stats), theme: 'adventure', heroClass: 'wizard', level: 3, ...extra };
}

test('the app and the server compute the same score, and the app signs the same canonical body', () => {
  const stats = { floors: 7, bosses: 1, xp: 180, difficulty: 'hard' as const };
  assert.equal(appScoreFor(stats), scoreFor(stats));
  const body = { b: 1, a: 2 };
  assert.equal(signBody(body, 's'), crypto.createHmac('sha256', 's').update(canonical(body)).digest('hex'));
});

test('a signed run submits once and shows up in the top list', async () => {
  const run = fakeRedis();
  const t0 = 1_800_000_000_000;
  const token = await startRun(run, t0);
  const now = t0 + 10 * 60_000;
  const res = await handle({ method: 'POST', ip: '1.1.1.1', ...signed(submission(token, now)) }, { run, env, now });
  assert.equal(res.status, 200);
  assert.equal(res.body.rank, 1);
  const again = await handle({ method: 'POST', ip: '2.2.2.2', ...signed(submission(token, now)) }, { run, env, now });
  assert.equal(again.status, 409, 'a run token is single-use');
  const list = await handle({ method: 'GET' }, { run, env, now });
  assert.equal(list.body.entries[0].name, '용사');
  assert.equal(list.body.entries[0].score, scoreFor({ floors: 7, bosses: 1, xp: 180, difficulty: 'hard' }));
});

test('unsigned, forged, stale and implausible submissions are rejected', async () => {
  const run = fakeRedis();
  const t0 = 1_800_000_000_000;
  const token = await startRun(run, t0);
  const now = t0 + 10 * 60_000;
  const body = submission(token, now);
  const call = (b: Record<string, unknown>, headers: Record<string, string>) => handle({ method: 'POST', ip: '9.9.9.9', body: b, headers }, { run, env, now });
  assert.equal((await call(body, {})).status, 401, 'no signature (curl)');
  assert.equal((await call(body, { 'x-signature': signBody(body, 'wrong') })).status, 401, 'wrong secret');
  const tampered = { ...body, score: 999_999 };
  assert.equal((await call(tampered, { 'x-signature': signBody(body, env.RANKING_APP_SECRET) })).status, 401, 'body changed after signing');
  const inflated = submission(token, now, { score: 999_999 });
  assert.equal((await call(inflated, { 'x-signature': signBody(inflated, env.RANKING_APP_SECRET) })).status, 400, 'score must match the stats');
  const fake = submission('eyJyaWQiOiJ4IiwiaWF0IjowfQ.deadbeef', now);
  assert.equal((await call(fake, { 'x-signature': signBody(fake, env.RANKING_APP_SECRET) })).status, 401, 'forged run token');
  const old = submission(token, now - 10 * 60_000 - 1);
  assert.equal((await call(old, { 'x-signature': signBody(old, env.RANKING_APP_SECRET) })).status, 401, 'stale timestamp');
  const zero = submission(token, now, { floors: 0, bosses: 0, xp: 0, score: 0 });
  assert.equal((await call(zero, { 'x-signature': signBody(zero, env.RANKING_APP_SECRET) })).status, 400, 'a 0-point run is not ranked');
  const tooFast = submission(token, now, { floors: 500, bosses: 50, score: scoreFor({ floors: 500, bosses: 50, xp: 180, difficulty: 'hard' }) });
  assert.equal((await call(tooFast, { 'x-signature': signBody(tooFast, env.RANKING_APP_SECRET) })).status, 400, 'too many floors for the time');
});

test('only the top 100 are kept', async () => {
  const run = fakeRedis();
  const t0 = 1_800_000_000_000;
  const now = t0 + 60 * 60_000;
  for (let i = 0; i < TOP_N + 5; i++) {
    const token = await startRun(run, t0);
    const stats = { floors: 1 + (i % 50), bosses: 0, xp: i, difficulty: 'normal' };
    const body = { ts: now, runToken: token, name: `p${i}`, ...stats, score: scoreFor(stats) };
    const res = await handle({ method: 'POST', ip: `10.0.0.${i}`, ...signed(body) }, { run, env, now });
    assert.equal(res.status, 200);
  }
  const list = await handle({ method: 'GET' }, { run, env, now });
  assert.equal(list.body.entries.length, TOP_N);
  const scores = list.body.entries.map((e: { score: number }) => e.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
});
