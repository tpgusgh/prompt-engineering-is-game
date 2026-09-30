// electron/renderer/settings-window.js
import { $ } from './dom.js';
import { appendLog } from './log.js';

const dungeonScreen = $('dungeon-screen');
// Settings window: the same one from the start screen and in battle.
export function openSettings(tab = 'claude') {
  for (const b of document.querySelectorAll('.settings-tabs button')) b.classList.toggle('active', b.dataset.tab === tab);
  for (const sec of document.querySelectorAll('.settings-tab')) sec.hidden = sec.dataset.tab !== tab;
  $('settings-overlay').hidden = false;
}
for (const b of document.querySelectorAll('.settings-tabs button')) b.addEventListener('click', () => openSettings(b.dataset.tab));
for (const b of document.querySelectorAll('[data-open-settings]')) b.addEventListener('click', () => openSettings());
$('settings-close').addEventListener('click', () => ($('settings-overlay').hidden = true));
$('settings-overlay').addEventListener('click', (e) => {
  if (e.target === $('settings-overlay')) $('settings-overlay').hidden = true;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('settings-overlay').hidden) $('settings-overlay').hidden = true;
});

// AI party on/off: remembered here, applies from the next attack mid-run.
const PARTY_KEY = 'pb-party';
try {
  if (localStorage.getItem(PARTY_KEY) === 'off') $('party-mode').checked = false;
} catch {}
$('party-mode').addEventListener('change', () => {
  const on = $('party-mode').checked;
  try {
    localStorage.setItem(PARTY_KEY, on ? 'on' : 'off');
  } catch {}
  window.promptBattle.setParty(on);
  if (!dungeonScreen.hidden) appendLog(on ? '🧙 AI 파티 합류 — 다음 공격부터' : '🧙 AI 파티 해산 — 다음 공격부터 혼자 싸운다', 'story-line');
});
