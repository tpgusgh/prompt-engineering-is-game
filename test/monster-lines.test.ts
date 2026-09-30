import test from 'node:test';
import assert from 'node:assert/strict';
import { MONSTER_LINES, BOSS_LINES, MERCHANT_IDLE, BLACKSMITH_IDLE } from '../electron/renderer/monster-lines.js';
import { MONSTER_COUNT, ROSTER_COUNT } from '../src/monsters.ts';

const SITUATIONS = ['appear', 'idle', 'hit', 'crit', 'attack', 'blocked', 'lowHp', 'death', 'flee'];

test('every monster has lines for every situation (and a few idle ones to rotate)', () => {
  assert.equal(MONSTER_LINES.length, MONSTER_COUNT * ROSTER_COUNT);
  MONSTER_LINES.forEach((m, i) => {
    for (const s of SITUATIONS) assert.ok(Array.isArray(m[s]) && m[s].length > 0 && m[s].every((l) => typeof l === 'string' && l.trim()), `monster ${i}: ${s}`);
    assert.ok(m.idle.length >= 4, `monster ${i} idle`);
  });
});

test('bosses and shopkeepers have their own lines', () => {
  for (const s of ['appear', 'idle', 'lowHp', 'death']) assert.ok(BOSS_LINES[s].length > 0, s);
  assert.ok(MERCHANT_IDLE.length >= 3 && BLACKSMITH_IDLE.length >= 3);
});

test('every monster has its own SVG art', async () => {
  const { monsterSvg } = await import('../electron/renderer/monster-art.js');
  const arts = Array.from({ length: MONSTER_COUNT * ROSTER_COUNT }, (_, i) => monsterSvg(i, false));
  assert.equal(new Set(arts).size, arts.length);
});

test('every monster has a bestiary personality blurb', async () => {
  const { MONSTER_LORE } = await import('../electron/renderer/monster-lore.js');
  assert.equal(MONSTER_LORE.length, MONSTER_COUNT * ROSTER_COUNT);
  assert.ok(MONSTER_LORE.every((t) => typeof t === 'string' && t.length > 10));
});
