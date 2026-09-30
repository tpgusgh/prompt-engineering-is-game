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

test('chapters cycle through the rosters, then start over', async () => {
  const { ROSTER_COUNT } = await import('../src/monsters.ts');
  const first = spawnMonster(0, 'normal');
  const ch2 = spawnMonster(6, 'normal');
  assert.notEqual(ch2.name, first.name);
  assert.equal(ch2.index, 6);
  assert.equal(spawnMonster(11, 'normal').index, 11, 'chapter 2 boss');
  const wrap = spawnMonster(ROSTER_COUNT * 6, 'normal');
  assert.equal(wrap.name, first.name);
  assert.equal(wrap.index, 0);
  assert.ok(wrap.maxHp > first.maxHp, 'a later floor still scales HP up even with the same monster');
});

test('listMonsters covers every monster once, with bosses last in each roster', async () => {
  const { listMonsters, ROSTER_COUNT } = await import('../src/monsters.ts');
  const all = listMonsters();
  assert.equal(all.length, ROSTER_COUNT * 6);
  assert.deepEqual(all.map((m) => m.index), all.map((_, i) => i));
  assert.equal(all.filter((m) => m.isBoss).length, ROSTER_COUNT);
});

test('every roster has 6 monsters with unique names', async () => {
  const { MONSTER_COUNT, ROSTER_COUNT } = await import('../src/monsters.ts');
  assert.equal(MONSTER_COUNT, 6);
  const names = Array.from({ length: MONSTER_COUNT * ROSTER_COUNT }, (_, i) => spawnMonster(Math.floor(i / 6) * 6 + (i % 6), 'normal').name);
  assert.equal(new Set(names).size, names.length);
});
