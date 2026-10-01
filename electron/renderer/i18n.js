// electron/renderer/i18n.js
// UI language (한국어 · English · 日本語). The game is written in Korean; for
// another language every text node and title/placeholder/aria-label on the
// page is passed through the dictionary (i18n/<lang>.json, built from
// scripts/i18n-extract.mjs) as it appears — the same way iconize.js swaps
// emoji, and imported before it so it sees the original text. What the
// player or Claude wrote (chat, replies, tool output, files) is never touched.
// The Korean original is kept per node, so the language switches live.
import { makeTranslator } from './i18n/translate.js';

export const LANGUAGES = [
  { id: 'ko', name: '한국어' },
  { id: 'en', name: 'English' },
  { id: 'ja', name: '日本語' },
];
const KEY = 'pb-lang';
const SKIP = '.user-chat, .ai-bubble, .tool-card, .markdown, #quest-body, #last-prompt-text, #last-prompt-answers, .file-viewer-body, #file-content, #next-memo, textarea, input, pre, code, script, style, [data-no-i18n]';
const ATTRS = ['title', 'placeholder', 'aria-label'];

function initialLang() {
  try {
    const saved = localStorage.getItem(KEY);
    if (LANGUAGES.some((l) => l.id === saved)) return saved;
  } catch {}
  const sys = (navigator.language || 'ko').slice(0, 2);
  return LANGUAGES.some((l) => l.id === sys) ? sys : 'en';
}

const dicts = {};
async function load(lang) {
  if (lang === 'ko' || dicts[lang]) return;
  try {
    const mod = await import(`./i18n/${lang}.json`, { with: { type: 'json' } });
    dicts[lang] = makeTranslator(mod.default);
  } catch {
    dicts[lang] = (s) => s; // a missing dictionary leaves the Korean text
  }
}

let lang = initialLang();
await load(lang);
let translate = lang === 'ko' ? (s) => s : dicts[lang];
document.documentElement.lang = lang;

const originalText = new WeakMap(); // text node → Korean
const writtenText = new WeakMap(); // text node → what we last put there
const originalAttr = new WeakMap(); // element → { attr: Korean }
const writtenAttr = new WeakMap(); // element → { attr: what we last put there }
const skipped = (el) => !el || Boolean(el.closest?.(SKIP));
// Inputs keep what's typed, but their placeholder and title are UI text.
const ATTR_SKIP = SKIP.replace(', textarea, input', '');
const attrSkipped = (el) => !el || Boolean(el.closest?.(ATTR_SKIP));

function textNode(node) {
  if (skipped(node.parentElement)) return;
  const current = node.nodeValue;
  // Still what we wrote: keep its Korean original. Anything else is new text.
  const source = writtenText.get(node) === current ? originalText.get(node) : current;
  originalText.set(node, source);
  const out = translateOf(source);
  writtenText.set(node, out);
  if (out !== current) node.nodeValue = out;
}
const translateOf = (ko) => (lang === 'ko' ? ko : translate(ko));

function attrs(el) {
  if (attrSkipped(el)) return;
  let saved = originalAttr.get(el);
  let written = writtenAttr.get(el);
  for (const a of ATTRS) {
    const v = el.getAttribute?.(a);
    if (v == null) continue;
    if (!saved) originalAttr.set(el, (saved = {}));
    if (!written) writtenAttr.set(el, (written = {}));
    if (written[a] !== v) saved[a] = v;
    const out = translateOf(saved[a]);
    written[a] = out;
    if (out !== v) el.setAttribute(a, out);
  }
}

function walk(root) {
  if (root.nodeType === Node.TEXT_NODE) return textNode(root);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  attrs(root);
  if (skipped(root)) return;
  const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = it.nextNode(); n; n = it.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) textNode(n);
    else attrs(n);
  }
}

new MutationObserver((records) => {
  for (const r of records) {
    if (r.type === 'childList') r.addedNodes.forEach(walk);
    else if (r.type === 'characterData') textNode(r.target);
    else if (r.type === 'attributes') attrs(r.target);
  }
}).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
walk(document.body);

export const currentLang = () => lang;
// Switch live: every node goes back to its Korean original, then through the new dictionary.
export async function setLang(next) {
  if (!LANGUAGES.some((l) => l.id === next) || next === lang) return;
  await load(next);
  lang = next;
  translate = next === 'ko' ? (s) => s : dicts[next];
  document.documentElement.lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {}
  walk(document.body);
}
// For code that builds strings outside the DOM (window titles, confirm()).
export const t = (ko) => translateOf(ko);
