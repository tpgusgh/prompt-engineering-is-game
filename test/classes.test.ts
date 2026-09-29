import test from 'node:test';
import assert from 'node:assert/strict';
import { HERO_CLASSES, getHeroClass, weaponDisplayName, DEFAULT_CLASS_ID } from '../src/classes.ts';
import { WEAPONS } from '../src/weapons.ts';
import { SWORD_MAX_LEVEL } from '../src/forge.ts';

test('three classes, each naming every weapon (model) and every enhance level', () => {
  assert.deepEqual(HERO_CLASSES.map((c) => c.id), ['swordsman', 'wizard', 'archer']);
  for (const c of HERO_CLASSES) {
    for (const w of WEAPONS) assert.ok(c.weapons[w.model]?.name, `${c.id} names ${w.model}`);
    assert.equal(c.modifiers.length, SWORD_MAX_LEVEL + 1, `${c.id} has a prefix for +0..+${SWORD_MAX_LEVEL}`);
  }
});

test('weapon names differ by class for the same model', () => {
  const names = HERO_CLASSES.map((c) => c.weapons['claude-sonnet-5'].name);
  assert.equal(new Set(names).size, 3);
});

test('the enhance level puts a prefix on the class weapon name', () => {
  assert.equal(weaponDisplayName('wizard', 'claude-sonnet-5', 0), '초라한 마법지팡이');
  assert.equal(weaponDisplayName('wizard', 'claude-sonnet-5', 1), '그냥 마법지팡이');
  assert.equal(weaponDisplayName('archer', 'claude-haiku-4-5-20251001', 1), '그냥 단궁');
  assert.equal(weaponDisplayName('swordsman', 'claude-opus-5-5', 99), `${getHeroClass('swordsman').modifiers[SWORD_MAX_LEVEL]} 마검`, 'clamps above the max');
});

test('unknown classes and models fall back to defaults', () => {
  assert.equal(getHeroClass('nope').id, DEFAULT_CLASS_ID);
  assert.equal(weaponDisplayName('nope', 'nope', 0), '초라한 장검');
});
