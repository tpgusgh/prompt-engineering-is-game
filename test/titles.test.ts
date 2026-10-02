import test from 'node:test';
import assert from 'node:assert/strict';
import { buyTitle, wearTitle, cleanBadge } from '../src/titles.ts';
import { TITLE_SHOP } from '../electron/renderer/title-shop.js';

const base = { coins: 500, titles: [] } as never;

test('title shop: buy once with coins, then wear it; null goes back to the level title', () => {
  const bug = TITLE_SHOP.find((t) => t.id === 'bug-hunter')!;
  const bought = buyTitle(base, TITLE_SHOP, 'bug-hunter');
  assert.ok('profile' in bought);
  assert.equal(bought.profile.coins, 500 - bug.price);
  assert.ok('error' in buyTitle(bought.profile, TITLE_SHOP, 'bug-hunter'), 'only once');
  assert.ok('error' in wearTitle(base, 'bug-hunter'), 'must own it first');
  const worn = wearTitle(bought.profile, 'bug-hunter');
  assert.ok('profile' in worn && worn.profile.badge === 'bug-hunter');
  const off = wearTitle(worn.profile, null);
  assert.ok('profile' in off && off.profile.badge === undefined);
});

test('title shop: not enough coins or an unknown title is refused', () => {
  assert.ok('error' in buyTitle({ coins: 0, titles: [] } as never, TITLE_SHOP, 'living-legend'));
  assert.ok('error' in buyTitle(base, TITLE_SHOP, 'nope'));
});

test('title shop: ids are unique and safe for the ranking; the ranking keeps only a valid id', () => {
  assert.equal(new Set(TITLE_SHOP.map((t) => t.id)).size, TITLE_SHOP.length);
  for (const t of TITLE_SHOP) assert.equal(cleanBadge(t.id), t.id);
  assert.equal(cleanBadge('<script>'), undefined);
  assert.equal(cleanBadge(5), undefined);
});

test('title shop: some titles need an achievement first; every title has a tier', () => {
  const locked = TITLE_SHOP.find((t) => t.requires === 'boss-3')!;
  assert.ok(locked);
  const rich = { coins: 99999, titles: [], achievements: [] } as never;
  const r = buyTitle(rich, TITLE_SHOP, locked.id);
  assert.ok('error' in r && /업적/.test(r.error));
  assert.ok('profile' in buyTitle({ coins: 99999, titles: [], achievements: ['boss-3'] } as never, TITLE_SHOP, locked.id));
  for (const t of TITLE_SHOP) assert.ok(['common', 'rare', 'epic', 'legend'].includes(t.tier), t.id);
});
