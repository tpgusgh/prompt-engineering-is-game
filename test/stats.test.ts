import test from 'node:test';
import assert from 'node:assert/strict';
import { upgradeStat, upgradeCost, attackMultiplier, defenseReduction, STATS } from '../src/stats.ts';
import type { Profile } from '../src/profile.ts';

const base: Profile = {
  level: 1, xp: 0, totalWins: 0, totalBattles: 0, storyFloors: {}, coins: 200, bag: {}, maxHp: 100,
  stats: { attack: 0, defense: 0, vitality: 0 },
};

test('upgrade costs scale with the next level', () => {
  assert.equal(upgradeCost('attack', 0), 50);
  assert.equal(upgradeCost('attack', 2), 150);
  assert.equal(upgradeCost('vitality', 0), 30);
});

test('upgrading spends coins and raises the level; vitality also raises max HP', () => {
  const a = upgradeStat(base, 'attack');
  assert.ok(a.ok);
  if (a.ok) {
    assert.equal(a.profile.coins, 150);
    assert.equal(a.profile.stats.attack, 1);
    assert.equal(a.profile.maxHp, 100);
  }
  const v = upgradeStat(base, 'vitality');
  assert.ok(v.ok && v.profile.maxHp === 110 && v.profile.stats.vitality === 1);
});

test('upgrade refuses when coins run short or the stat is maxed', () => {
  assert.equal(upgradeStat({ ...base, coins: 10 }, 'attack').ok, false);
  const maxDefense = STATS.find((s) => s.id === 'defense')!.maxLevel;
  assert.equal(upgradeStat({ ...base, coins: 9999, stats: { ...base.stats, defense: maxDefense } }, 'defense').ok, false);
});

test('stat effects: +10% damage per attack level, -10% counter per defense level', () => {
  assert.equal(attackMultiplier({ ...base.stats, attack: 3 }), 1.3);
  assert.equal(defenseReduction({ ...base.stats, defense: 2 }), 0.2);
});
