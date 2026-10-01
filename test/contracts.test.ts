import test from 'node:test';
import assert from 'node:assert/strict';
import { GODS, DEMONS, signContract, contractMods, NO_CONTRACT_MODS, BREAK_PENALTY } from '../src/contracts.ts';

test('6 elemental gods and 7 demons, each with a trait', () => {
  assert.equal(GODS.length, 6);
  assert.equal(DEMONS.length, 7);
  for (const c of [...GODS, ...DEMONS]) assert.ok(c.name && c.text, c.id);
  for (const d of DEMONS) assert.ok(d.hpCost > 0 && d.hpCost < 1, d.id);
});

test('signing with no contract picks one at random of that kind', () => {
  const god = signContract(null, 'god', () => 0);
  assert.equal(god.broken, false);
  assert.deepEqual(god.contract, { kind: 'god', id: GODS[0].id });
  const demon = signContract(null, 'demon', () => 0.999);
  assert.deepEqual(demon.contract, { kind: 'demon', id: DEMONS[6].id });
});

test('any second contract (same kind or the other) breaks them all', () => {
  const again = signContract({ kind: 'god', id: 'fire' }, 'god', () => 0);
  assert.deepEqual(again, { contract: null, broken: true });
  const mixed = signContract({ kind: 'god', id: 'fire' }, 'demon', () => 0);
  assert.deepEqual(mixed, { contract: null, broken: true });
  assert.equal(BREAK_PENALTY, 0.1);
});

test('a god contract adds +5% to every hit plus its trait; demons have their own (all as ratios)', () => {
  assert.equal(NO_CONTRACT_MODS.hitMult, 1);
  assert.equal(contractMods({ kind: 'god', id: 'thunder' }).hitMult, 1.05);
  assert.equal(contractMods({ kind: 'god', id: 'thunder' }).actionMult, 1.3);
  assert.equal(contractMods({ kind: 'god', id: 'wind' }).actionMult, 1.15);
  assert.equal(contractMods({ kind: 'god', id: 'water' }).healPerTurnRatio, 0.03);
  assert.equal(contractMods({ kind: 'demon', id: 'gluttony' }).clearHealRatio, 0.2);
  assert.equal(contractMods({ kind: 'god', id: 'fire' }).critMult, 1.3);
  assert.equal(contractMods({ kind: 'demon', id: 'greed' }).coinMult, 1.5);
  assert.equal(contractMods({ kind: 'demon', id: 'greed' }).hitMult, 1);
  assert.equal(contractMods({ kind: 'demon', id: 'sloth' }).noActionHits, true);
  assert.equal(contractMods(undefined), NO_CONTRACT_MODS);
});
