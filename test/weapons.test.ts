import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, getWeapon, DEFAULT_WEAPON_ID, sameTierOn, providerOf } from '../src/weapons.ts';

test('each AI\'s weapons are ordered weakest to strongest by multiplier', () => {
  for (const p of ['claude', 'codex', 'grok']) {
    const multipliers = WEAPONS.filter((w) => w.provider === p).map((w) => w.multiplier);
    assert.deepEqual(multipliers, [...multipliers].sort((a, b) => a - b));
  }
});

test('weapons are model families (no version numbers: the latest one is always used), Claude and Codex in matching tiers', () => {
  assert.deepEqual(WEAPONS.map((w) => w.model), ['haiku', 'sonnet', 'opus', 'fable', 'codex:luna', 'codex:terra', 'codex:sol', 'codex:astra', 'grok:spark', 'grok:kindle', 'grok:flare', 'grok:nova', 'gemini:flash-lite', 'gemini:flash', 'gemini:auto', 'gemini:pro']);
  assert.equal(sameTierOn('opus', 'gemini'), 'gemini:auto');
  assert.equal(sameTierOn('gemini:flash-lite', 'grok'), 'grok:spark');
  assert.equal(providerOf('gemini:flash-lite'), 'gemini');
  assert.equal(getWeapon('gemini:flash').multiplier, getWeapon('sonnet').multiplier);
  assert.equal(sameTierOn('opus', 'codex'), 'codex:sol');
  assert.equal(sameTierOn('codex:luna', 'claude'), 'haiku');
  assert.equal(sameTierOn('sonnet', 'claude'), 'sonnet');
  assert.equal(sameTierOn('opus', 'grok'), 'grok:flare');
  assert.equal(sameTierOn('grok:nova', 'claude'), 'fable');
  assert.equal(sameTierOn('grok:spark', 'codex'), 'codex:luna');
  assert.equal(providerOf('codex:astra'), 'codex');
  assert.equal(providerOf('grok:kindle'), 'grok');
  assert.equal(getWeapon('codex:sol').multiplier, getWeapon('opus').multiplier);
  assert.equal(getWeapon('grok:nova').multiplier, getWeapon('fable').multiplier);
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
