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

test('monster rotation cycles back to the first monster', () => {
  const first = spawnMonster(0, 'normal');
  const wrapped = spawnMonster(6, 'normal'); // 6 monsters in the list, so floor 6 wraps to index 0
  assert.equal(wrapped.name, first.name);
  assert.ok(wrapped.maxHp > first.maxHp, 'wrapped floor still scales HP up even with the same monster');
});
