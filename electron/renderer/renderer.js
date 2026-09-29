// electron/renderer/renderer.js
import { marked } from '../../node_modules/marked/lib/marked.esm.js';
import { monsterSvg, merchantSvg, blacksmithSvg } from './monster-art.js';

const $ = (id) => document.getElementById(id);
const setupScreen = $('setup-screen');
const dungeonScreen = $('dungeon-screen');
const summaryScreen = $('summary-screen');
const pickFolderBtn = $('pick-folder-btn');
const folderPathEl = $('folder-path');
const startBtn = $('start-btn');
const profileLineEl = $('profile-line');
const themeOptionsEl = $('theme-options');
const weaponOptionsEl = $('weapon-options');
const continueLabel = $('continue-label');
const continueCheckbox = $('continue-story');
const continueText = $('continue-text');
const chapterBanner = $('chapter-banner');
const monsterPanel = $('monster-panel');
const monsterNameEl = $('monster-name');
const monsterArtEl = $('monster-art');
const hpBarFillEl = $('hp-bar-fill');
const hpLabelEl = $('hp-label');
const playerHpFill = $('player-hp-fill');
const playerHpLabel = $('player-hp-label');
const weaponSelect = $('weapon-select');
const turnStatusEl = $('turn-status');
const sessionBanner = $('session-banner');
const sessionBannerText = $('session-banner-text');
const sessionBannerPrompt = $('session-banner-prompt');
const sessionBannerUse = $('session-banner-use');
const logEl = $('log');
const attackForm = $('attack-form');
const promptInput = $('prompt-input');
const fleeBtn = $('flee-btn');
const attackSubmitBtn = attackForm.querySelector('button[type="submit"]');
const summaryTitleEl = $('summary-title');
const summaryTextEl = $('summary-text');
const summaryStoryEl = $('summary-story');
const playAgainBtn = $('play-again-btn');
const setupErrorEl = $('setup-error');
const fileTreeEl = $('file-tree');
const refreshTreeBtn = $('refresh-tree');
const fileViewerOverlay = $('file-viewer-overlay');
const fileViewerTitleEl = $('file-viewer-title');
const fileViewerBodyEl = $('file-viewer-body');
const fileViewerCloseBtn = $('file-viewer-close');
const fileViewerSaveBtn = $('file-viewer-save');
const fileViewerStatus = $('file-viewer-status');
const sessionPicker = $('session-picker');
const sessionSelect = $('session-select');
const coinLabel = $('coin-label');
const bagEl = $('bag');
const merchantPanel = $('merchant-panel');
const merchantArtEl = $('merchant-art');
const merchantItemsEl = $('merchant-items');
const merchantLeaveBtn = $('merchant-leave');
const exitBtn = $('exit-btn');
const betAmountInput = $('bet-amount');
const betResultEl = $('bet-result');
const exitOverlay = $('exit-overlay');
const exitConfirmBtn = $('exit-confirm');
const exitCancelBtn = $('exit-cancel');

// ---------------------------------------------------------------------------
// Story. Each theme is a chain of chapters; every chapter ends in a boss
// (the 6th floor of the cycle, see src/battle.ts). Beyond the written
// chapters the story keeps going with generated ones — a project rarely ends
// just because one boss fell.
const THEMES = [
  {
    id: 'adventure',
    title: '모험을 떠나기',
    chapters: [
      { title: '고대 유적의 입구', intro: '전설의 모험가가 되어, 미지의 유적에 첫 발을 내딛는다...', boss: '유적의 수호룡', outro: '수호룡이 쓰러지자, 유적 깊은 곳으로 이어지는 계단이 드러났다.' },
      { title: '잊혀진 지하 도시', intro: '계단 아래에는 수백 년 전 버려진 도시가 잠들어 있었다...', boss: '심연의 파수꾼', outro: '파수꾼의 눈빛이 꺼지고, 천장의 틈 사이로 별빛이 쏟아진다.' },
      { title: '별이 떨어진 산맥', intro: '별빛을 따라 오른 산맥 꼭대기, 하늘이 갈라져 있다...', boss: '별을 삼킨 용', outro: '마침내 별이 제자리로 돌아갔다. 하지만 지도 끝에는 아직 빈칸이 남아 있다.' },
    ],
  },
  {
    id: 'demon-king',
    title: '마왕 잡으러 가기',
    chapters: [
      { title: '마왕성 외곽', intro: '세상을 위협하는 마왕을 물리치기 위해 검을 뽑아 든다...', boss: '마왕', outro: '마왕이 쓰러졌다! ...그런데 왕좌 뒤편에서 더 짙은 어둠이 꿈틀거린다.' },
      { title: '흑막의 부활', intro: '마왕은 꼭두각시에 불과했다. 진짜 흑막, 마신이 깨어났다...', boss: '마신', outro: '마신이 소멸하며 남긴 균열이 다른 차원으로 이어져 있다.' },
      { title: '차원의 틈', intro: '균열 너머, 모든 세계를 집어삼키려는 존재가 기다린다...', boss: '차원의 군주', outro: '세계는 구해졌다. 하지만 용사의 여정은 아직 끝나지 않았다.' },
    ],
  },
  {
    id: 'debug-quest',
    title: '버그 소탕전',
    chapters: [
      { title: '레거시 모놀리스', intro: '코드 속 깊은 곳에 숨은 버그들을 소탕하러 던전에 들어선다...', boss: '레거시 코드 드래곤', outro: '드래곤을 리팩터링했다! ...그 순간 프로덕션 알람이 울린다.' },
      { title: '새벽 3시의 장애', intro: '배포 직후, 모니터링 대시보드가 붉게 물든다...', boss: '새벽 3시의 장애 드래곤', outro: '장애가 복구됐다. 이제 미뤄둔 마이그레이션을 마주할 차례다.' },
      { title: '끝나지 않는 마이그레이션', intro: '스키마 v1에서 v47까지, 수많은 마이그레이션이 길을 막는다...', boss: '끝나지 않는 마이그레이션', outro: '마이그레이션 완료. 백로그에는 아직 티켓이 남아 있다.' },
    ],
  },
];

function chapterInfo(theme, chapter) {
  const written = theme.chapters[chapter - 1];
  if (written) return written;
  return {
    title: `더 깊은 곳 (챕터 ${chapter})`,
    intro: `이야기는 계속된다. 챕터 ${chapter}, 더 강한 적들이 기다리고 있다...`,
    boss: `${chapter}번째 군주`,
    outro: `챕터 ${chapter}의 군주가 쓰러졌다. 여정은 계속된다.`,
  };
}

let weapons = [];
let items = [];
let coins = 0;
let bag = {};
let inputEnabled = false;
let statDefs = [];
let statMax = 10;
let swordMax = 10;
let stats = { attack: 0, defense: 0, vitality: 0 };
let statPoints = 0;
let swordLevel = 0;
let currentSessionId = null;
let slots = [];
let planUsage = null;
let contextUsage = null;
let usageFetchedAt = 0;
let profile = null;
let chosenFolder = null;
let chosenThemeId = THEMES[0].id;
let chosenWeapon = 'claude-sonnet-5';
let heroClasses = [];
let chosenClass = 'swordsman';
let activeTheme = THEMES[0];
let currentMonsterName = '';
let lastSummary = '';
const touchedFiles = new Set();

// Weapon names depend on the hero's class; the enhance level (+N) adds the
// class's prefix: e.g. wizard + Sonnet at +1 = "그냥 마법지팡이".
const heroClass = () => heroClasses.find((c) => c.id === chosenClass) ?? heroClasses[0];
const classWeapon = (model) => heroClass()?.weapons[model] ?? { name: '무기', flavor: '' };
const enhancedName = (model, level) =>
  `${heroClass()?.modifiers[Math.max(0, Math.min(level, swordMax))] ?? ''} ${classWeapon(model).name}`.trim();

function weaponLabel(w) {
  return `${classWeapon(w.model).name} — ${classWeapon(w.model).flavor} (x${w.multiplier})`;
}

function renderWeaponOptions() {
  weaponOptionsEl.textContent = '';
  weaponSelect.textContent = '';
  for (const w of weapons) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'weapon';
    input.value = w.model;
    input.checked = w.model === chosenWeapon;
    input.addEventListener('change', () => {
      chosenWeapon = w.model;
    });
    label.append(input, ` ${weaponLabel(w)}`);
    weaponOptionsEl.append(label);

    const option = document.createElement('option');
    option.value = w.model;
    option.textContent = `${classWeapon(w.model).name} (x${w.multiplier})`;
    weaponSelect.append(option);
  }
  weaponSelect.value = chosenWeapon;
}

function renderClassOptions() {
  const el = $('class-options');
  el.textContent = '';
  for (const c of heroClasses) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'hero-class';
    input.value = c.id;
    input.checked = c.id === chosenClass;
    input.addEventListener('change', () => {
      chosenClass = c.id;
      renderWeaponOptions();
      renderSetupStats();
    });
    const sub = document.createElement('span');
    sub.className = 'option-sub';
    sub.textContent = `(${Object.values(c.weapons).map((w) => w.name).join(' · ')})`;
    label.append(input, ` ${c.icon} ${c.name} `, sub);
    el.append(label);
  }
}

const savedFloor = (themeId) => profile?.storyFloors?.[themeId] ?? 0;
const floorText = (floor) => `챕터 ${Math.floor(floor / 6) + 1} ${(floor % 6) + 1}/6층`;

function refreshContinueOption() {
  const floor = savedFloor(chosenThemeId);
  const theme = THEMES.find((t) => t.id === chosenThemeId);
  if (floor > 0 && theme) {
    continueLabel.hidden = false;
    continueText.textContent = `이어하기: ${floorText(floor)} "${chapterInfo(theme, Math.floor(floor / 6) + 1).title}"부터`;
  } else {
    continueLabel.hidden = true;
  }
}

async function loadSetup() {
  const info = await window.promptBattle.getSetupInfo();
  profile = info.profile;
  heroClasses = info.classes;
  chosenClass = profile.heroClass ?? chosenClass;
  weapons = info.weapons;
  items = info.items;
  statDefs = info.stats;
  statMax = info.statMaxLevel;
  swordMax = info.swordMaxLevel;
  renderSetupStats();
  renderProfileLine();

  themeOptionsEl.textContent = '';
  for (const theme of THEMES) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'theme';
    input.value = theme.id;
    input.checked = theme.id === chosenThemeId;
    input.addEventListener('change', () => {
      chosenThemeId = theme.id;
      refreshContinueOption();
    });
    label.append(input, ` ${theme.title}`);
    const floor = savedFloor(theme.id);
    if (floor > 0) {
      const sub = document.createElement('span');
      sub.className = 'option-sub';
      sub.textContent = `(${floorText(floor)}까지 진행)`;
      label.append(sub);
    }
    themeOptionsEl.append(label);
  }

  renderClassOptions();
  renderWeaponOptions();
  refreshContinueOption();
}
loadSetup();

// ---------------------------------------------------------------------------
// Stats: read-only on the setup screen; points from defeated monsters are
// spent in battle (stat panel). The sword's +N comes from the blacksmith.
function renderSetupStats() {
  const list = $('stat-options');
  list.textContent = '';
  for (const s of statDefs) {
    const row = document.createElement('div');
    row.className = 'stat-row';
    const label = document.createElement('span');
    label.textContent = `${s.name} (최대 Lv.${statMax})`;
    const effect = document.createElement('span');
    effect.className = 'option-sub';
    effect.textContent = s.effect;
    row.append(label, effect);
    list.append(row);
  }
  const sword = document.createElement('div');
  sword.className = 'stat-row';
  sword.append(`무기 강화 +${profile.swordLevel}/${swordMax}`);
  const swordFx = document.createElement('span');
  swordFx.className = 'option-sub';
  swordFx.textContent = `"${enhancedName(chosenWeapon, profile.swordLevel)}" · 피해 +${profile.swordLevel * 10}% (영구)`;
  sword.append(swordFx);
  list.append(sword);
}

function renderProfileLine() {
  profileLineEl.textContent = `레벨 ${profile.level} 용사 · 총 ${profile.xp} XP · ${profile.totalWins}승 · ${profile.coins} 코인 · 최대 HP ${profile.maxHp} · 무기 +${profile.swordLevel}`;
}

// Battle stat panel: unspent points + one button per stat (a free action).
function renderStatPanel() {
  const panel = $('stat-panel');
  panel.textContent = '';
  const points = document.createElement('span');
  points.className = statPoints > 0 ? 'stat-points has' : 'stat-points';
  points.textContent = `⭐ 능력치 포인트 ${statPoints}`;
  panel.append(points);
  for (const s of statDefs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const maxed = stats[s.id] >= statMax;
    btn.textContent = `${s.name} Lv.${stats[s.id]}${maxed ? ' (MAX)' : statPoints > 0 ? ' ＋' : ''}`;
    btn.title = s.effect;
    btn.disabled = !inputEnabled || maxed || statPoints < 1;
    btn.addEventListener('click', () => window.promptBattle.submitPrompt(`/stat ${s.id}`));
    panel.append(btn);
  }
}

function renderSwordLevel() {
  $('sword-level').textContent = `${enhancedName(weaponSelect.value, swordLevel)} +${swordLevel}`;
}

const pct = (x) => `${Math.round(x * 100)}%`;
function renderForgeInfo(odds) {
  $('forge-info').textContent =
    swordLevel >= swordMax
      ? `${enhancedName(weaponSelect.value, swordLevel)} +${swordLevel} — 최대 강화에 도달했다!`
      : `${enhancedName(weaponSelect.value, swordLevel)} +${swordLevel} → ${enhancedName(weaponSelect.value, swordLevel + 1)} +${swordLevel + 1}  ·  비용 🪙 ${odds.cost}  ·  성공 ${pct(odds.successChance)}  ·  실패 시 파괴 ${pct(odds.breakChance)}`;
  $('forge-enhance').disabled = !inputEnabled || swordLevel >= swordMax;
}

function openBlacksmith(event) {
  monsterPanel.hidden = true;
  fleeBtn.disabled = true;
  $('blacksmith-panel').hidden = false;
  $('blacksmith-art').innerHTML = blacksmithSvg();
  $('forge-result').textContent = '';
  renderForgeInfo(event.odds);
}

function closeBlacksmith() {
  $('blacksmith-panel').hidden = true;
  monsterPanel.hidden = !merchantPanel.hidden;
  fleeBtn.disabled = !inputEnabled;
}
$('forge-enhance').addEventListener('click', () => window.promptBattle.submitPrompt('/enhance'));
$('forge-leave').addEventListener('click', () => window.promptBattle.submitPrompt('/leave'));

// ---------------------------------------------------------------------------
// Usage bar: Claude plan limits (5-hour session + weekly, as % used — the
// API doesn't expose raw token counts for these) and this Claude session's
// context size. Small, at the bottom; click to refresh.
function formatReset(iso, withDate) {
  if (!iso) return '';
  const d = new Date(iso);
  const time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const date = `${d.getMonth() + 1}/${d.getDate()}(${'일월화수목금토'[d.getDay()]})`;
  return ` · ${withDate ? `${date} ` : ''}${time} 초기화`;
}

const kTokens = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

function renderUsage() {
  const parts = [];
  const win = (label, w, withDate) =>
    w ? `${label} ${Math.round(w.usedPercent)}% 사용 · ${Math.max(0, 100 - Math.round(w.usedPercent))}% 남음${formatReset(w.resetsAt, withDate)}` : `${label} —`;
  if (planUsage === 'loading') parts.push('사용량 불러오는 중...');
  else if (planUsage) parts.push(win('세션(5시간)', planUsage.session, false), win('주간', planUsage.weekly, true));
  else parts.push('플랜 사용량 정보 없음');
  parts.push(
    contextUsage
      ? `컨텍스트 ${kTokens(contextUsage.usedTokens)} / ${kTokens(contextUsage.contextWindow)} (${Math.round((contextUsage.usedTokens / contextUsage.contextWindow) * 100)}%)`
      : '컨텍스트 —',
  );
  for (const el of document.querySelectorAll('[data-usage]')) el.textContent = parts.join('  │  ');
}

async function refreshUsage(force) {
  if (!force && Date.now() - usageFetchedAt < 20000) return;
  usageFetchedAt = Date.now();
  if (!planUsage) planUsage = 'loading';
  renderUsage();
  planUsage = (await window.promptBattle.getUsage()) ?? null;
  renderUsage();
}
for (const el of document.querySelectorAll('[data-usage]')) el.addEventListener('click', () => refreshUsage(true));
refreshUsage(true);

// A turn can take a while (real file/bash work). Without this, a click while
// one is in flight is silently dropped by main.ts (no pending resolver yet).
function setInputEnabled(enabled) {
  inputEnabled = enabled;
  promptInput.disabled = !enabled;
  attackSubmitBtn.disabled = !enabled;
  fleeBtn.disabled = !enabled;
  exitBtn.disabled = !enabled;
  $('save-btn').disabled = !enabled;
  $('session-btn').disabled = !enabled;
  for (const btn of document.querySelectorAll('.bag button, .merchant-panel button')) btn.disabled = !enabled;
  if (statDefs.length) renderStatPanel();
}

// A turn emits several hpChanged events (one per partial hit, plus one at
// the end), so hpChanged can't mean "turn over" — only these events do.
function turnConcluded() {
  setInputEnabled(true);
  refreshUsage(false);
  stopTurnTimer();
  stopBugGame();
  finalizeLive();
  $('turn-panel').hidden = true;
  refreshTree();
}

// ---------------------------------------------------------------------------
// Turn timer + party (subagents) status + the waiting mini-game.
let turnStartedAt = 0;
let turnTimer = null;
const fmtElapsed = (ms) => {
  const s = Math.floor(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초` : `${s}초`;
};
function startTurnTimer() {
  turnStartedAt = Date.now();
  const tick = () => ($('turn-timer').textContent = `⏱ ${fmtElapsed(Date.now() - turnStartedAt)}`);
  tick();
  clearInterval(turnTimer);
  turnTimer = setInterval(tick, 1000);
}
function stopTurnTimer() {
  clearInterval(turnTimer);
  turnTimer = null;
  if (turnStartedAt) appendLog(`⏱ 이번 턴: ${fmtElapsed(Date.now() - turnStartedAt)}`, 'sys-line');
  turnStartedAt = 0;
}

const ROLES = {
  wizard: { icon: '🧙', name: '마법사' },
  swordsman: { icon: '🗡', name: '검사' },
  archer: { icon: '🏹', name: '궁수' },
};
const roleOf = (type) => ROLES[type] ?? { icon: '🤖', name: type };
const activeAgents = new Map(); // tool-use id -> { agentType, description }
const agentTypeById = new Map(); // survives agentEnd, for late events
function renderParty() {
  const el = $('party-status');
  const members = [...activeAgents.values()];
  if (members.length === 0) {
    el.textContent = '프로세스 1개 (용사 단독)';
    return;
  }
  el.textContent = `프로세스 ${members.length + 1}개 동시 진행 · ` + members.map((m) => `${roleOf(m.agentType).icon} ${roleOf(m.agentType).name}: ${m.description}`).join('  ·  ');
}

// Bug-squash: bugs pop up in a 3x3 grid while the AI works.
let bugTimer = null;
let bugsCaught = 0;
function renderBugScore() {
  $('bug-score').textContent = `잡은 버그 ${bugsCaught}/10`;
}
function startBugGame() {
  bugsCaught = 0;
  renderBugScore();
  const grid = $('bug-grid');
  grid.textContent = '';
  const cells = Array.from({ length: 9 }, () => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'bug-cell';
    cell.addEventListener('click', () => {
      if (!cell.classList.contains('bug')) return;
      cell.classList.remove('bug');
      cell.classList.add('squashed');
      cell.textContent = '💥';
      setTimeout(() => {
        cell.classList.remove('squashed');
        cell.textContent = '';
      }, 300);
      bugsCaught = Math.min(10, bugsCaught + 1);
      renderBugScore();
    });
    grid.append(cell);
    return cell;
  });
  clearInterval(bugTimer);
  bugTimer = setInterval(() => {
    const cell = cells[Math.floor(Math.random() * cells.length)];
    if (cell.classList.contains('bug') || cell.classList.contains('squashed')) return;
    cell.classList.add('bug');
    cell.textContent = Math.random() < 0.15 ? '🪲' : '🐛';
    setTimeout(() => {
      if (!cell.classList.contains('bug')) return;
      cell.classList.remove('bug');
      cell.textContent = '';
    }, 850 + Math.random() * 500);
  }, 650);
}
function stopBugGame() {
  clearInterval(bugTimer);
  bugTimer = null;
  if (bugsCaught > 0) {
    appendLog(`🐛 기다리는 동안 버그 ${bugsCaught}마리를 잡았다!`, 'coin-line');
    window.promptBattle.submitPrompt(`/bonus ${bugsCaught}`);
  }
  bugsCaught = 0;
}

// ---------------------------------------------------------------------------
// Live typing: the AI's streamed text is typed into a bubble a few
// characters per frame (catching up faster when far behind), rendered as
// markdown as it goes. A tool call splits the reply into a new bubble.
let live = null; // the bubble currently receiving text
let streamedThisTurn = false;
function newBubble() {
  const el = document.createElement('div');
  el.className = 'markdown ai-bubble typing';
  logEl.appendChild(el);
  const b = { el, target: '', shown: 0, raf: 0, lastRender: 0, closing: false };
  const render = (force) => {
    const now = performance.now();
    if (!force && now - b.lastRender < 50) return;
    b.lastRender = now;
    const nearBottom = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 120;
    el.innerHTML = marked.parse(b.target.slice(0, b.shown));
    if (nearBottom) scrollLogToBottom();
  };
  const finish = () => {
    el.classList.remove('typing');
    el.innerHTML = marked.parse(b.target);
    attachChoices(el);
    scrollLogToBottom();
  };
  b.push = (text) => {
    b.target += text;
    if (!b.raf) b.raf = requestAnimationFrame(frame);
  };
  function frame() {
    const backlog = b.target.length - b.shown;
    b.shown += Math.max(1, Math.ceil(backlog / 25));
    render(b.shown >= b.target.length);
    if (b.shown < b.target.length) b.raf = requestAnimationFrame(frame);
    else {
      b.raf = 0;
      if (b.closing) finish();
    }
  }
  // Soft close: keeps typing what it has, then renders the final markdown.
  b.close = () => {
    b.closing = true;
    if (!b.raf) finish();
  };
  return b;
}
function liveAppend(text) {
  if (!live) live = newBubble();
  live.push(text);
}
function finalizeLive() {
  if (!live) return;
  live.close();
  live = null;
}

pickFolderBtn.addEventListener('click', async () => {
  const folder = await window.promptBattle.pickFolder();
  if (folder) {
    chosenFolder = folder;
    folderPathEl.textContent = folder;
    startBtn.disabled = false;
    await refreshSessionPicker(folder);
  }
});

function scrollLogToBottom() {
  logEl.scrollTop = logEl.scrollHeight;
}

function appendLog(text, className) {
  const line = document.createElement('div');
  if (className) line.className = className;
  line.textContent = text;
  logEl.appendChild(line);
  scrollLogToBottom();
  return line;
}

function appendUserChat(text, extraClass) {
  const line = appendLog(text, `user-chat${extraClass ? ` ${extraClass}` : ''}`);
  line.dataset.who = '나';
  return line;
}

const itemName = (id) => items.find((i) => i.id === id)?.name ?? id;

function renderCoins() {
  coinLabel.textContent = `🪙 ${coins}`;
}

// The bag: each item is a button that uses it (a free action, no turn spent).
function renderBag() {
  bagEl.textContent = '';
  const entries = Object.entries(bag).filter(([, n]) => n > 0);
  bagEl.hidden = entries.length === 0;
  for (const [id, count] of entries) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = `${itemName(id)} x${count}`;
    btn.title = items.find((i) => i.id === id)?.description ?? '';
    btn.disabled = !inputEnabled;
    btn.addEventListener('click', () => window.promptBattle.submitPrompt(`/use ${id}`));
    bagEl.append(btn);
  }
}

function openMerchant(event) {
  monsterPanel.hidden = true;
  fleeBtn.disabled = true; // nothing to flee from in the shop
  merchantPanel.hidden = false;
  merchantArtEl.innerHTML = merchantSvg();
  betResultEl.textContent = '';
  betAmountInput.max = String(coins);
  betAmountInput.value = String(Math.max(1, Math.min(10, coins)));
  merchantItemsEl.textContent = '';
  for (const item of event.items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'merchant-item';
    btn.disabled = !inputEnabled;
    const name = document.createElement('strong');
    name.textContent = item.name;
    const desc = document.createElement('span');
    desc.textContent = item.description;
    const price = document.createElement('span');
    price.className = 'price';
    price.textContent = `🪙 ${item.price}`;
    btn.append(name, desc, price);
    btn.addEventListener('click', () => window.promptBattle.submitPrompt(`/buy ${item.id}`));
    merchantItemsEl.append(btn);
  }
}

function closeMerchant() {
  merchantPanel.hidden = true;
  monsterPanel.hidden = false;
  fleeBtn.disabled = !inputEnabled;
}

// Previous chats in this folder, shown dimmed above today's adventure.
function renderHistory(history) {
  if (history.length === 0) return;
  const shown = history.slice(-50);
  appendLog(`— 이 폴더의 이전 대화 기록 (${shown.length}/${history.length}) —`, 'history-header');
  for (const entry of shown) {
    if (entry.role === 'user') appendUserChat(entry.text, 'history');
    else renderMarkdownLog(entry.text, 'history');
  }
  appendLog('— 오늘의 모험 —', 'history-header');
}

function setBar(fillEl, labelEl, hp, maxHp, suffix) {
  const safeMax = Math.max(1, maxHp);
  const ratio = Math.max(0, Math.min(hp, safeMax)) / safeMax;
  fillEl.style.width = `${ratio * 100}%`;
  fillEl.classList.toggle('warn', ratio <= 0.5 && ratio > 0.2);
  fillEl.classList.toggle('danger', ratio <= 0.2);
  labelEl.textContent = `${Math.max(0, hp)} / ${safeMax}${suffix}`;
}

function flashMonster() {
  monsterPanel.classList.remove('hit-flash');
  void monsterPanel.offsetWidth;
  monsterPanel.classList.add('hit-flash');
  setTimeout(() => monsterPanel.classList.remove('hit-flash'), 250);
}

function shakeScreen() {
  dungeonScreen.classList.remove('player-hit');
  void dungeonScreen.offsetWidth;
  dungeonScreen.classList.add('player-hit');
  setTimeout(() => dungeonScreen.classList.remove('player-hit'), 300);
}

const ATTACK_LINES = {
  swordsman: [
    (dmg, w) => `${w}을(를) 휘둘러 ${dmg}의 피해를 입혔다!`,
    (dmg) => `강력한 일격으로 ${dmg}의 피해를 입혔다!`,
    (dmg, w) => `${w}(으)로 ${dmg}만큼 베어버렸다!`,
    (dmg) => `빈틈을 파고들어 ${dmg}의 피해를 입혔다!`,
  ],
  wizard: [
    (dmg, w) => `${w}에서 화염구가 터져 나와 ${dmg}의 피해를 입혔다!`,
    (dmg) => `번개를 내리꽂아 ${dmg}의 피해를 입혔다!`,
    (dmg) => `얼음 창을 소환해 ${dmg}의 피해를 입혔다!`,
    (dmg, w) => `${w}을(를) 치켜들자 마법진이 빛나며 ${dmg}의 피해!`,
  ],
  archer: [
    (dmg, w) => `${w}(으)로 화살을 날려 ${dmg}의 피해를 입혔다!`,
    (dmg) => `연속 사격! ${dmg}의 피해를 입혔다!`,
    (dmg) => `급소를 정확히 꿰뚫어 ${dmg}의 피해!`,
    (dmg, w) => `${w}의 시위를 당겨 불화살로 ${dmg}의 피해!`,
  ],
};
const DODGE_LINES = ['몬스터가 마지막 일격을 회피했다!', '몬스터가 몸을 비틀어 공격을 피했다!', '아슬아슬하게 빗나갔다... 몬스터가 회피했다!'];
const COUNTER_LINES = ['의 반격!', '이(가) 달려든다!', '의 날카로운 공격!'];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const weaponName = () => enhancedName(weaponSelect.value, swordLevel);

// Renders the AI's markdown reply properly (headers/bold/lists). If it ends
// with a question followed by a list, the list items become clickable
// choices that fill the input.
function renderMarkdownLog(text, extraClass) {
  const wrapper = document.createElement('div');
  wrapper.className = `markdown ai-bubble${extraClass ? ` ${extraClass}` : ''}`;
  wrapper.innerHTML = marked.parse(text);
  logEl.appendChild(wrapper);
  if (!extraClass) attachChoices(wrapper);
  scrollLogToBottom();
}

// A reply ending in a question followed by a list: the list items become
// clickable choices that fill the input.
function attachChoices(wrapper) {
  const children = Array.from(wrapper.children);
  const lastList = children[children.length - 1];
  if (lastList && (lastList.tagName === 'UL' || lastList.tagName === 'OL')) {
    const priorText = children[children.length - 2];
    if (priorText && /[?？]\s*$/.test(priorText.textContent.trim())) {
      const buttonRow = document.createElement('div');
      buttonRow.className = 'choice-buttons';
      for (const li of lastList.querySelectorAll('li')) {
        const item = li.textContent.trim();
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = item;
        btn.addEventListener('click', () => {
          promptInput.value = item;
          autoGrowInput();
          promptInput.focus();
        });
        buttonRow.appendChild(btn);
      }
      wrapper.after(buttonRow);
    }
  }
}

// The touched file's real OS icon flies from the input to the monster.
function throwFileIcon(filePath) {
  window.promptBattle.getFileIcon(filePath).then((dataUrl) => {
    if (!dataUrl) return;
    const img = document.createElement('img');
    img.src = dataUrl;
    img.className = 'flying-file';
    const startRect = promptInput.getBoundingClientRect();
    const targetRect = monsterPanel.getBoundingClientRect();
    img.style.left = `${startRect.left + startRect.width / 2 - 16}px`;
    img.style.top = `${startRect.top - 16}px`;
    document.body.appendChild(img);
    img.style.setProperty('--fly-x', `${targetRect.left + targetRect.width / 2 - (startRect.left + startRect.width / 2)}px`);
    img.style.setProperty('--fly-y', `${targetRect.top + targetRect.height / 2 - startRect.top}px`);
    requestAnimationFrame(() => img.classList.add('thrown'));
    img.addEventListener('transitionend', () => img.remove());
  });
}

// ---------------------------------------------------------------------------
// Inventory: the project's file tree. Folders toggle; files open in the
// viewer/editor. Files the AI touched this run are highlighted.
const openDirs = new Set();
let treeRoot = null;
let selectedDir = null; // target of "new file/folder"; null = project root
const DRAG_TYPE = 'application/x-promptbattle-path';

function treeStatus(text, isError) {
  const el = $('tree-status');
  el.textContent = text;
  el.className = `tree-status${isError ? ' error' : ''}`;
  el.hidden = false;
  clearTimeout(treeStatus.timer);
  treeStatus.timer = setTimeout(() => (el.hidden = true), 3500);
}

const baseName = (p) => p.split('/').filter(Boolean).pop();

// A drop onto a folder (or the empty tree area = project root): an entry
// dragged from the tree moves; files dragged in from Finder are copied.
async function handleDrop(e, destDir) {
  e.preventDefault();
  e.stopPropagation();
  for (const el of document.querySelectorAll('.drop-target')) el.classList.remove('drop-target');
  if (!destDir) return;
  const internal = e.dataTransfer.getData(DRAG_TYPE);
  if (internal) {
    const r = await window.promptBattle.movePath(internal, destDir);
    if (r.ok) {
      openDirs.add(destDir);
      treeStatus(`${baseName(internal)} → ${baseName(destDir) ?? '/'} 로 옮겼다`);
    } else treeStatus(`옮길 수 없다: ${r.message}`, true);
  } else {
    const paths = [...e.dataTransfer.files].map((f) => window.promptBattle.pathForFile(f)).filter(Boolean);
    if (paths.length === 0) return;
    const r = await window.promptBattle.importFiles(paths, destDir);
    openDirs.add(destDir);
    treeStatus(
      r.failed.length ? `${r.imported}개 가져옴, ${r.failed.length}개 실패` : `${r.imported}개를 ${baseName(destDir)}(으)로 가져왔다`,
      r.failed.length > 0,
    );
  }
  refreshTree();
}

function makeDropTarget(el, destDirOf) {
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes(DRAG_TYPE) ? 'move' : 'copy';
    el.classList.add('drop-target');
  });
  el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
  el.addEventListener('drop', (e) => handleDrop(e, destDirOf()));
}
makeDropTarget(fileTreeEl, () => treeRoot);
// Stray drops anywhere else must not navigate the window to the file.
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

let newEntryKind = 'file';
function openNewEntry(kind) {
  newEntryKind = kind;
  const input = $('new-entry-name');
  input.value = '';
  const where = selectedDir ? baseName(selectedDir) : '프로젝트 루트';
  input.placeholder = `${kind === 'dir' ? '새 폴더' : '새 파일'} 이름 (${where} 안에)`;
  $('new-entry-form').hidden = false;
  input.focus();
}
$('new-file').addEventListener('click', () => openNewEntry('file'));
$('new-folder').addEventListener('click', () => openNewEntry('dir'));
$('new-entry-cancel').addEventListener('click', () => ($('new-entry-form').hidden = true));
$('new-entry-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const parent = selectedDir ?? treeRoot;
  if (!parent) return;
  const r = await window.promptBattle.createEntry(parent, $('new-entry-name').value, newEntryKind);
  if (!r.ok) {
    treeStatus(r.message, true);
    return;
  }
  $('new-entry-form').hidden = true;
  if (selectedDir) openDirs.add(selectedDir);
  treeStatus(`${baseName(r.path)}을(를) 만들었다`);
  await refreshTree();
  if (newEntryKind === 'file') openFileViewer(r.path);
});

function renderTreeNodes(nodes) {
  const ul = document.createElement('ul');
  for (const node of nodes) {
    const li = document.createElement('li');
    const item = document.createElement('div');
    item.className = `tree-item ${node.type}`;
    item.textContent = node.name;
    item.title = node.path;
    item.draggable = true;
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData(DRAG_TYPE, node.path);
      e.dataTransfer.effectAllowed = 'move';
    });
    li.append(item);
    if (node.type === 'dir') {
      const childList = renderTreeNodes(node.children ?? []);
      const setOpen = (open) => {
        item.classList.toggle('open', open);
        childList.hidden = !open;
      };
      setOpen(openDirs.has(node.path));
      item.classList.toggle('selected', selectedDir === node.path);
      item.addEventListener('click', () => {
        const open = !openDirs.has(node.path);
        if (open) openDirs.add(node.path);
        else openDirs.delete(node.path);
        setOpen(open);
        // Clicking a folder also picks it as where "new file/folder" goes;
        // clicking it again (while open→closed) keeps it selected.
        selectedDir = node.path;
        for (const el of fileTreeEl.querySelectorAll('.tree-item.selected')) el.classList.remove('selected');
        item.classList.add('selected');
      });
      makeDropTarget(item, () => node.path);
      li.append(childList);
    } else {
      if (touchedFiles.has(node.path)) item.classList.add('touched');
      item.addEventListener('click', () => openFileViewer(node.path));
    }
    ul.append(li);
  }
  return ul;
}

async function refreshTree() {
  refreshTreeBtn.classList.remove('spinning');
  void refreshTreeBtn.offsetWidth; // restart the spin
  refreshTreeBtn.classList.add('spinning');
  const tree = await window.promptBattle.listTree();
  fileTreeEl.classList.remove('tree-refreshed');
  void fileTreeEl.offsetWidth;
  fileTreeEl.classList.add('tree-refreshed');
  fileTreeEl.textContent = '';
  if (!tree) return;
  if (treeRoot !== tree.root) selectedDir = null;
  treeRoot = tree.root;
  fileTreeEl.append(renderTreeNodes(tree.children));
  if (tree.children.length === 0) {
    const note = document.createElement('div');
    note.className = 'tree-note';
    note.textContent = '(빈 폴더)';
    fileTreeEl.append(note);
  }
  if (tree.truncated) {
    const note = document.createElement('div');
    note.className = 'tree-note';
    note.textContent = '… 파일이 많아 일부만 표시';
    fileTreeEl.append(note);
  }
}
refreshTreeBtn.addEventListener('click', refreshTree);

// ---------------------------------------------------------------------------
// File viewer / editor. Text files are editable and saved back through
// main.ts (which refuses writes outside the project folder); images view only.
let editingPath = null;

function openFileViewer(filePath) {
  editingPath = null;
  fileViewerTitleEl.textContent = filePath;
  fileViewerStatus.textContent = '';
  fileViewerSaveBtn.hidden = true;
  fileViewerBodyEl.textContent = '불러오는 중...';
  fileViewerOverlay.hidden = false;
  window.promptBattle.readFileContent(filePath).then((result) => {
    fileViewerBodyEl.textContent = '';
    if (!result || result.kind === 'error') {
      fileViewerBodyEl.textContent = (result && result.message) || '이 파일을 읽을 수 없습니다.';
      return;
    }
    if (result.kind === 'image') {
      const img = document.createElement('img');
      img.src = result.url;
      fileViewerBodyEl.appendChild(img);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.className = 'file-editor';
    textarea.value = result.content;
    textarea.spellcheck = false;
    fileViewerBodyEl.appendChild(textarea);
    if (result.truncated) {
      fileViewerStatus.textContent = '파일이 너무 커서 일부만 표시 — 편집 불가';
      textarea.readOnly = true;
      return;
    }
    editingPath = filePath;
    fileViewerSaveBtn.hidden = false;
    textarea.addEventListener('input', () => {
      fileViewerStatus.textContent = '수정됨';
    });
  });
}

fileViewerSaveBtn.addEventListener('click', async () => {
  const textarea = fileViewerBodyEl.querySelector('textarea');
  if (!editingPath || !textarea) return;
  const result = await window.promptBattle.writeFile(editingPath, textarea.value);
  fileViewerStatus.textContent = result.ok ? '저장됨' : `저장 실패: ${result.message}`;
  if (result.ok) refreshTree();
});

function closeFileViewer() {
  fileViewerOverlay.hidden = true;
  editingPath = null;
}
fileViewerCloseBtn.addEventListener('click', closeFileViewer);
fileViewerOverlay.addEventListener('click', (e) => {
  if (e.target === fileViewerOverlay) closeFileViewer();
});

// ---------------------------------------------------------------------------
// Weapon switch mid-run: applies to the very next attack.
weaponSelect.addEventListener('change', async () => {
  const w = await window.promptBattle.setModel(weaponSelect.value);
  appendLog(`무기를 바꿨다: ${weaponName()} — ${classWeapon(w.model).flavor} (x${w.multiplier})`, 'story-line');
  renderSwordLevel();
});

sessionBannerUse.addEventListener('click', () => {
  promptInput.value = sessionBannerPrompt.textContent;
  promptInput.focus();
});

function continuationPrompt() {
  const recap = lastSummary.replace(/\s+/g, ' ').trim().slice(0, 400);
  return `/new 이전 세션에서 하던 작업을 이어서 진행해줘.${recap ? ` 지금까지의 진행 상황: ${recap}` : ''}`;
}

function renderBattleEvent(event) {
  switch (event.type) {
    case 'runStart':
      setBar(playerHpFill, playerHpLabel, event.playerHp, event.playerMaxHp, '');
      appendLog('새로운 세션으로 모험을 시작한다.', 'story-line');
      break;
    case 'floorStart': {
      const info = chapterInfo(activeTheme, event.chapter);
      if (event.floor % 6 === 0) {
        appendLog(`— 챕터 ${event.chapter}: ${info.title} —`, 'story-intro');
        appendLog(info.intro, 'story-intro');
      }
      chapterBanner.textContent = `챕터 ${event.chapter} · ${info.title} · ${(event.floor % 6) + 1}/6층`;
      currentMonsterName = event.isBoss ? info.boss : event.monsterName;
      monsterPanel.classList.toggle('boss', event.isBoss);
      monsterPanel.classList.remove('defeated');
      monsterNameEl.textContent = event.isBoss ? `보스: ${currentMonsterName}` : `${event.floor + 1}층: ${currentMonsterName}`;
      monsterArtEl.innerHTML = monsterSvg(event.monsterIndex, event.isBoss);
      setBar(hpBarFillEl, hpLabelEl, event.maxHp, event.maxHp, ' HP');
      appendLog(event.isBoss ? `보스 ${currentMonsterName}이(가) 모습을 드러냈다!` : `${currentMonsterName}이(가) 나타났다!`, event.isBoss ? 'crit' : undefined);
      break;
    }
    case 'hesitate':
      appendLog('망설였다. 이번 턴은 공격하지 못했다.');
      turnConcluded();
      break;
    case 'turnStart':
      $('turn-panel').hidden = false;
      turnStatusEl.textContent = `AI가 ${weaponName()}을(를) 들고 작업 중...`;
      streamedThisTurn = false;
      activeAgents.clear();
      renderParty();
      startTurnTimer();
      startBugGame();
      break;
    case 'partialHit': {
      const type = event.agentEvent.agentId ? agentTypeById.get(event.agentEvent.agentId) : undefined;
      const line = {
        wizard: `🧙✨ 마법사가 불러낸 정령이 덮쳤다! ${event.damage}의 피해!`,
        archer: `🏹 궁수의 동료들이 일제히 화살을 날렸다! ${event.damage}의 피해!`,
        swordsman: `🏹🗡 궁수의 엄호 사격 속에 검사가 파고들어 베었다! ${event.damage}의 피해!`,
      }[type] ?? `  » ${event.damage}의 피해!`;
      appendLog(line, type ? `partial-hit party-${type}` : 'partial-hit');
      flashMonster();
      break;
    }
    case 'agentEvent': {
      const ae = event.agentEvent;
      if (ae.type === 'text') {
        streamedThisTurn = true;
        liveAppend(ae.value);
        break;
      }
      if (ae.type === 'agentStart') {
        finalizeLive();
        activeAgents.set(ae.id, ae);
        agentTypeById.set(ae.id, ae.agentType);
        renderParty();
        const r = roleOf(ae.agentType);
        appendLog(`${r.icon} ${r.name}가 출격했다: ${ae.description}`, `party-line party-${ae.agentType}`);
        break;
      }
      if (ae.type === 'agentEnd') {
        const member = activeAgents.get(ae.id);
        activeAgents.delete(ae.id);
        renderParty();
        if (member) {
          const r = roleOf(member.agentType);
          appendLog(`${r.icon} ${r.name}가 임무를 마치고 돌아왔다.`, `party-line party-${member.agentType}`);
        }
        break;
      }
      finalizeLive();
      const isFile = ae.type === 'file';
      const who = ae.agentId ? `${roleOf(agentTypeById.get(ae.agentId)).icon} ` : '';
      const line = appendLog(`${who}${isFile ? '→ 수정 중' : '→ 실행 중'}: ${ae.value}`, ae.type);
      if (isFile) {
        touchedFiles.add(event.agentEvent.value);
        line.classList.add('clickable');
        line.title = '클릭해서 파일 보기/수정';
        line.addEventListener('click', () => openFileViewer(event.agentEvent.value));
        throwFileIcon(event.agentEvent.value);
      }
      break;
    }
    case 'agentError':
      appendLog(`공격이 빗나갔다! 주문이 실패했다: ${event.error}`, 'error');
      turnConcluded();
      break;
    case 'attack': {
      if (event.damage === 0) {
        appendLog(pick(DODGE_LINES), 'dodge');
      } else {
        const label = event.crit ? ' 크리티컬 히트!' : '';
        appendLog(`${pick(ATTACK_LINES[chosenClass] ?? ATTACK_LINES.swordsman)(event.damage, weaponName())}${label}`, event.crit ? 'crit' : undefined);
        flashMonster();
      }
      if (event.matchedKeywords.length > 0) appendLog(`(키워드: ${event.matchedKeywords.join(', ')})`);
      turnConcluded();
      break;
    }
    case 'agentSummary':
      lastSummary = event.summary;
      // Already typed out live from the stream; otherwise type it now.
      if (!streamedThisTurn) {
        liveAppend(event.summary);
        finalizeLive();
      }
      break;
    case 'hpChanged':
      setBar(hpBarFillEl, hpLabelEl, event.hp, event.maxHp, ' HP');
      break;
    case 'monsterAttack':
      appendLog(`${currentMonsterName}${pick(COUNTER_LINES)} ${event.damage}의 피해를 받았다!`, 'error');
      shakeScreen();
      break;
    case 'playerHpChanged':
      setBar(playerHpFill, playerHpLabel, event.hp, event.maxHp, '');
      break;
    case 'playerDefeated':
      appendLog('용사가 쓰러졌다...', 'error');
      break;
    case 'floorCleared':
      monsterPanel.classList.add('defeated');
      appendLog(`${currentMonsterName} 처치! +${event.xpGained} XP (체력 조금 회복)`, 'victory');
      break;
    case 'chapterCleared': {
      const info = chapterInfo(activeTheme, event.chapter);
      appendLog(`★ 챕터 ${event.chapter} 클리어! ★`, 'victory');
      appendLog(info.outro, 'story-intro');
      appendLog('이야기는 계속된다... (지금 도망쳐도 다음에 이어서 할 수 있다)', 'story-line');
      break;
    }
    case 'sessionReset':
      currentSessionId = null;
      contextUsage = null;
      renderUsage();
      sessionBanner.hidden = true;
      appendLog('새로운 세션이 시작되었다.', 'story-line');
      break;
    case 'sessionNearlyFull':
      sessionBannerText.textContent = `세션이 ${Math.round((event.usedTokens / event.contextWindow) * 100)}% 찼습니다. 아래 프롬프트를 쳐서 새로운 세션으로 이어가세요.`;
      sessionBannerPrompt.textContent = continuationPrompt();
      sessionBanner.hidden = false;
      break;
    case 'sessionSaved':
      currentSessionId = event.sessionId;
      break;
    case 'fleeAttempt':
      appendLog(event.success ? '도망쳤다! 보상 없이 다음 층으로 향한다.' : '도망치지 못했다! 한 턴을 날렸다.', event.success ? 'story-line' : 'error');
      break;
    case 'fleeBlocked':
      appendLog('보스에게선 도망칠 수 없다!', 'error');
      break;
    case 'coinsChanged':
      coins = event.coins;
      renderCoins();
      appendLog(`🪙 +${event.gained} 코인 (보유 ${event.coins})`, 'coin-line');
      break;
    case 'merchantOpen':
      coins = event.coins;
      renderCoins();
      appendLog('상인 고블린이 나타났다! "헤헤, 구경하고 가~"', 'coin-line');
      openMerchant(event);
      break;
    case 'purchased':
      coins = event.coins;
      renderCoins();
      appendLog(`${itemName(event.itemId)}을(를) 샀다! (남은 코인 ${event.coins})`, 'victory');
      break;
    case 'purchaseFailed':
      appendLog(`살 수 없다: ${event.reason}`, 'error');
      break;
    case 'betResult': {
      coins = event.coins;
      renderCoins();
      betAmountInput.max = String(coins);
      const face = '⚀⚁⚂⚃⚄⚅'[event.roll - 1];
      const parity = event.roll % 2 ? '홀' : '짝';
      betResultEl.textContent = `${face} ${event.roll} (${parity}) ${event.won ? `+${event.amount}` : `-${event.amount}`}`;
      betResultEl.className = `bet-result ${event.won ? 'win' : 'lose'}`;
      void betResultEl.offsetWidth; // restart the pop animation
      betResultEl.classList.add('rolled');
      appendLog(
        event.won
          ? `🎲 ${event.roll}, ${parity}! 맞혔다! +${event.amount} 코인 (보유 ${event.coins})`
          : `🎲 ${event.roll}, ${parity}... 틀렸다. -${event.amount} 코인 (보유 ${event.coins}) 상인 고블린: "헤헤헤~"`,
        event.won ? 'victory' : 'error',
      );
      break;
    }
    case 'betFailed':
      appendLog(`걸 수 없다: ${event.reason}`, 'error');
      break;
    case 'merchantClosed':
      appendLog('상인 고블린: "또 와~"', 'story-line');
      closeMerchant();
      break;
    case 'bagChanged':
      bag = event.bag;
      renderBag();
      break;
    case 'itemUsed': {
      const lines = {
        potion: '회복 물약을 마셨다! 체력이 회복된다.',
        whetstone: '숫돌로 무기를 갈았다! 다음 공격은 2배.',
        amulet: '수호의 부적이 빛난다! 다음 반격을 막아준다.',
      };
      appendLog(lines[event.itemId] ?? `${itemName(event.itemId)} 사용!`, 'victory');
      break;
    }
    case 'itemUseFailed':
      appendLog(`${itemName(event.itemId)}을(를) 쓸 수 없다.`, 'error');
      break;
    case 'statPointsChanged':
      statPoints = event.points;
      stats = event.stats;
      renderStatPanel();
      appendLog(`⭐ 능력치 포인트 +1! (보유 ${event.points}) 아래 버튼으로 원하는 능력치를 올리자.`, 'coin-line');
      break;
    case 'statRaised': {
      statPoints = event.points;
      stats = event.stats;
      renderStatPanel();
      const def = statDefs.find((s) => s.id === event.stat);
      appendLog(`${def?.name ?? event.stat}이(가) Lv.${event.stats[event.stat]}(으)로 올랐다! (${def?.effect ?? ''})`, 'victory');
      break;
    }
    case 'statRaiseFailed':
      appendLog(`능력치를 올릴 수 없다: ${event.reason}`, 'error');
      break;
    case 'blacksmithOpen':
      coins = event.coins;
      renderCoins();
      appendLog('대장장이가 나타났다! "그 검, 좀 더 날카롭게 해줄까?"', 'coin-line');
      openBlacksmith(event);
      break;
    case 'enhanceResult': {
      coins = event.coins;
      swordLevel = event.swordLevel;
      renderCoins();
      renderSwordLevel();
      renderForgeInfo(event.odds);
      const result = $('forge-result');
      const text = { success: `성공! +${event.swordLevel}강`, fail: `실패... +${event.swordLevel}강 유지`, broken: `💥 ${classWeapon(weaponSelect.value).name}이(가) 부러졌다! +0` }[event.outcome];
      result.textContent = text;
      result.className = `bet-result ${event.outcome === 'success' ? 'win' : 'lose'}`;
      void result.offsetWidth;
      result.classList.add('rolled');
      appendLog(
        event.outcome === 'success'
          ? `🔨 깡! 깡! 강화 성공! "${weaponName()}" +${event.swordLevel}(으)로 거듭났다! (피해 +${event.swordLevel * 10}%)`
          : event.outcome === 'broken'
            ? `🔨 쩌저적... ${classWeapon(weaponSelect.value).name}이(가) 부러졌다! "${weaponName()}"부터 다시 강화해야 한다. 대장장이: "...미안하게 됐군."`
            : `🔨 강화 실패... 검은 +${event.swordLevel}강 그대로다.`,
        event.outcome === 'success' ? 'victory' : 'error',
      );
      break;
    }
    case 'enhanceFailed':
      appendLog(`강화할 수 없다: ${event.reason}`, 'error');
      break;
    case 'blacksmithClosed':
      appendLog('대장장이: "또 들르라고."', 'story-line');
      closeBlacksmith();
      break;
    case 'slotSaved':
      slots[event.slot - 1] = event.data;
      appendLog(`💾 슬롯 ${event.slot}에 저장했다.`, 'victory');
      break;
    case 'saveFailed':
      appendLog(`저장 실패: ${event.reason}`, 'error');
      break;
    case 'sessionSwitched':
      currentSessionId = event.sessionId;
      contextUsage = null;
      renderUsage();
      sessionBanner.hidden = true;
      appendLog('🔀 Claude 세션을 바꿨다. 다음 공격부터 이 세션으로 이어간다.', 'story-line');
      break;
    case 'contextUsage':
      contextUsage = event;
      renderUsage();
      break;
    case 'counterBlocked':
      appendLog(`${currentMonsterName}의 반격을 수호의 부적이 막아냈다!`, 'victory');
      break;
    case 'runEnded':
      break;
  }
}

window.promptBattle.onBattleEvent(renderBattleEvent);

// ---------------------------------------------------------------------------
// Claude sessions: the setup picker and the in-battle switcher both list this
// folder's Claude Code sessions (including terminal `claude` ones).
const shortTime = (ms) => {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
};

async function refreshSessionPicker(folder) {
  const [sessions, saved] = await Promise.all([window.promptBattle.listSessions(folder), window.promptBattle.getFolderSession(folder)]);
  sessionSelect.textContent = '';
  const fresh = document.createElement('option');
  fresh.value = '';
  fresh.textContent = '✨ 새 세션으로 시작';
  sessionSelect.append(fresh);
  for (const s of sessions) {
    const option = document.createElement('option');
    option.value = s.sessionId;
    option.textContent = `${s.title} · ${shortTime(s.lastModified)}${s.sessionId === saved.sessionId ? ' (마지막)' : ''}`;
    sessionSelect.append(option);
  }
  sessionSelect.value = sessions.some((s) => s.sessionId === saved.sessionId) ? saved.sessionId : '';
  sessionPicker.hidden = sessions.length === 0;
}

async function renderSessionHistory(sessionId, title) {
  const history = await window.promptBattle.sessionHistory(chosenFolder, sessionId);
  if (history.length === 0) return;
  const shown = history.slice(-50);
  appendLog(`— 세션 "${title}" 대화 기록 (${shown.length}/${history.length}) —`, 'history-header');
  for (const entry of shown) {
    if (entry.role === 'user') appendUserChat(entry.text, 'history');
    else renderMarkdownLog(entry.text, 'history');
  }
  appendLog('— 여기서부터 이어서 —', 'history-header');
}

async function openSessionOverlay() {
  const list = $('session-list');
  list.textContent = '불러오는 중...';
  $('session-overlay').hidden = false;
  const sessions = await window.promptBattle.listSessions(chosenFolder);
  list.textContent = '';
  const addRow = (label, sub, isCurrent, onPick) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `slot-row${isCurrent ? ' current' : ''}`;
    const strong = document.createElement('strong');
    strong.textContent = label;
    const span = document.createElement('span');
    span.textContent = sub;
    btn.append(strong, span);
    btn.disabled = isCurrent;
    btn.addEventListener('click', () => {
      $('session-overlay').hidden = true;
      onPick();
    });
    list.append(btn);
  };
  addRow('✨ 새 세션', '깨끗한 컨텍스트로 새로 시작', !currentSessionId, () => window.promptBattle.submitPrompt('/new'));
  for (const s of sessions) {
    const isCurrent = s.sessionId === currentSessionId;
    addRow(s.title, `${shortTime(s.lastModified)}${isCurrent ? ' · 현재 세션' : ''}`, isCurrent, async () => {
      window.promptBattle.submitPrompt(`/session ${s.sessionId}`);
      await renderSessionHistory(s.sessionId, s.title);
    });
  }
}
$('session-btn').addEventListener('click', openSessionOverlay);
$('session-close').addEventListener('click', () => ($('session-overlay').hidden = true));

// ---------------------------------------------------------------------------
// Save slots: saving is a free action in battle; loading starts a run from
// the setup screen with the slot's folder, theme, weapon and state.
function slotSummary(slot) {
  const theme = THEMES.find((t) => t.id === slot.themeId);
  const folderName = slot.cwd.split('/').filter(Boolean).pop();
  return `${theme?.title ?? slot.themeId} · ${floorText(slot.floor)}${slot.monsterHp ? ` (몬스터 HP ${slot.monsterHp})` : ''} · HP ${slot.playerHp}/${slot.playerMaxHp} · 🪙 ${slot.coins} · 무기 +${slot.swordLevel} · 📁 ${folderName} · ${shortTime(slot.savedAt)}`;
}

function renderSlotRows(container, onPick, allowEmpty) {
  container.textContent = '';
  slots.forEach((slot, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot-row';
    const strong = document.createElement('strong');
    strong.textContent = `슬롯 ${i + 1}`;
    const span = document.createElement('span');
    span.textContent = slot ? slotSummary(slot) : '비어 있음';
    btn.append(strong, span);
    btn.disabled = !slot && !allowEmpty;
    btn.addEventListener('click', () => onPick(i + 1, slot));
    container.append(btn);
  });
}

async function refreshSlots() {
  slots = await window.promptBattle.listSlots();
  renderSlotRows($('slot-list'), (n, slot) => slot && startGame({ loadSlot: n, slot }), false);
}
refreshSlots();

$('save-btn').addEventListener('click', () => {
  renderSlotRows($('save-slots'), (n) => {
    window.promptBattle.submitPrompt(`/save ${n}`);
    $('save-overlay').hidden = true;
  }, true);
  $('save-overlay').hidden = false;
});
$('save-close').addEventListener('click', () => ($('save-overlay').hidden = true));

startBtn.addEventListener('click', () => startGame({}));

async function startGame({ loadSlot, slot }) {
  if (slot) {
    chosenFolder = slot.cwd;
    chosenThemeId = slot.themeId;
    chosenWeapon = slot.model;
    if (slot.heroClass) chosenClass = slot.heroClass;
    renderWeaponOptions();
  }
  if (!chosenFolder) return;
  const difficulty = slot ? slot.difficulty : document.querySelector('input[name="difficulty"]:checked').value;
  activeTheme = THEMES.find((t) => t.id === chosenThemeId) || THEMES[0];
  const floor = savedFloor(activeTheme.id);
  const startFloor = floor > 0 && continueCheckbox.checked ? floor : 0;
  const sessionId = slot ? slot.sessionId : sessionPicker.hidden ? undefined : sessionSelect.value || undefined;
  currentSessionId = sessionId ?? null;
  weaponSelect.value = chosenWeapon;
  touchedFiles.clear();
  lastSummary = '';
  sessionBanner.hidden = true;
  setupErrorEl.hidden = true;
  setupScreen.hidden = true;
  dungeonScreen.hidden = false;
  logEl.textContent = '';
  const from = slot ?? profile;
  coins = from.coins;
  bag = { ...from.bag };
  // Hero stats are per-run: a new game starts from zero; a save slot restores its own.
  stats = { attack: 0, defense: 0, vitality: 0, ...slot?.stats };
  statPoints = slot?.statPoints ?? 0;
  swordLevel = from.swordLevel;
  renderCoins();
  renderSwordLevel();
  closeMerchant();
  closeBlacksmith();
  exitOverlay.hidden = true;
  setInputEnabled(true);
  renderBag();
  if (sessionId) {
    const title = sessionSelect.selectedOptions[0]?.textContent ?? '';
    await renderSessionHistory(sessionId, slot ? '저장된 세션' : title.replace(/ · .*$/, ''));
    appendLog('이전 세션을 이어서 모험을 계속한다.', 'story-line');
  } else {
    renderHistory((await window.promptBattle.getFolderSession(chosenFolder)).history);
  }
  if (slot) appendLog(`💾 슬롯 ${loadSlot}을(를) 불러왔다. ${slotSummary(slot)}`, 'story-line');
  contextUsage = null;
  refreshUsage(true);
  try {
    const party = $('party-mode').checked;
    const heroClassId = chosenClass;
    const runPromise = window.promptBattle.startRun({ cwd: chosenFolder, difficulty, model: chosenWeapon, themeId: activeTheme.id, startFloor, sessionId, loadSlot, party, heroClass: heroClassId });
    setTimeout(refreshTree, 300);
    const { summary, profile: updated } = await runPromise;
    profile = updated;
    dungeonScreen.hidden = true;
    summaryScreen.hidden = false;
    summaryTitleEl.textContent = summary.defeated ? '패배...' : '런 종료';
    summaryTextEl.textContent = `${summary.floorsCleared}층 클리어, +${summary.xpGained} XP 획득, 보유 코인 ${summary.coins}. 현재 레벨 ${updated.level} (총 ${updated.xp} XP).`;
    const resumeFloor = savedFloor(activeTheme.id);
    summaryStoryEl.textContent =
      resumeFloor > 0
        ? `${activeTheme.title}: 다음엔 ${floorText(resumeFloor)} "${chapterInfo(activeTheme, Math.floor(resumeFloor / 6) + 1).title}"부터 이어할 수 있다. 이 폴더의 세션도 이어갈 수 있다.`
        : '';
  } catch (err) {
    // An unexpected main-process error (agent-turn errors never reject this
    // call). Without this, the player would be stuck on the dungeon screen.
    dungeonScreen.hidden = true;
    setupScreen.hidden = false;
    setupErrorEl.textContent = `문제가 발생했습니다: ${err && err.message ? err.message : String(err)}`;
    setupErrorEl.hidden = false;
  }
}

attackForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = promptInput.value;
  const trimmed = text.trim();
  promptInput.value = '';
  // Only a real agent turn (or an empty hesitate) waits on an event that
  // re-enables input; slash commands (/new alone, /use, /buy, /flee...)
  // resolve instantly, so disabling for them would lock the input.
  // At a shop an empty line just leaves it (no hesitate follows).
  const atMerchant = !merchantPanel.hidden || !$('blacksmith-panel').hidden;
  const startsTurn = (!trimmed.startsWith('/') && !(atMerchant && trimmed === '')) || /^\/new\s+\S/.test(trimmed);
  if (startsTurn) setInputEnabled(false);
  // Show my message right away, then jump to the bottom.
  const shown = trimmed.startsWith('/new ') ? trimmed.slice(5).trim() : trimmed;
  if (shown && !shown.startsWith('/') && !atMerchant) appendUserChat(shown);
  window.promptBattle.submitPrompt(text);
  autoGrowInput();
  requestAnimationFrame(scrollLogToBottom);
});

fleeBtn.addEventListener('click', () => window.promptBattle.submitPrompt('/flee'));
merchantLeaveBtn.addEventListener('click', () => window.promptBattle.submitPrompt('/leave'));

const bet = (choice) => window.promptBattle.submitPrompt(`/bet ${choice} ${Math.floor(Number(betAmountInput.value) || 0)}`);
$('bet-odd').addEventListener('click', () => bet('odd'));
$('bet-even').addEventListener('click', () => bet('even'));
$('bet-all').addEventListener('click', () => {
  betAmountInput.value = String(coins);
});

exitBtn.addEventListener('click', () => {
  exitOverlay.hidden = false;
});
exitCancelBtn.addEventListener('click', () => {
  exitOverlay.hidden = true;
  promptInput.focus();
});
exitConfirmBtn.addEventListener('click', () => {
  exitOverlay.hidden = true;
  setInputEnabled(false);
  window.promptBattle.submitPrompt('/quit');
});

playAgainBtn.addEventListener('click', async () => {
  summaryScreen.hidden = true;
  setupScreen.hidden = false;
  await loadSetup();
  await refreshSlots();
  if (chosenFolder) await refreshSessionPicker(chosenFolder);
});

// The prompt box grows with its text (up to ~40% of the window); Enter
// attacks, Shift+Enter adds a line. Korean IME composition is respected.
function autoGrowInput() {
  promptInput.style.height = 'auto';
  promptInput.style.height = `${Math.min(promptInput.scrollHeight, window.innerHeight * 0.4)}px`;
}
promptInput.addEventListener('input', autoGrowInput);
promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
    e.preventDefault();
    if (!promptInput.disabled) attackForm.requestSubmit();
  }
});
