import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, getWeapon, DEFAULT_WEAPON_ID } from '../src/weapons.ts';

test('weapons are ordered weakest to strongest by multiplier', () => {
  const multipliers = WEAPONS.map((w) => w.multiplier);
  assert.deepEqual(multipliers, [...multipliers].sort((a, b) => a - b));
});

test('every weapon maps to a distinct Claude model id', () => {
  const models = WEAPONS.map((w) => w.model);
  assert.equal(new Set(models).size, models.length);
  assert.ok(models.every((m) => m.startsWith('claude-')));
});

test('getWeapon returns the matching weapon, falling back to the default for unknown ids', () => {
  const opus = WEAPONS.find((w) => w.model === 'claude-opus-5-5');
  assert.ok(opus);
  assert.equal(getWeapon('claude-opus-5-5'), opus);
  assert.equal(getWeapon('nope').model, DEFAULT_WEAPON_ID);
  assert.equal(getWeapon(undefined).model, DEFAULT_WEAPON_ID);
});
