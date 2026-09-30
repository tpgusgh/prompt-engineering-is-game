// electron/renderer/typing-drill.js
import { $ } from './dom.js';
import { appendLog } from './log.js';
import { SNIPPETS } from './typing-snippets.js';
import { sfx } from './audio.js';
import { openSettings } from './settings-window.js';

// Coding typing drill while the AI works: type a random line of code
// exactly; finishing it deals 1 damage, shows what it does for 3s (tap for
// the long explanation, which pauses), then the next line.
const typingInput = $('typing-input');
let typingSnippet = null;
let typingStartedAt = 0;
let typingMistakes = 0;
let typingDone = 0;
let typingNextTimer = null;
let typingActive = false;
let lastTypedTitle = '';

function renderTypingTarget() {
  const typed = typingInput.value;
  const target = $('typing-target');
  target.textContent = '';
  const code = typingSnippet.code;
  for (let i = 0; i < code.length; i++) {
    const span = document.createElement('span');
    span.textContent = code[i];
    if (i < typed.length) span.className = typed[i] === code[i] ? 'ok' : 'bad';
    else if (i === typed.length) span.className = 'cursor';
    target.append(span);
  }
}

// Which languages to drill (remembered on this machine; empty = all).
const TYPING_LANGS_KEY = 'pb-typing-langs';
const ALL_LANGS = [...new Set(SNIPPETS.map((s) => s.lang))].sort((a, b) => a.localeCompare(b));
let typingLangs = new Set();
try {
  typingLangs = new Set(JSON.parse(localStorage.getItem(TYPING_LANGS_KEY) || '[]').filter((l) => ALL_LANGS.includes(l)));
} catch {}
const typingPool = () => {
  const pool = typingLangs.size ? SNIPPETS.filter((s) => typingLangs.has(s.lang)) : SNIPPETS;
  return pool.length ? pool : SNIPPETS;
};
function saveTypingLangs() {
  try {
    localStorage.setItem(TYPING_LANGS_KEY, JSON.stringify([...typingLangs]));
  } catch {}
}
function renderTypingLangs() {
  const panel = $('typing-langs');
  panel.textContent = '';
  const count = (lang) => SNIPPETS.filter((s) => s.lang === lang).length;
  const all = document.createElement('button');
  all.type = 'button';
  all.textContent = typingLangs.size ? '전부 보기' : '✓ 전부';
  all.addEventListener('click', () => {
    typingLangs.clear();
    saveTypingLangs();
    renderTypingLangs();
    if (typingActive) nextSnippet();
  });
  panel.append(all);
  for (const lang of ALL_LANGS) {
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = typingLangs.has(lang);
    box.addEventListener('change', () => {
      if (box.checked) typingLangs.add(lang);
      else typingLangs.delete(lang);
      saveTypingLangs();
      renderTypingLangs();
      // Switch right away if the current line is no longer in the pool.
      if (typingActive && typingSnippet && !typingPool().includes(typingSnippet)) nextSnippet();
    });
    label.append(box, ` ${lang} `);
    const n = document.createElement('span');
    n.className = 'option-sub';
    n.textContent = String(count(lang));
    label.append(n);
    panel.append(label);
  }
  $('typing-settings').textContent = typingLangs.size ? `⚙️ ${[...typingLangs].join(', ')}` : '⚙️ 언어: 전부';
}
$('typing-settings').addEventListener('click', () => openSettings('typing'));
renderTypingLangs();

function nextSnippet() {
  clearTimeout(typingNextTimer);
  const pool = typingPool();
  let pickOne;
  do pickOne = pool[Math.floor(Math.random() * pool.length)];
  while (pool.length > 1 && pickOne === typingSnippet);
  typingSnippet = pickOne;
  typingStartedAt = 0;
  typingMistakes = 0;
  typingInput.value = '';
  typingInput.disabled = false;
  $('typing-lang').textContent = typingSnippet.lang;
  $('typing-explain').hidden = true;
  renderTypingTarget();
  if (typingActive) typingInput.focus();
}

export function startTyping() {
  typingActive = true;
  typingDone = 0;
  $('typing-stats').textContent = '';
  nextSnippet();
}

export function stopTyping() {
  typingActive = false;
  clearTimeout(typingNextTimer);
  if (typingDone > 0) appendLog(`⌨️ 기다리는 동안 코드 ${typingDone}줄을 완성했다!`, 'coin-line');
  typingDone = 0;
}

typingInput.addEventListener('input', async () => {
  if (!typingSnippet) return;
  const value = typingInput.value;
  $('typing-hint').hidden = !/[\u3131-\u318e\uac00-\ud7a3]/.test(value);
  if (!typingStartedAt && value) typingStartedAt = performance.now();
  const i = value.length - 1;
  if (i >= 0 && value[i] !== typingSnippet.code[i]) {
    typingMistakes += 1;
    sfx('typo');
  } else if (i >= 0) sfx('key');
  renderTypingTarget();
  if (value !== typingSnippet.code) return;
  // Completed.
  typingInput.disabled = true;
  typingDone += 1;
  const minutes = Math.max(0.01, (performance.now() - typingStartedAt) / 60000);
  const cpm = Math.round(typingSnippet.code.length / minutes);
  const accuracy = Math.max(0, Math.round(100 - (typingMistakes / typingSnippet.code.length) * 100));
  $('typing-stats').textContent = `${cpm}타/분 · 정확도 ${accuracy}% · ${typingDone}줄 완성`;
  lastTypedTitle = typingSnippet.title;
  sfx('typed');
  window.promptBattle.typingHit();
  const explain = $('typing-explain');
  explain.hidden = false;
  explain.className = 'typing-explain';
  explain.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'typing-explain-title';
  head.textContent = `✅ ${typingSnippet.title}`;
  const body = document.createElement('div');
  body.textContent = typingSnippet.short;
  const more = document.createElement('div');
  more.className = 'option-sub';
  more.textContent = '눌러서 자세히 보기';
  explain.append(head, body, more);
  const snippet = typingSnippet;
  explain.onclick = () => {
    // Long view: pause the auto-advance until "next" is pressed.
    clearTimeout(typingNextTimer);
    explain.classList.add('long');
    body.textContent = snippet.long;
    more.textContent = '';
    const next = document.createElement('button');
    next.type = 'button';
    next.textContent = '다음 코드 ▶';
    next.onclick = (e) => {
      e.stopPropagation();
      nextSnippet();
    };
    more.append(next);
    explain.onclick = null;
  };
  typingNextTimer = setTimeout(() => typingActive && nextSnippet(), 3000);
});
