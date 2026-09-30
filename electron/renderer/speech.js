// electron/renderer/speech.js
import { $ } from './dom.js';
import { MONSTER_LINES, BOSS_LINES, MERCHANT_IDLE, BLACKSMITH_IDLE } from './monster-lines.js';

const dungeonScreen = $('dungeon-screen');
const monsterPanel = $('monster-panel');
const merchantPanel = $('merchant-panel');
// Monster speech bubble: idle chatter that keeps changing, plus lines when it
// appears, gets hit, attacks, is blocked, is nearly dead, dies, or you flee.
const speech = { index: 0, isBoss: false, dead: false, saidLow: false, last: '', lastEventAt: 0, idleTimer: null };
const speechEl = $('monster-speech');
function linesFor(kind) {
  const own = MONSTER_LINES[speech.index % MONSTER_LINES.length]?.[kind] ?? [];
  return speech.isBoss ? [...own, ...(BOSS_LINES[kind] ?? [])] : own;
}
function pickLine(lines) {
  if (lines.length === 0) return null;
  let line;
  do line = lines[Math.floor(Math.random() * lines.length)];
  while (lines.length > 1 && line === speech.last);
  speech.last = line;
  return line;
}
function monsterSay(kind) {
  const line = pickLine(linesFor(kind));
  if (!line) return;
  speechEl.textContent = line;
  speechEl.className = `monster-speech say-${kind}`;
  speechEl.hidden = false;
  void speechEl.offsetWidth; // restart the pop
  speechEl.classList.add('pop');
  if (kind !== 'idle') speech.lastEventAt = Date.now();
  scheduleIdle();
}
function scheduleIdle() {
  clearTimeout(speech.idleTimer);
  speech.idleTimer = setTimeout(() => {
    if (!speech.dead && !monsterPanel.hidden && !dungeonScreen.hidden && Date.now() - speech.lastEventAt > 4000) monsterSay('idle');
    else scheduleIdle();
  }, 6000 + Math.random() * 2000);
}
export function speechFor(event) {
  switch (event.type) {
    case 'floorStart':
      Object.assign(speech, { index: event.monsterIndex, isBoss: event.isBoss, dead: false, saidLow: false });
      monsterSay('appear');
      break;
    case 'partialHit':
    case 'typingHit':
      // Many hits can land in a row: don't flicker the bubble on every one.
      if (!speech.dead && Date.now() - speech.lastEventAt > 1800) monsterSay('hit');
      break;
    case 'attack':
      if (!speech.dead) monsterSay(event.crit ? 'crit' : 'hit');
      break;
    case 'hpChanged':
      if (!speech.dead && !speech.saidLow && event.hp > 0 && event.hp <= event.maxHp * 0.25) {
        speech.saidLow = true;
        monsterSay('lowHp');
      }
      break;
    case 'monsterAttack':
      monsterSay('attack');
      break;
    case 'counterBlocked':
      monsterSay('blocked');
      break;
    case 'floorCleared':
      speech.dead = true;
      monsterSay('death');
      break;
    case 'fleeAttempt':
      if (event.success) monsterSay('flee');
      break;
    case 'merchantOpen':
      startShopChatter(merchantPanel, MERCHANT_IDLE);
      break;
    case 'blacksmithOpen':
      startShopChatter($('blacksmith-panel'), BLACKSMITH_IDLE);
      break;
    case 'merchantClosed':
    case 'blacksmithClosed':
      stopShopChatter();
      break;
  }
}
// Shopkeepers: their greeting line keeps changing while the shop is open.
let shopTimer = null;
function startShopChatter(panel, lines) {
  stopShopChatter();
  const greet = panel.querySelector('.merchant-greeting');
  const first = greet.textContent;
  let last = first;
  shopTimer = setInterval(() => {
    let line;
    do line = lines[Math.floor(Math.random() * lines.length)];
    while (lines.length > 1 && line === last);
    last = line;
    greet.textContent = `"${line}"`;
    greet.classList.remove('pop');
    void greet.offsetWidth;
    greet.classList.add('pop');
  }, 6000);
}
function stopShopChatter() {
  clearInterval(shopTimer);
  shopTimer = null;
}
