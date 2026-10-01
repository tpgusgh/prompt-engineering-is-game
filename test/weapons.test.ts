import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, getWeapon, DEFAULT_WEAPON_ID } from '../src/weapons.ts';

test('weapons are ordered weakest to strongest by multiplier', () => {
  const multipliers = WEAPONS.map((w) => w.multiplier);
  assert.deepEqual(multipliers, [...multipliers].sort((a, b) => a - b));
});

test('weapons are Claude model families (no version numbers: the latest one is always used)', () => {
  assert.deepEqual(WEAPONS.map((w) => w.model), ['haiku', 'sonnet', 'opus', 'fable']);
});

test('getWeapon returns the matching weapon; an old versioned id maps to its family; unknown falls back', () => {
  const opus = WEAPONS.find((w) => w.model === 'opus');
  assert.ok(opus);
  assert.equal(getWeapon('opus'), opus);
  assert.equal(getWeapon('claude-opus-5-5'), opus, 'a save from before keeps its weapon');
  assert.equal(getWeapon('claude-haiku-4-5-20251001').model, 'haiku');
  assert.equal(getWeapon('nope').model, DEFAULT_WEAPON_ID);
  assert.equal(getWeapon(undefined).model, DEFAULT_WEAPON_ID);
});
