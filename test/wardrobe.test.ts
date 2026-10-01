import test from 'node:test';
import assert from 'node:assert/strict';
import { buyCosmetic, wearCosmetic, cleanAvatar } from '../src/wardrobe.ts';
import { readFileSync } from 'node:fs';

const catalog = JSON.parse(readFileSync('electron/renderer/avatar/catalog.json', 'utf-8')).items;
const base = { coins: 500, wardrobe: [], avatar: {} } as never;

test('wardrobe: buy with coins once, then wear it; free items need no purchase', () => {
  const hair = catalog.find((i: { id: string }) => i.id === 'hair/hair_afro_black');
  assert.ok(hair.price > 0);
  const bought = buyCosmetic(base, catalog, 'hair/hair_afro_black');
  assert.ok('profile' in bought);
  assert.equal(bought.profile.coins, 500 - hair.price);
  assert.ok('error' in buyCosmetic(bought.profile, catalog, 'hair/hair_afro_black'), 'only once');
  assert.ok('error' in wearCosmetic(base, catalog, 'hair', 'hair/hair_afro_black'), 'must own it first');
  const worn = wearCosmetic(bought.profile, catalog, 'hair', 'hair/hair_afro_black');
  assert.ok('profile' in worn && worn.profile.avatar.hair === 'hair/hair_afro_black');
  assert.ok('profile' in wearCosmetic(base, catalog, 'body', 'characters/b_f_tan'), 'every body is free');
});

test('wardrobe: not enough coins, wrong slot, emptying a required slot are refused; optional slots can be emptied', () => {
  assert.ok('error' in buyCosmetic({ coins: 0, wardrobe: [] } as never, catalog, 'pets/pet_dragon_gold'));
  assert.ok('error' in wearCosmetic(base, catalog, 'hat', 'characters/b_f_tan'));
  assert.ok('error' in wearCosmetic(base, catalog, 'body', null));
  const off = wearCosmetic({ coins: 0, avatar: { pet: 'pets/cat' } } as never, catalog, 'pet', null);
  assert.ok('profile' in off && !off.profile.avatar.pet);
});

test('wardrobe: a look sent to the ranking keeps only valid slot → id pairs', () => {
  assert.deepEqual(cleanAvatar({ hair: 'hair/hair_afro_black', evil: '<script>', x: 5, '../a': 'b/c' }), { hair: 'hair/hair_afro_black' });
});
