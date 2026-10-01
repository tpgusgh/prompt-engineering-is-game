import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyProgress, emptyRecords, emptyRunStats, isTestCommand, dailyQuestFor, currentDaily, coerceRecords, DAILY_QUESTS,
} from '../src/progress.ts';

test('isTestCommand spots common test runners, not other commands', () => {
  for (const c of ['npm test', 'npm run test -- --watch=false', 'pnpm test', 'pytest -q', 'go test ./...', 'cargo test', 'node --test test/*.ts', 'npx vitest run', 'python -m pytest', './gradlew clean test'])
    assert.ok(isTestCommand(c), c);
  for (const c of ['npm install', 'ls test/', 'cat latest.txt', 'git commit -m "test"']) assert.ok(!isTestCommand(c), c);
});

test('records add counts, keep maxima for best hit and longest turn, and merge per-model floors', () => {
  const run = { ...emptyRunStats(), turns: 2, bestHit: 50, longestTurnMs: 1000, byModel: { sonnet: { engaged: 2, cleared: 1 } } };
  const first = applyProgress({ records: emptyRecords(), achievements: [] }, run, { swordLevel: 1, level: 1 }, '2026-09-30');
  const second = applyProgress({ records: first.records, achievements: first.achievements }, { ...run, bestHit: 30 }, { swordLevel: 0, level: 2 }, '2026-09-30');
  assert.equal(second.records.turns, 4);
  assert.equal(second.records.bestHit, 50);
  assert.deepEqual(second.records.byModel.sonnet, { engaged: 4, cleared: 2 });
  assert.equal(second.records.runs, 2);
  assert.equal(second.records.maxSwordLevel, 1);
  assert.equal(second.records.maxLevel, 2);
});

test('achievements unlock once and pay their coins', () => {
  const run = { ...emptyRunStats(), floorsCleared: 1, bossesDefeated: 1 };
  const r = applyProgress({ records: emptyRecords(), achievements: [] }, run, { swordLevel: 0, level: 1 }, '2026-09-30');
  assert.deepEqual(r.unlocked.map((a) => a.id).sort(), ['first-boss', 'first-win']);
  const again = applyProgress({ records: r.records, achievements: r.achievements }, run, { swordLevel: 0, level: 1 }, '2026-09-30');
  assert.equal(again.unlocked.length, 0);
});

test('the daily quest is fixed per date, completes once and pays once', () => {
  assert.equal(dailyQuestFor('2026-09-30').id, dailyQuestFor('2026-09-30').id);
  const date = '2026-09-30';
  const quest = dailyQuestFor(date);
  const run = { ...emptyRunStats(), [quest.metric]: quest.target };
  const r = applyProgress({ records: emptyRecords(), achievements: [] }, run, { swordLevel: 0, level: 1 }, date);
  assert.equal(r.dailyCompleted?.id, quest.id);
  assert.ok(r.rewardCoins >= quest.coins);
  const again = applyProgress({ records: r.records, achievements: r.achievements, daily: r.daily }, run, { swordLevel: 0, level: 1 }, date);
  assert.equal(again.dailyCompleted, null);
  assert.equal(currentDaily(r.daily, '2026-10-01').done, false, 'a new day starts fresh');
});

test('every daily quest metric exists in RunStats', () => {
  const keys = Object.keys(emptyRunStats());
  for (const q of DAILY_QUESTS) assert.ok(keys.includes(q.metric), q.id);
});

test('coerceRecords drops junk values', () => {
  const r = coerceRecords({ turns: 5, tokens: -3, bestHit: 'x', byModel: { a: { engaged: 1, cleared: 1 }, b: { engaged: 'z' } } });
  assert.equal(r.turns, 5);
  assert.equal(r.tokens, 0);
  assert.equal(r.bestHit, 0);
  assert.deepEqual(Object.keys(r.byModel), ['a']);
});

test('the bestiary merges seen monsters and kill counts across runs', () => {
  const a = applyProgress({ records: emptyRecords(), achievements: [] }, { ...emptyRunStats(), seen: [0, 1], kills: { 0: 1 } }, { swordLevel: 0, level: 1 }, '2026-09-30');
  const b = applyProgress({ records: a.records, achievements: a.achievements }, { ...emptyRunStats(), seen: [1, 6], kills: { 0: 2, 6: 1 } }, { swordLevel: 0, level: 1 }, '2026-09-30');
  assert.deepEqual(b.records.seen, [0, 1, 6]);
  assert.deepEqual(b.records.kills, { 0: 3, 6: 1 });
  assert.deepEqual(coerceRecords(JSON.parse(JSON.stringify(b.records))).kills, { 0: 3, 6: 1 });
});

test('new achievements unlock from their records; typing speed and coins held keep the best, not a sum', async () => {
  const { ACHIEVEMENTS, emptyRecords, mergeRecords, emptyRunStats } = await import('../src/progress.ts');
  const run = { ...emptyRunStats(), contractsBroken: 1, deathsByContract: 1, bestTypingCpm: 720, richest: 3100, shelvesCleared: 1, nightBuys: 3, springsDrunk: 3, dailyRuns: 1, awakenedBossKills: 1, gearWorn: 2, bothAis: 1 };
  const r = mergeRecords(mergeRecords(emptyRecords(), run, { swordLevel: 0, level: 1 }), { ...emptyRunStats(), bestTypingCpm: 300, richest: 100 }, { swordLevel: 0, level: 1 });
  assert.equal(r.bestTypingCpm, 720);
  assert.equal(r.richest, 3100);
  for (const id of ['pact-breaker', 'pact-victim', 'typing-god', 'rich', 'shelf-sweep', 'night-regular', 'spring-lover', 'daily-runner', 'awakened-slayer', 'fully-geared', 'two-ais']) {
    assert.ok(ACHIEVEMENTS.find((a) => a.id === id)?.done(r), id);
  }
  assert.equal(ACHIEVEMENTS.find((a) => a.id === 'typing-god')?.done({ ...r, bestTypingCpm: 699 }), false);
});
