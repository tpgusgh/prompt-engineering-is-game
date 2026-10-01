#!/usr/bin/env node
// Builds electron/renderer/avatar/catalog.json from the image folders: each
// PNG becomes an item with its slot, price and name parts. Run after adding
// art: `node scripts/build-avatar.mjs`. Names are put together from the parts
// in the file name (see WORDS in electron/renderer/avatar.js).
import { readdirSync, writeFileSync } from 'node:fs';

const ROOT = 'electron/renderer/avatar';
// Folder → slot (christmas items go by their name).
const slotOf = (folder, name) => {
  if (folder === 'christmas') return name.startsWith('hat_') ? 'hat' : name.startsWith('weapon_') ? 'weapon' : 'outfit';
  if (folder === 'accessories') return /glasses/.test(name) ? 'face' : 'hat';
  return { characters: 'body', eyes: 'eyes', expressions: 'mouth', hair: 'hair', outfits: 'outfit', socks: 'socks', shoes: 'shoes', weapons: 'weapon', pets: 'pet' }[folder];
};
const BASE_PRICE = { body: 0, eyes: 60, mouth: 40, hair: 120, outfit: 180, socks: 40, shoes: 90, hat: 200, face: 150, weapon: 250, pet: 400 };
// Free from the start: every body, and a plain look for each part.
const FREE = new Set(['eyes/eye_normal', 'eyes/eye_dot', 'expressions/expr_smile', 'expressions/expr_mouth_flat', 'hair/hair_short_black', 'hair/hair_short_brown', 'outfits/hoodie', 'socks/socks_white', 'shoes/shoes_sneaker_white']);
const PREMIUM = /crown|dragon|unicorn|rainbow|gold|xmas|santa|reindeer|snowman|gingerbread|elf|lolita|scythe|spellbook|glitter|gradient|mermaid/;

const items = [];
for (const folder of readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
  for (const file of readdirSync(`${ROOT}/${folder}`).filter((f) => f.endsWith('.png')).sort()) {
    const name = file.replace(/\.png$/, '');
    const slot = slotOf(folder, name);
    if (!slot) continue;
    const id = `${folder}/${name}`;
    const parts = name.replace(/^(expr|eye|hair|shoes|socks|weapon|pet|hat|xmas|casual|b)_/, '').split('_');
    const price = slot === 'body' || FREE.has(id) ? 0 : Math.round(BASE_PRICE[slot] * (PREMIUM.test(name) ? 2 : 1));
    items.push({ id, slot, price, parts });
  }
}
writeFileSync(`${ROOT}/catalog.json`, JSON.stringify({ slots: Object.keys(BASE_PRICE), items }, null, 1) + '\n');
console.log(`${items.length} items`);
