import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnMonster } from '../src/monsters.ts';

test('floor 0 on normal difficulty uses the first monster at its base HP', () => {
  const monster = spawnMonster(0, 'normal');
  assert.equal(monster.name, '버그 고블린');
  assert.equal(monster.maxHp, 60);
  assert.ok(monster.art.length > 0);
});

test('HP increases as the floor number increases', () => {
  const floor0 = spawnMonster(0, 'normal');
  const floor5 = spawnMonster(5, 'normal');
  assert.ok(floor5.maxHp > floor0.maxHp);
});

test('hard difficulty deals more HP than easy at the same floor', () => {
  const easy = spawnMonster(2, 'easy');
  const hard = spawnMonster(2, 'hard');
  assert.ok(hard.maxHp > easy.maxHp);
});

test('each theme walks its own roster order, then starts over', async () => {
  const { THEME_RULES } = await import('../src/themes.ts');
  const first = spawnMonster(0, 'normal');
  assert.equal(first.index, 0, 'adventure starts in roster 0');
  assert.equal(spawnMonster(6, 'normal').index, 6, 'adventure chapter 2 = roster 1');
  assert.equal(spawnMonster(12, 'normal').index, 30, 'adventure chapter 3 = its own roster (5)');
  assert.equal(spawnMonster(0, 'normal', 'demon-king').index, 36, 'demon-king opens with its own roster (6)');
  assert.equal(spawnMonster(6, 'normal', 'debug-quest').index, 42, 'debug-quest chapter 2 = its own roster (7)');
  const loop = THEME_RULES[0].rosters.length * 6;
  const wrap = spawnMonster(loop, 'normal');
  assert.equal(wrap.name, first.name);
  assert.ok(wrap.maxHp > first.maxHp, 'a later floor still scales HP up even with the same monster');
});

test('every theme uses every shared roster and exactly one roster of its own', async () => {
  const { THEME_RULES } = await import('../src/themes.ts');
  const owned = THEME_RULES.map((t) => t.rosters.filter((r) => THEME_RULES.every((o) => o === t || !o.rosters.includes(r))));
  assert.deepEqual(owned.map((o) => o.length), THEME_RULES.map(() => 1));
});

test('listMonsters covers every monster once, with bosses last in each roster', async () => {
  const { listMonsters, ROSTER_COUNT } = await import('../src/monsters.ts');
  const all = listMonsters();
  assert.equal(all.length, ROSTER_COUNT * 6);
  assert.deepEqual(all.map((m) => m.index), all.map((_, i) => i));
  assert.equal(all.filter((m) => m.isBoss).length, ROSTER_COUNT);
});

test('every roster has 6 monsters with unique names', async () => {
  const { listMonsters, MONSTER_COUNT, ROSTER_COUNT, ROSTER_NAMES } = await import('../src/monsters.ts');
  assert.equal(MONSTER_COUNT, 6);
  const names = listMonsters().map((m) => m.name);
  assert.equal(names.length, MONSTER_COUNT * ROSTER_COUNT);
  assert.equal(new Set(names).size, names.length);
  assert.equal(ROSTER_NAMES.length, ROSTER_COUNT);
});
