import test from 'node:test';
import assert from 'node:assert/strict';
import { raiseStat, attackMultiplier, defenseReduction, allMaxed, STAT_MAX_LEVEL } from '../src/stats.ts';
import { enhanceOdds, swordMultiplier, SWORD_MAX_LEVEL } from '../src/forge.ts';

const zero = { attack: 0, defense: 0, vitality: 0 };

test('raiseStat adds one level up to the cap of 10', () => {
  assert.deepEqual(raiseStat(zero, 'attack'), { attack: 1, defense: 0, vitality: 0 });
  assert.equal(raiseStat({ ...zero, defense: STAT_MAX_LEVEL }, 'defense'), null);
  assert.equal(STAT_MAX_LEVEL, 10);
});

test('allMaxed only when every stat is at the cap', () => {
  assert.equal(allMaxed(zero), false);
  assert.equal(allMaxed({ attack: 10, defense: 10, vitality: 10 }), true);
});

test('stat effects: +10% damage per attack level, -5% counter per defense level', () => {
  assert.equal(attackMultiplier({ ...zero, attack: 3 }), 1.3);
  assert.equal(defenseReduction({ ...zero, defense: 10 }), 0.5);
});

test('enhance odds: success drops and break risk rises with level; cost grows', () => {
  const l0 = enhanceOdds(0);
  const l3 = enhanceOdds(3);
  const l9 = enhanceOdds(9);
  assert.equal(l0.breakChance, 0, 'no break risk at low levels');
  assert.ok(l3.breakChance > 0);
  assert.ok(l0.successChance > l3.successChance && l3.successChance > l9.successChance);
  assert.ok(l9.breakChance > l3.breakChance);
  assert.ok(l9.cost > l0.cost);
  assert.ok(l9.successChance >= 0.1);
  assert.equal(swordMultiplier(4), 1.4);
  assert.equal(SWORD_MAX_LEVEL, 10);
});
