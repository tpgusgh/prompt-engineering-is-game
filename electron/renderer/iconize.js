// electron/renderer/iconize.js
// Emoji in the UI become Lucide line icons: every text node added to the page
// (buttons, cards, the battle log, speech bubbles) is scanned and each emoji
// swapped for its icon; emoji without an icon are dropped. Text that must stay
// verbatim — code, inputs, <option> labels (which can't hold SVG) — is only
// stripped or left alone.
import { ICONS, EMOJI_ICONS } from './icons.js';

const EMOJI = /(?:\p{Extended_Pictographic}|[✕✓✗★▾▴⚀-⚅])(?:️|‍\p{Extended_Pictographic}️?)*/gu;
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'PRE', 'CODE']);

export function iconSvg(name, extraClass = '') {
  const body = ICONS[name];
  if (!body) return '';
  return `<svg class="ic ic-${name}${extraClass ? ` ${extraClass}` : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

const iconFor = (emoji) => EMOJI_ICONS[emoji] ?? EMOJI_ICONS[emoji.replace(/️/g, '')];

function skipped(node) {
  for (let el = node.parentElement; el; el = el.parentElement) {
    if (SKIP.has(el.tagName) || el instanceof SVGElement) return true;
  }
  return false;
}

function iconizeText(node) {
  const text = node.nodeValue;
  if (!text || !EMOJI.test(text)) return;
  EMOJI.lastIndex = 0;
  const parent = node.parentElement;
  if (!parent || skipped(node)) return;
  // <option> and <title> can't hold markup: just drop the emoji.
  if (parent.tagName === 'OPTION' || parent.tagName === 'TITLE') {
    node.nodeValue = text.replace(EMOJI, '').replace(/^\s+/, '');
    return;
  }
  const frag = document.createDocumentFragment();
  let last = 0;
  for (const m of text.matchAll(EMOJI)) {
    if (m.index > last) frag.append(text.slice(last, m.index));
    const name = iconFor(m[0]);
    if (name) {
      const tpl = document.createElement('template');
      tpl.innerHTML = iconSvg(name);
      frag.append(tpl.content);
    }
    last = m.index + m[0].length;
  }
  frag.append(text.slice(last));
  node.replaceWith(frag);
}

function walk(root) {
  if (root.nodeType === Node.TEXT_NODE) return iconizeText(root);
  if (root.nodeType !== Node.ELEMENT_NODE || SKIP.has(root.tagName) || root instanceof SVGElement) return;
  const texts = [];
  const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (it.nextNode()) texts.push(it.currentNode);
  texts.forEach(iconizeText);
}

// Tooltips can't show icons either.
function stripTitles(root) {
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  for (const el of [root, ...root.querySelectorAll('[title]')]) {
    const t = el.getAttribute?.('title');
    if (t && EMOJI.test(t)) el.setAttribute('title', t.replace(EMOJI, '').trim());
    EMOJI.lastIndex = 0;
  }
}

walk(document.body);
stripTitles(document.body);
new MutationObserver((records) => {
  for (const r of records) {
    if (r.type === 'characterData') iconizeText(r.target);
    else if (r.type === 'attributes') stripTitles(r.target);
    else for (const n of r.addedNodes) {
      walk(n);
      stripTitles(n);
    }
  }
}).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title'] });
