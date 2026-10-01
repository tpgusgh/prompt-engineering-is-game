#!/usr/bin/env node
// Collects every Korean UI string into electron/renderer/i18n/strings.json:
// JS string and template literals (a `${...}` becomes {0}, {1}, ...) and the
// text, title, placeholder and aria-label of index.html. The dictionaries
// (en.json, ja.json) map these to translations; i18n.js applies them to the
// page. Run after adding UI text: `node scripts/i18n-extract.mjs`, then
// translate the new entries (scripts print how many are missing).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const HANGUL = /[가-힣]/;
const SOURCES = [
  'electron/renderer/renderer.js', 'electron/renderer/story.js', 'electron/renderer/monster-lines.js',
  'electron/renderer/monster-lore.js', 'electron/renderer/monster-art.js', 'electron/renderer/settings-window.js',
  'electron/renderer/typing-drill.js', 'electron/renderer/typing-snippets.js', 'electron/renderer/updates.js',
  'electron/renderer/fatigue.js', 'electron/renderer/tutorial.js', 'src/journal.ts', 'electron/renderer/log.js', 'electron/renderer/reply-format.js', 'electron/renderer/speech.js',
  'src/battle.ts', 'src/items.ts', 'src/contracts.ts', 'src/classes.ts', 'src/monsters.ts', 'src/progress.ts', 'src/themes.ts',
  'src/pets.ts', 'src/stats.ts', 'src/weapons.ts', 'src/damage.ts', 'src/skills.ts', 'src/profile.ts', 'src/attachments.ts',
  'src/daily.ts', 'src/claude-settings.ts', 'src/ranking.ts', 'electron/main.ts',
];

// JS literals: '...', "...", and `...${expr}...` (expressions replaced by {n}).
function jsStrings(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2); i = i < 0 ? n : i + 2; continue; }
    // A regex literal (after an operator or bracket): skip it, it may hold quotes or backticks.
    if (c === '/' && /[(,=:[!&|?{};+\-*%<>~^]|^$/.test(prevSignificant(src, i))) {
      let j = i + 1, inClass = false;
      while (j < n && src[j] !== '\n') {
        if (src[j] === '\\') j += 2;
        else if (src[j] === '[') { inClass = true; j++; }
        else if (src[j] === ']') { inClass = false; j++; }
        else if (src[j] === '/' && !inClass) break;
        else j++;
      }
      i = j + 1;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1, s = '';
      while (j < n && src[j] !== c && src[j] !== '\n') { if (src[j] === '\\') { s += unescape(src[j + 1]); j += 2; } else s += src[j++]; }
      out.push(s);
      i = j + 1;
      continue;
    }
    if (c === '`') {
      const [s, end] = template(src, i + 1);
      out.push(...s);
      i = end;
      continue;
    }
    i++;
  }
  return out;
}
function prevSignificant(src, i) {
  let k = i - 1;
  while (k >= 0 && /\s/.test(src[k])) k--;
  if (k < 0) return '';
  // `return /x/` and friends: a keyword before the slash also starts a regex.
  const word = /([A-Za-z_$]+)$/.exec(src.slice(Math.max(0, k - 10), k + 1));
  if (word && ['return', 'typeof', 'case', 'in', 'of'].includes(word[1])) return '(';
  return src[k];
}
const unescape = (ch) => ({ n: '\n', t: '\t', "'": "'", '"': '"', '`': '`', '\\': '\\' })[ch] ?? ch;
// Returns [strings found (this template, plus any nested ones), index after it].
function template(src, i) {
  let s = '', k = 0;
  const found = [];
  while (i < src.length && src[i] !== '`') {
    if (src[i] === '\\') { s += unescape(src[i + 1]); i += 2; continue; }
    if (src[i] === '$' && src[i + 1] === '{') {
      let depth = 1, j = i + 2, start = j;
      while (j < src.length && depth > 0) {
        if (src[j] === '`') { const [inner, end] = template(src, j + 1); found.push(...inner); j = end; continue; }
        if (src[j] === "'" || src[j] === '"') { const q = src[j]; let m = j + 1, t = ''; while (m < src.length && src[m] !== q) { if (src[m] === '\\') { t += unescape(src[m + 1]); m += 2; } else t += src[m++]; } found.push(t); j = m + 1; continue; }
        if (src[j] === '{') depth++;
        else if (src[j] === '}') depth--;
        j++;
      }
      void start;
      s += `{${k++}}`;
      i = j;
      continue;
    }
    s += src[i++];
  }
  return [[s, ...found], i + 1];
}

function htmlStrings(src) {
  const out = [];
  for (const m of src.matchAll(/>([^<>]+)</g)) out.push(m[1]);
  for (const m of src.matchAll(/\b(?:title|placeholder|aria-label)="([^"]+)"/g)) out.push(m[1]);
  return out;
}

const keys = new Set();
const add = (raw) => {
  // Multi-line strings: each line is its own text (the log shows lines separately).
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (t && HANGUL.test(t) && !/^\{\d+\}$/.test(t)) keys.add(t);
  }
};
for (const f of SOURCES) if (existsSync(f)) jsStrings(readFileSync(f, 'utf-8')).forEach(add);
htmlStrings(readFileSync('electron/renderer/index.html', 'utf-8')).forEach(add);

const list = [...keys].sort();
writeFileSync('electron/renderer/i18n/strings.json', JSON.stringify(list, null, 1) + '\n');
for (const lang of ['en', 'ja']) {
  const file = `electron/renderer/i18n/${lang}.json`;
  const dict = existsSync(file) ? JSON.parse(readFileSync(file, 'utf-8')) : {};
  const missing = list.filter((k) => !(k in dict));
  console.log(`${lang}: ${list.length - missing.length}/${list.length} translated, ${missing.length} missing`);
}
