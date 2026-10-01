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
  const strings = new Map<string, string>();
  const z = (k: string) => zsets.get(k) ?? zsets.set(k, new Map()).get(k)!;
  const h = (k: string) => hashes.get(k) ?? hashes.set(k, new Map()).get(k)!;
  const sorted = (k: string) => [...z(k).entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  const one = ([cmd, key, ...a]: string[]): unknown => {
    switch (cmd) {
      case 'ZADD': z(key).set(a[1], Number(a[0])); return 1;
      case 'ZCARD': return z(key).size;
      case 'ZREVRANGE': return sorted(key).reverse().slice(Number(a[0]), Number(a[1]) + 1).flatMap(([m, s]) => [m, String(s)]);
      case 'ZRANGE': { const r = sorted(key).slice(Number(a[0]), Number(a[1]) + 1); return a[2] === 'WITHSCORES' ? r.flatMap(([m, sc]) => [m, String(sc)]) : r.map(([m]) => m); }
      case 'ZREMRANGEBYRANK': for (const [m] of sorted(key).slice(Number(a[0]), Number(a[1]) + 1)) z(key).delete(m); return 1;
      case 'ZREVRANK': { const i = sorted(key).reverse().findIndex(([m]) => m === a[0]); return i === -1 ? null : i; }
      case 'HSET': h(key).set(a[0], a[1]); return 1;
      case 'HMGET': return a.map((f) => h(key).get(f) ?? null);
      case 'HDEL': for (const f of a) h(key).delete(f); return 1;
      case 'SET': if (keys.has(key)) return null; keys.add(key); return 'OK';
      case 'EXPIRE': return 1;
      case 'ZINCRBY': z(key).set(a[1], (z(key).get(a[1]) ?? 0) + Number(a[0])); return String(z(key).get(a[1]));
      case 'INCRBY': { const v = Number(strings.get(key) ?? 0) + Number(a[0]); strings.set(key, String(v)); return v; }
      case 'GET': return strings.get(key) ?? null;
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

test('a run continued from a later floor is timed from where it started', async () => {
  const run = fakeRedis();
  const t0 = 1_800_000_000_000;
  const token = await startRun(run, t0);
  const now = t0 + 2 * 60_000; // 2 minutes: at most 6*2+5 = 17 new floors
  const stats = { floors: 40, bosses: 6, xp: 50, difficulty: 'normal' };
  const call = (extra: Record<string, unknown>) => {
    const body = { ts: now, runToken: token, name: '미르', ...stats, score: scoreFor(stats), ...extra };
    return handle({ method: 'POST', ip: '3.3.3.3', ...signed(body) }, { run, env, now });
  };
  assert.equal((await call({})).status, 400, '40 floors in 2 minutes from the start is impossible');
  assert.equal((await call({ startFloor: 50 })).status, 400, 'cannot start past where you ended');
  assert.equal((await call({ startFloor: 30 })).status, 200, 'continued from floor 30: only 10 new floors');
});

test('boards: a run goes on all-time and this week; a daily run also on that day; GET picks the board', async () => {
  const run = fakeRedis();
  const t0 = Date.UTC(2026, 9, 1, 3); // 2026-10-01 03:00 UTC
  const now = t0 + 10 * 60_000;
  const submit = async (name: string, extra: Record<string, unknown>) => {
    const token = await startRun(run, t0);
    return handle({ method: 'POST', ip: name, ...signed(submission(token, now, { name, ...extra })) }, { run, env, now });
  };
  const plain = await submit('평범', {});
  assert.equal(plain.status, 200);
  const daily = await submit('일일', { daily: '2026-10-01', prestige: 2 });
  assert.equal(daily.status, 200);
  assert.equal(daily.body.dailyRank, 1);
  assert.equal((await submit('미래', { daily: '2026-10-05' })).status, 400, 'only around today');
  const get = (query: Record<string, string>) => handle({ method: 'GET', query }, { run, env, now });
  assert.equal((await get({})).body.entries.length, 2);
  assert.equal((await get({ board: 'weekly' })).body.entries.length, 2);
  const day = (await get({ board: 'daily', date: '2026-10-01' })).body.entries;
  assert.deepEqual(day.map((e: { name: string }) => e.name), ['일일']);
  assert.equal(day[0].prestige, 2);
  assert.equal((await get({ board: 'daily', date: '2026-09-01' })).body.entries.length, 0);
  assert.equal((await get({ board: 'nope' })).status, 400);
});

test('weekly raid: signed runs add their damage once each; the boss loses HP; GET shows the top', async () => {
  const run = fakeRedis();
  const t0 = Date.UTC(2026, 9, 1, 3);
  const now = t0 + 10 * 60_000;
  const hit = async (name: string, damage: number, ip: string, token?: string) => {
    const runToken = token ?? (await startRun(run, t0));
    const body = { ts: now, runToken, name, damage };
    return { res: await handle({ method: 'POST', query: { action: 'raid' }, ip, ...signed(body) }, { run, env, now }), runToken };
  };
  const a = await hit('미르', 12_000, '1.1.1.1');
  assert.equal(a.res.status, 200);
  assert.equal((await hit('미르', 12_000, '1.1.1.2', a.runToken)).res.status, 409, 'one contribution per run');
  assert.equal((await hit('용사', 3_000, '1.1.1.3')).res.status, 200);
  assert.equal((await hit('치터', 10_000_000, '1.1.1.4')).res.status, 400, 'too much for 10 minutes');
  assert.equal((await handle({ method: 'POST', query: { action: 'raid' }, ip: '9', body: { ts: now, runToken: 'x', name: 'n', damage: 5 }, headers: {} }, { run, env, now })).status, 401);
  const raid = (await handle({ method: 'GET', query: { board: 'raid' } }, { run, env, now })).body;
  assert.equal(raid.week, '2026-W40');
  assert.ok(raid.boss.name);
  assert.equal(raid.boss.hp, raid.boss.maxHp - 15_000);
  assert.deepEqual(raid.top.map((e: { name: string; damage: number }) => [e.name, e.damage]), [['미르', 12_000], ['용사', 3_000]]);
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

test('a score below the full top 100 is compared, then dropped without being stored', async () => {
  const run = fakeRedis();
  const written: string[][] = [];
  const spy = async (cmds: string[][]) => {
    written.push(...cmds.filter((c) => (c[0] === 'ZADD' || c[0] === 'HSET') && (c[1] === 'ranking:board' || c[1] === 'ranking:entries')));
    return run(cmds);
  };
  const t0 = 1_800_000_000_000;
  const now = t0 + 60 * 60_000;
  for (let i = 0; i < TOP_N; i++) {
    const token = await startRun(run, t0);
    const stats = { floors: 10, bosses: 0, xp: i, difficulty: 'normal' };
    await handle({ method: 'POST', ip: `10.0.1.${i}`, ...signed({ ts: now, runToken: token, name: `p${i}`, ...stats, score: scoreFor(stats) }) }, { run, env, now });
  }
  const token = await startRun(run, t0);
  const low = { floors: 1, bosses: 0, xp: 0, difficulty: 'easy' };
  const res = await handle({ method: 'POST', ip: '10.0.2.1', ...signed({ ts: now, runToken: token, name: 'low', ...low, score: scoreFor(low) }) }, { run: spy, env, now });
  assert.equal(res.status, 200);
  assert.equal(res.body.rank, null);
  assert.equal(res.body.kept, false);
  assert.deepEqual(written, [], 'nothing about the low run is stored on the all-time board');
});

test('missing Redis settings are reported plainly', async () => {
  const { upstash } = await import('../server/lib.js');
  await assert.rejects(upstash({})([['ZCARD', 'x']]), /redis not configured/);
});
