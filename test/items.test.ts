import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, SHOP_SIZE, shopOffer, rollChestItem } from '../src/items.ts';

test('the shop shows 5 items, rotating each visit through the whole stock (contracts aside)', () => {
  const seen = new Set<string>();
  for (let visit = 0; visit < 5; visit++) {
    const offer = shopOffer(visit, [], () => 0.99);
    assert.equal(offer.length, SHOP_SIZE);
    offer.forEach((i) => seen.add(i.id));
  }
  assert.equal(seen.size, ITEMS.length - 2, 'every other item comes around');
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

test('contracts are rare at the merchant: off the rotation, 10% a visit for one on the last slot', async () => {
  const { CONTRACT_SHOP_CHANCE } = await import('../src/items.ts');
  assert.equal(CONTRACT_SHOP_CHANCE, 0.1);
  for (let v = 0; v < 12; v++) {
    const ids = shopOffer(v, [], () => 0.99).map((i) => i.id);
    assert.ok(!ids.includes('contract') && !ids.includes('devilContract'), `visit ${v}`);
  }
  const god = shopOffer(0, [], seq(0.05, 0.2)).map((i) => i.id);
  assert.equal(god.at(-1), 'contract');
  const devil = shopOffer(0, [], seq(0.05, 0.8)).map((i) => i.id);
  assert.equal(devil.at(-1), 'devilContract');
  assert.equal(devil.length, 4);
});

function seq(...values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}


test('night market: 4 different goods, 30-70% off today\'s price, boss relics can show up', async () => {
  const { nightMarketOffer, priceAt, getItem, BOSS_ITEMS } = await import('../src/items.ts');
  let saw = false;
  for (let s = 0; s < 40; s++) {
    let x = s / 40;
    const random = () => (x = (x * 9301 + 0.4927) % 1);
    const offer = nightMarketOffer(5, random);
    assert.equal(offer.length, 4);
    assert.equal(new Set(offer.map((i) => i.id)).size, 4);
    for (const i of offer) {
      assert.ok(i.discount >= 0.3 && i.discount <= 0.7, `${i.discount}`);
      assert.equal(i.original, priceAt(getItem(i.id)!, 5));
      assert.equal(i.price, Math.round(i.original * (1 - i.discount)));
      assert.notEqual(i.id, 'coinCharm');
    }
    if (offer.some((i) => BOSS_ITEMS.some((b) => b.id === i.id))) saw = true;
  }
  assert.ok(saw, 'relics are in the pool');
});
