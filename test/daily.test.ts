import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyDungeon, dailyRandom, seededRandom, DAILY_CHAPTERS } from '../src/daily.ts';
import { runDungeon, type BattleEvent } from '../src/battle.ts';

test('the daily dungeon is the same for everyone on a date, and differs by date', () => {
  const a = dailyDungeon('2026-10-01');
  assert.deepEqual(a, dailyDungeon('2026-10-01'));
  assert.notDeepEqual(a.rosters, dailyDungeon('2026-10-02').rosters);
  assert.equal(a.rosters.length, DAILY_CHAPTERS);
  assert.equal(new Set(a.rosters).size, DAILY_CHAPTERS, 'no area twice');
  const r1 = dailyRandom('2026-10-01'), r2 = dailyRandom('2026-10-01');
  assert.deepEqual([r1(), r1(), r1()], [r2(), r2(), r2()]);
  const r = seededRandom(1);
  for (let i = 0; i < 100; i++) { const v = r(); assert.ok(v >= 0 && v < 1); }
});

test('a daily run uses that day\'s areas and cannot be saved', async () => {
  const day = dailyDungeon('2026-10-01');
  const events: BattleEvent[] = [];
  let i = 0;
  const inputs = ['/save 1', '/quit'];
  await runDungeon({
    runTurn: async () => ({ summary: 'ok', filesChanged: [], commandsRun: [] }),
    readInput: async () => inputs[i++] ?? null,
    onBattleEvent: (e) => events.push(e),
    cwd: '/f', difficulty: 'normal', chests: false, random: dailyRandom(day.date),
    themeId: day.themeId, rosters: day.rosters, daily: day.date,
  });
  const start = events.find((e) => e.type === 'floorStart');
  assert.ok(start?.type === 'floorStart' && start.monsterIndex === day.rosters[0] * 6);
  assert.equal(events.some((e) => e.type === 'snapshot'), false, 'no saves, not even autosaves');
  assert.ok(events.some((e) => e.type === 'saveFailed'));
});
