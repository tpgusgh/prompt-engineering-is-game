import test from 'node:test';
import assert from 'node:assert/strict';
import { monsterSvg, merchantSvg, blacksmithSvg, chestSvg } from '../electron/renderer/monster-art.js';

const ids = (svg: string) => [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
const refs = (svg: string) => [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);

test('every drawing gets its own gradient ids, so two on one page (battle + bestiary) never share one', () => {
  const drawings = [monsterSvg(0, true), monsterSvg(0, true), merchantSvg(), blacksmithSvg(), chestSvg('gold'), chestSvg('gold', true)];
  const all = drawings.flatMap(ids);
  assert.ok(all.length > 0);
  assert.equal(new Set(all).size, all.length, 'no id repeats across drawings');
  for (const svg of drawings) {
    const own = new Set(ids(svg));
    for (const r of refs(svg)) assert.ok(own.has(r), `url(#${r}) points inside its own drawing`);
  }
});
