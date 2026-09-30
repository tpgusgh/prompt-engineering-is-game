import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, SHOP_SIZE, shopOffer, rollChestItem } from '../src/items.ts';

test('the shop shows 5 items, rotating each visit through the whole stock', () => {
  const seen = new Set<string>();
  for (let visit = 0; visit < 5; visit++) {
    const offer = shopOffer(visit, []);
    assert.equal(offer.length, SHOP_SIZE);
    offer.forEach((i) => seen.add(i.id));
  }
  assert.equal(seen.size, ITEMS.length, 'every item comes around');
});

test('the coin charm is sold only until owned', () => {
  const all = Array.from({ length: 5 }, (_, v) => shopOffer(v, ['coinCharm'])).flat();
  assert.ok(!all.some((i) => i.id === 'coinCharm'));
});

test('chest items drop by chance, better grades more often and better loot', () => {
  assert.equal(rollChestItem('wood', () => 0.5), null, 'wood: 5% chance');
  assert.ok(rollChestItem('legend', () => 0.1), 'legend: 80%');
  // First roll decides the drop (0 = always), the second picks from the table.
  const picks = new Set(Array.from({ length: 6 }, (_, i) => { const rolls = [0, i / 6]; return rollChestItem('gold', () => rolls.shift() ?? 0)?.id; }));
  assert.deepEqual([...picks].sort(), ['amulet', 'contract', 'devilContract', 'elixir', 'scroll', 'whetstone']);
});
