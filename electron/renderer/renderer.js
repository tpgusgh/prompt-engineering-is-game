// electron/renderer/renderer.js
import { marked } from '../../node_modules/marked/lib/marked.esm.js';
import { monsterSvg, merchantSvg, blacksmithSvg } from './monster-art.js';
import { SNIPPETS } from './typing-snippets.js';
import { MONSTER_LINES, BOSS_LINES, MERCHANT_IDLE, BLACKSMITH_IDLE } from './monster-lines.js';
import { playMusic, stopMusic, pushMusic, popMusic, sfx, getAudioSettings, setVolume, toggleMute } from './audio.js';

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
  claudeSettings = profile.claude;
  heroClasses = info.classes;
  xpPerLevel = info.xpPerLevel ?? xpPerLevel;
  titles = info.titles ?? titles;
  runXp = 0;
  renderXp();
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
  renderClaudeSettings();
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
  profileLineEl.textContent = `🎖 ${titleOf(profile.level)} · 레벨 ${profile.level} · 총 ${profile.xp} XP · ${profile.totalWins}승 · ${profile.coins} 코인 · 최대 HP ${profile.maxHp} · 무기 +${profile.swordLevel}`;
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
  const fetched = (await window.promptBattle.getUsage()) ?? null;
  // Keep the last good numbers on a failed fetch, and retry next time.
  if (fetched) planUsage = fetched;
  else {
    usageFetchedAt = 0;
    if (planUsage === 'loading') planUsage = null;
  }
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
  for (const btn of document.querySelectorAll('.bag-list button, .merchant-panel button')) btn.disabled = !enabled;
  if (statDefs.length) renderStatPanel();
}

// A turn emits several hpChanged events (one per partial hit, plus one at
// the end), so hpChanged can't mean "turn over" — only these events do.
function turnConcluded() {
  setInputEnabled(true);
  endOpenAgentRuns();
  refreshUsage(false);
  stopTurnTimer();
  stopTyping();
  finalizeLive();
  $('turn-panel').hidden = true;
  refreshTree();
  if (pendingQuest) showQuest(pendingQuest);
}

// ---------------------------------------------------------------------------
// Turn timer + party (subagents) status + the waiting mini-game.
let turnStartedAt = 0;
let turnTimer = null;
const fmtElapsed = (ms) => {
  const s = Math.floor(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초` : `${s}초`;
};
const PROMPT_PLACEHOLDER = promptInput.placeholder;
function startTurnTimer() {
  turnStartedAt = Date.now();
  const tick = () => {
    const elapsed = fmtElapsed(Date.now() - turnStartedAt);
    $('turn-timer').textContent = `⏱ ${elapsed}`;
    turnStatusEl.textContent = `🤖 AI가 ${weaponName()}을(를) 들고 작업 중 · ${elapsed}째`;
    promptInput.placeholder = `🤖 AI 작업 중... ⏱ ${elapsed}`;
  };
  tick();
  clearInterval(turnTimer);
  turnTimer = setInterval(tick, 1000);
}
function stopTurnTimer() {
  clearInterval(turnTimer);
  turnTimer = null;
  promptInput.placeholder = PROMPT_PLACEHOLDER;
  if (turnStartedAt) appendLog(`⏱ 이번 턴: ${fmtElapsed(Date.now() - turnStartedAt)}`, 'sys-line');
  turnStartedAt = 0;
}

const ROLES = {
  wizard: { icon: '🧙', name: '마법사' },
  swordsman: { icon: '🗡', name: '검사' },
  archer: { icon: '🏹', name: '궁수' },
  courier: { icon: '🦅', name: '전령' },
};
const roleOf = (type) => ROLES[type] ?? { icon: '🤖', name: type };
const activeAgents = new Map(); // tool-use id -> { agentType, description }
const agentTypeById = new Map(); // survives agentEnd, for late events
let backgroundRunning = 0;
function renderParty() {
  const el = $('party-status');
  const members = [...activeAgents.values()];
  const bg = backgroundRunning > 0 ? `  ·  ⏳ 백그라운드 작업 ${backgroundRunning}개 (끝나면 Claude가 이어서 답함)` : '';
  if (members.length === 0) {
    el.textContent = `프로세스 1개 (용사 단독)${bg}`;
    return;
  }
  el.textContent = `프로세스 ${members.length + 1}개 동시 진행 · ` + members.map((m) => `${roleOf(m.agentType).icon} ${roleOf(m.agentType).name}: ${m.description}`).join('  ·  ') + bg;
}

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
$('typing-settings').addEventListener('click', () => {
  $('typing-langs').hidden = !$('typing-langs').hidden;
});
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

function startTyping() {
  typingActive = true;
  typingDone = 0;
  $('typing-stats').textContent = '';
  nextSnippet();
}

function stopTyping() {
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
  pendingQuest = null; // only the turn's last reply can be a question to answer
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
    decorateReply(el);
    attachChoices(el);
    noteQuestion(el);
    scrollLogToBottom();
  };
  b.push = (text) => {
    b.target += text;
    typingBehind.add(b);
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
      typingBehind.delete(b);
      drainBattleEvents();
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

// My most recent message, shown next to the monster so I remember what I
// asked for while the AI works on it.
function setLastPrompt(text) {
  $('last-prompt-text').textContent = text;
  $('last-prompt').hidden = !text;
  $('last-prompt').classList.remove('expanded');
}
$('last-prompt').addEventListener('click', () => $('last-prompt').classList.toggle('expanded'));

function appendUserChat(text, extraClass) {
  setLastPrompt(text);
  const line = appendLog(text, `user-chat${extraClass ? ` ${extraClass}` : ''}`);
  line.dataset.who = '나';
  return line;
}

const itemName = (id) => items.find((i) => i.id === id)?.name ?? id;

function renderCoins() {
  coinLabel.textContent = `🪙 ${coins}`;
  if ($('bag-coins')) $('bag-coins').textContent = `🪙 ${coins}`;
}

// The bag: each item is a button that uses it (a free action, no turn spent).
// The game inventory (sidebar, under the file tree): each item with its
// count, what it does, and a use button (a free action).
const ITEM_ICONS = { bandage: '🩹', potion: '🧪', whetstone: '🪨', amulet: '🧿', smoke: '💨' };
function renderBag() {
  bagEl.textContent = '';
  $('bag-coins').textContent = `🪙 ${coins}`;
  const entries = Object.entries(bag).filter(([, n]) => n > 0);
  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'bag-empty';
    empty.textContent = '비어 있음 — 상인 고블린에게 붕대·물약 등을 살 수 있다';
    bagEl.append(empty);
    return;
  }
  for (const [id, count] of entries) {
    const item = items.find((i) => i.id === id);
    const row = document.createElement('div');
    row.className = 'bag-item';
    const icon = document.createElement('span');
    icon.className = 'bag-icon';
    icon.textContent = ITEM_ICONS[id] ?? '📦';
    const info = document.createElement('div');
    info.className = 'bag-info';
    const name = document.createElement('strong');
    name.textContent = `${itemName(id)} ×${count}`;
    const desc = document.createElement('span');
    desc.textContent = item?.description ?? '';
    info.append(name, desc);
    const use = document.createElement('button');
    use.type = 'button';
    use.textContent = '사용';
    use.disabled = !inputEnabled;
    use.title = '턴 소모 없이 사용';
    use.addEventListener('click', () => window.promptBattle.submitPrompt(`/use ${id}`));
    row.append(icon, info, use);
    bagEl.append(row);
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
  decorateReply(wrapper);
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

// Unsaved edits: closing the editor, opening another file, or closing the
// window first asks whether to save (compared with the last saved content,
// so editing back to the original counts as unchanged).
let savedContent = null;
const editorTextarea = () => fileViewerBodyEl.querySelector('textarea');
function isEditorDirty() {
  const ta = editorTextarea();
  return Boolean(!fileViewerOverlay.hidden && editingPath && ta && !ta.readOnly && savedContent !== null && ta.value !== savedContent);
}
function renderDirty() {
  fileViewerStatus.textContent = isEditorDirty() ? '● 저장 안 됨' : savedContent !== null && editingPath ? '저장됨' : fileViewerStatus.textContent;
}
let unsavedProceed = null;
function guardUnsaved(proceed) {
  if (!isEditorDirty()) return proceed();
  unsavedProceed = proceed;
  $('unsaved-file').textContent = editingPath;
  $('unsaved-overlay').hidden = false;
  $('unsaved-save').focus();
}
function closeUnsavedPrompt() {
  $('unsaved-overlay').hidden = true;
  unsavedProceed = null;
}
$('unsaved-cancel').addEventListener('click', () => {
  closeUnsavedPrompt();
  editorTextarea()?.focus();
});
$('unsaved-discard').addEventListener('click', () => {
  const proceed = unsavedProceed;
  closeUnsavedPrompt();
  savedContent = null; // drop the edits
  proceed?.();
});
$('unsaved-save').addEventListener('click', async () => {
  const proceed = unsavedProceed;
  if (await saveEditor()) {
    closeUnsavedPrompt();
    proceed?.();
  } else closeUnsavedPrompt(); // keep editing; the status shows the error
});
// Closing the window/app with unsaved edits: main shows a native dialog;
// on "save and leave" it asks us to save, and closes only if that worked.
window.promptBattle.onSaveAndClose(async () => {
  const ok = await saveEditor();
  window.promptBattle.saveAndCloseDone(ok);
});
window.addEventListener('beforeunload', (e) => {
  if (isEditorDirty()) {
    e.preventDefault();
    e.returnValue = false;
  }
});

function openFileViewer(filePath) {
  guardUnsaved(() => showFile(filePath));
}

function showFile(filePath) {
  editingPath = null;
  savedContent = null;
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
    savedContent = result.content;
    fileViewerSaveBtn.hidden = false;
    textarea.addEventListener('input', renderDirty);
  });
}

async function saveEditor() {
  const textarea = editorTextarea();
  if (!editingPath || !textarea) return false;
  const content = textarea.value;
  const result = await window.promptBattle.writeFile(editingPath, content);
  fileViewerStatus.textContent = result.ok ? '저장됨' : `저장 실패: ${result.message}`;
  if (result.ok) {
    savedContent = content;
    refreshTree();
  }
  return result.ok;
}
fileViewerSaveBtn.addEventListener('click', saveEditor);

function closeFileViewer() {
  fileViewerOverlay.hidden = true;
  editingPath = null;
  savedContent = null;
}
const requestCloseViewer = () => guardUnsaved(closeFileViewer);
fileViewerCloseBtn.addEventListener('click', requestCloseViewer);
fileViewerOverlay.addEventListener('click', (e) => {
  if (e.target === fileViewerOverlay) requestCloseViewer();
});
document.addEventListener('keydown', (e) => {
  if (fileViewerOverlay.hidden) return;
  if (e.key === 'Escape' && $('unsaved-overlay').hidden) requestCloseViewer();
  // Cmd/Ctrl+S saves while editing.
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveEditor();
  }
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

// BGM per situation (theme/chapter battle, boss, shop, forge) and SFX.
function soundFor(event) {
  switch (event.type) {
    case 'floorStart':
      playMusic(event.isBoss ? 'boss' : activeTheme.id, { chapter: event.chapter });
      sfx(event.isBoss ? 'boss' : 'monster');
      break;
    case 'partialHit':
    case 'typingHit':
      sfx('partial');
      break;
    case 'attack':
      sfx(event.damage === 0 ? 'dodge' : event.crit ? 'crit' : 'hit');
      break;
    case 'monsterAttack':
      sfx('hurt');
      break;
    case 'counterBlocked':
      sfx('block');
      break;
    case 'floorCleared':
      sfx('win');
      break;
    case 'chapterCleared':
      sfx('fanfare');
      break;
    case 'coinsChanged':
      sfx('coin');
      break;
    case 'purchased':
      sfx('buy');
      break;
    case 'merchantOpen':
      playMusic('shop');
      break;
    case 'blacksmithOpen':
      playMusic('forge');
      break;
    case 'enhanceResult':
      sfx(event.outcome === 'success' ? 'enhanceOk' : event.outcome === 'broken' ? 'shatter' : 'enhanceFail');
      break;
    case 'betResult':
      sfx(event.won ? 'coin' : 'enhanceFail');
      break;
    case 'statRaised':
      sfx('levelUp');
      break;
    case 'fleeAttempt':
      sfx(event.success ? 'flee' : 'hurt');
      break;
    case 'playerDefeated':
      stopMusic();
      sfx('defeat');
      break;
    case 'agentEvent':
      if (event.agentEvent.type === 'agentStart') sfx('party');
      break;
    case 'runEnded':
      stopMusic();
      break;
  }
}

const muteBtn = $('mute-btn');
const volumeSlider = $('volume');
function renderSoundControls() {
  const { volume, muted } = getAudioSettings();
  muteBtn.textContent = muted ? '🔇' : '🔊';
  volumeSlider.value = String(volume);
}
muteBtn.addEventListener('click', () => {
  toggleMute();
  renderSoundControls();
});
volumeSlider.addEventListener('input', () => {
  setVolume(Number(volumeSlider.value));
  renderSoundControls();
});
renderSoundControls();
playMusic('title');

function renderBattleEvent(event) {
  soundFor(event);
  speechFor(event);
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
    case 'monsterWaits':
      appendLog(`❔ AI가 묻고 있다. ${currentMonsterName}이(가) 대답을 기다린다...`);
      break;
    case 'hesitate':
      appendLog('망설였다. 이번 턴은 공격하지 못했다.');
      turnConcluded();
      break;
    case 'turnStart':
      $('turn-panel').hidden = false;
      turnStatusEl.textContent = `AI가 ${weaponName()}을(를) 들고 작업 중...`;
      streamedThisTurn = false;
      backgroundRunning = 0;
      activeAgents.clear();
      renderParty();
      startTurnTimer();
      startTyping();
      $('stop-turn').disabled = false;
      $('stop-turn').textContent = '⏹ 멈추기';
      break;
    case 'partialHit': {
      const type = event.agentEvent.agentId ? agentTypeById.get(event.agentEvent.agentId) : undefined;
      const line = {
        wizard: `🧙✨ 마법사가 불러낸 정령이 덮쳤다! ${event.damage}의 피해!`,
        archer: `🏹 궁수의 동료들이 일제히 화살을 날렸다! ${event.damage}의 피해!`,
        swordsman: `🏹🗡 궁수의 엄호 사격 속에 검사가 파고들어 베었다! ${event.damage}의 피해!`,
        courier: `🦅 전령이 불러온 원군이 몰아쳤다! ${event.damage}의 피해!`,
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
        recordAgentStart(ae);
        finalizeLive();
        activeAgents.set(ae.id, ae);
        agentTypeById.set(ae.id, ae.agentType);
        renderParty();
        const r = roleOf(ae.agentType);
        appendLog(`${r.icon} ${r.name}가 출격했다: ${ae.description}`, `party-line party-${ae.agentType}`);
        break;
      }
      if (ae.type === 'background') {
        if (ae.running > backgroundRunning) appendLog(`⏳ 백그라운드 작업이 돌고 있다 (${ae.running}개). 끝나면 Claude가 결과를 알려준다.`, 'story-line');
        else if (ae.running === 0 && backgroundRunning > 0) appendLog('⏳ 백그라운드 작업이 끝났다. Claude가 결과를 확인하는 중...', 'story-line');
        backgroundRunning = ae.running;
        renderParty();
        break;
      }
      if (ae.type === 'toolResult') {
        fillToolCard(ae);
        recordAgentResult(ae);
        break;
      }
      if (ae.type === 'agentEnd') {
        recordAgentEnd(ae);
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
      openToolCard(ae);
      recordAgentAction(ae);
      if (ae.type === 'file') {
        touchedFiles.add(ae.value);
        throwFileIcon(ae.value);
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
    case 'floorCleared': {
      const before = levelOf(profile.xp + runXp);
      runXp += event.xpGained;
      const after = levelOf(profile.xp + runXp);
      renderXp();
      if (after > before) {
        appendLog(`⬆️ 레벨 업! 용사 레벨 ${after}이(가) 되었다! (다음 판은 능력치 포인트 ${after}개로 시작)`, 'victory');
        if (titleOf(after) !== titleOf(before)) appendLog(`🎖 새 칭호 획득: 「${titleOf(after)}」`, 'victory');
        sfx('fanfare');
      }
    }
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
        bandage: '🩹 붕대를 감았다! 체력이 조금 회복된다.',
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
    case 'turnInterrupted':
      appendLog('⏹ 공격을 멈췄다. 지금까지 들어간 타격은 그대로, 마무리 일격은 없다.', 'story-line');
      turnConcluded();
      break;
    case 'typingHit':
      appendLog(`⌨️ 코드 타자 공격! "${lastTypedTitle}" 완성 — ${event.damage}의 피해!`, 'partial-hit typing-hit');
      flashMonster();
      break;
    case 'counterBlocked':
      appendLog(`${currentMonsterName}의 반격을 수호의 부적이 막아냈다!`, 'victory');
      break;
    case 'runEnded':
      break;
  }
}

// Battle events wait while a reply is still being typed out, so the
// monster's counter (and the hit log) never shows up before the AI has
// finished talking on screen.
const battleQueue = [];
const typingBehind = new Set(); // bubbles whose shown text lags the stream
function drainBattleEvents() {
  while (battleQueue.length && typingBehind.size === 0) renderBattleEvent(battleQueue.shift());
}
window.promptBattle.onBattleEvent((event) => {
  battleQueue.push(event);
  drainBattleEvents();
});

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
    const run = saved.runStates?.[s.sessionId];
    const where = run ? ` · 💾 ${floorText(run.floor)} HP ${run.playerHp}/${run.playerMaxHp}` : '';
    option.textContent = `${s.title} · ${shortTime(s.lastModified)}${where}${s.sessionId === saved.sessionId ? ' (마지막)' : ''}`;
    sessionSelect.append(option);
  }
  // Default is a brand-new world; continuing is always an explicit choice.
  sessionSelect.value = '';
  sessionPicker.hidden = sessions.length === 0;
  folderRunStates = saved.runStates ?? {};
  renderSessionHint();
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

const AUTO_SLOT_INDEX = 3; // slot 4: the per-floor autosave
function renderSlotRows(container, onPick, allowEmpty, includeAuto) {
  container.textContent = '';
  slots.forEach((slot, i) => {
    if (i === AUTO_SLOT_INDEX && !includeAuto) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot-row';
    const strong = document.createElement('strong');
    strong.textContent = i === AUTO_SLOT_INDEX ? '🔄 자동 저장 (층마다)' : `슬롯 ${i + 1}`;
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
  renderSlotRows($('slot-list'), (n, slot) => slot && startGame({ loadSlot: n, slot }), false, true);
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
  // Picking a Claude session resumes its autosaved run too (main does the
  // same lookup); treat it like a slot for the starting UI state.
  if (!slot && chosenFolder && !sessionPicker.hidden && sessionSelect.value) {
    slot = (await window.promptBattle.getFolderSession(chosenFolder)).runStates?.[sessionSelect.value];
  }
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
  setLastPrompt('');
  const from = slot ?? profile;
  coins = from.coins;
  bag = { ...from.bag };
  runXp = 0;
  renderXp();
  // Hero stats are per-run: a new game starts from zero; a save slot restores its own.
  stats = { attack: 0, defense: 0, vitality: 0, ...slot?.stats };
  // Level bonus: a new run starts with one stat point per hero level.
  statPoints = slot ? slot.statPoints : profile.level;
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
  if (!slot) appendLog(`⭐ 레벨 ${profile.level} 보너스: 능력치 포인트 ${profile.level}개로 시작한다! 위쪽 버튼으로 바로 올려보자.`, 'coin-line');
  if (slot) {
    const from = loadSlot ? `슬롯 ${loadSlot}을(를)` : '이 세션의 자동 저장을';
    appendLog(`💾 ${from} 불러왔다. ${slotSummary(slot)}`, 'story-line');
  }
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
  playMusic('title');
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

// ---------------------------------------------------------------------------
// Color the important parts of a reply: success / failure / warning words and
// file paths in prose, and a light syntax highlight inside code blocks.
const HIGHLIGHTS = [
  { cls: 'hl-bad', re: /(실패|오류|에러|버그|깨짐|\berror\b|\bfail(?:ed|ure|s)?\b|\bexception\b|❌|✗)/gi },
  { cls: 'hl-ok', re: /(성공|통과|완료|해결|수정됨|고쳤|\bpass(?:ed|es)?\b|\bsuccess\b|✅|✓)/gi },
  { cls: 'hl-warn', re: /(주의|경고|위험|\bwarning\b|\bTODO\b|⚠️?)/gi },
  { cls: 'hl-path', re: /(?:[\w.-]+\/)*[\w.-]+\.(?:tsx?|jsx?|mjs|cjs|py|json|md|css|html|go|rs|java|kt|swift|c|cpp|h|sh|ya?ml|toml|sql|txt)\b/g },
];

function highlightText(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement.closest('pre, code, a, .hl') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.nodeValue;
    const marks = [];
    for (const { cls, re } of HIGHLIGHTS) {
      re.lastIndex = 0;
      for (let m; (m = re.exec(text)); ) marks.push({ start: m.index, end: m.index + m[0].length, cls });
    }
    if (marks.length === 0) continue;
    marks.sort((a, b) => a.start - b.start || b.end - a.end);
    const frag = document.createDocumentFragment();
    let pos = 0;
    for (const mk of marks) {
      if (mk.start < pos) continue; // overlapping: first one wins
      frag.append(text.slice(pos, mk.start));
      const span = document.createElement('span');
      span.className = `hl ${mk.cls}`;
      span.textContent = text.slice(mk.start, mk.end);
      frag.append(span);
      pos = mk.end;
    }
    frag.append(text.slice(pos));
    node.replaceWith(frag);
  }
}

const KEYWORDS = new Set(('const let var function return if else for while do switch case break continue new class extends import export from default async await try catch finally throw typeof instanceof in of yield ' +
  'def lambda pass with as elif not and or is None True False self print ' +
  'func go defer chan struct interface type package map range fn let mut impl pub use match enum trait ' +
  'public private protected static void int string bool float double long char null true false this super ' +
  'SELECT FROM WHERE JOIN ON GROUP BY ORDER INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE INDEX AND OR NOT LIMIT HAVING AS').split(/\s+/));

function highlightCode(codeEl) {
  const lang = (codeEl.className.match(/language-(\w+)/) || [])[1] || '';
  const hashComments = /^(py|python|bash|sh|shell|zsh|yaml|yml|toml|ruby|rb|r|dockerfile|make)$/i.test(lang);
  const src = codeEl.textContent;
  const token = new RegExp(
    [
      hashComments ? '(#.*)' : '(\\/\\/.*|\\/\\*[\\s\\S]*?\\*\\/)',
      '("(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|`(?:\\\\.|[^`\\\\])*`)',
      '(\\b\\d+(?:\\.\\d+)?\\b)',
      '([A-Za-z_][\\w]*)',
    ].join('|'),
    'g',
  );
  const frag = document.createDocumentFragment();
  let pos = 0;
  for (let m; (m = token.exec(src)); ) {
    const [whole, comment, str, num, word] = m;
    const cls = comment ? 'tok-com' : str ? 'tok-str' : num ? 'tok-num' : word && KEYWORDS.has(word) ? 'tok-kw' : null;
    if (!cls) continue;
    frag.append(src.slice(pos, m.index));
    const span = document.createElement('span');
    span.className = cls;
    span.textContent = whole;
    frag.append(span);
    pos = m.index + whole.length;
  }
  frag.append(src.slice(pos));
  codeEl.textContent = '';
  codeEl.append(frag);
}

function decorateReply(el) {
  highlightText(el);
  for (const code of el.querySelectorAll('pre code')) highlightCode(code);
}

// ---------------------------------------------------------------------------
// Tool cards: what the AI *does* (commands, edits, reads) is shown as a
// compact IN/OUT card, visually apart from what it *says* (chat bubbles).
const toolCards = new Map(); // toolId -> { card, out }
const OUT_PREVIEW_LINES = 6;

function openToolCard(ae) {
  const card = document.createElement('div');
  const party = ae.agentId ? agentTypeById.get(ae.agentId) : undefined;
  card.className = `tool-card running${party ? ` party-${party}` : ''}`;
  const isFile = ae.type === 'file';
  const isRead = /^(Read|Grep|Glob) /.test(ae.value);
  const tool = isFile ? 'Edit' : isRead ? ae.value.split(' ')[0] : 'Bash';
  const icon = isFile ? '✏️' : isRead ? '🔍' : '⚙️';
  const who = party ? `${roleOf(party).icon} ${roleOf(party).name} · ` : '';
  const head = document.createElement('div');
  head.className = 'tool-head';
  head.textContent = `${who}${icon} ${tool}${ae.detail ? ` · ${ae.detail}` : ''}`;
  const status = document.createElement('span');
  status.className = 'tool-status';
  status.textContent = '실행 중…';
  head.append(status);

  const inRow = document.createElement('div');
  inRow.className = 'tool-row';
  const inLabel = document.createElement('span');
  inLabel.className = 'tool-label';
  inLabel.textContent = 'IN';
  const inBody = document.createElement('code');
  inBody.className = 'tool-in';
  inBody.textContent = isRead ? ae.value.slice(tool.length + 1) : ae.value;
  if (isFile) {
    inBody.classList.add('clickable');
    inBody.title = '클릭해서 파일 보기/수정';
    inBody.addEventListener('click', () => openFileViewer(ae.value));
  }
  inRow.append(inLabel, inBody);

  const out = document.createElement('div');
  out.className = 'tool-row tool-out-row';
  out.hidden = true;
  card.append(head, inRow, out);
  logEl.appendChild(card);
  scrollLogToBottom();
  if (ae.toolId) toolCards.set(ae.toolId, { card, out, status });
}

function fillToolCard(ae) {
  const entry = toolCards.get(ae.toolId);
  if (!entry) return;
  toolCards.delete(ae.toolId);
  const { card, out, status } = entry;
  card.classList.remove('running');
  card.classList.add(ae.isError ? 'failed' : 'done');
  status.textContent = ae.isError ? '실패' : '완료';
  const text = ae.output.trim();
  if (!text) return;
  const label = document.createElement('span');
  label.className = 'tool-label';
  label.textContent = 'OUT';
  const pre = document.createElement('pre');
  pre.className = 'tool-out';
  const lines = text.split('\n');
  const long = lines.length > OUT_PREVIEW_LINES;
  pre.textContent = long ? lines.slice(0, OUT_PREVIEW_LINES).join('\n') : text;
  out.append(label, pre);
  if (long) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'tool-more';
    more.textContent = `▾ 전체 보기 (${lines.length}줄)`;
    let open = false;
    more.addEventListener('click', () => {
      open = !open;
      pre.textContent = open ? text : lines.slice(0, OUT_PREVIEW_LINES).join('\n');
      more.textContent = open ? '▴ 접기' : `▾ 전체 보기 (${lines.length}줄)`;
    });
    out.append(more);
  }
  out.hidden = false;
  const nearBottom = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 160;
  if (nearBottom) scrollLogToBottom();
}

// ---------------------------------------------------------------------------
// Claude settings: effort (= attack speed), skills filter, MCP servers.
// Saved in the profile; they only shape the game's own Claude sessions.
let claudeSettings = { effort: 'high', skillsMode: 'all', enabledSkills: [], disabledMcp: [] };
let speedInfo = null;
let capabilities = null;

async function saveClaude(patch) {
  claudeSettings = await window.promptBattle.setClaudeSettings({ ...claudeSettings, ...patch });
  if (profile) profile.claude = claudeSettings;
  renderClaudeSettings();
}

function renderEffortSelects() {
  if (!speedInfo) return;
  for (const select of [$('effort-select'), $('effort-battle')]) {
    select.textContent = '';
    for (const level of speedInfo.levels) {
      const { label, multiplier } = speedInfo.attackSpeed[level];
      const option = document.createElement('option');
      option.value = level;
      option.textContent = select.id === 'effort-battle' ? `${label} x${multiplier}` : `${label} — ${level} (피해 x${multiplier})`;
      select.append(option);
    }
    select.value = claudeSettings.effort;
  }
}
for (const id of ['effort-select', 'effort-battle']) {
  $(id).addEventListener('change', async (e) => {
    await saveClaude({ effort: e.target.value });
    if (id === 'effort-battle') {
      const s = speedInfo.attackSpeed[claudeSettings.effort];
      appendLog(`⚡ 공격 속도를 바꿨다: ${s.label} (effort ${claudeSettings.effort}, 피해 x${s.multiplier}) — 다음 공격부터`, 'story-line');
    }
  });
}

function renderSkills() {
  for (const radio of document.querySelectorAll('input[name="skills-mode"]')) radio.checked = radio.value === claudeSettings.skillsMode;
  const total = capabilities?.skills.length ?? 0;
  $('skill-count').textContent =
    claudeSettings.skillsMode === 'custom' ? `${claudeSettings.enabledSkills.length}/${total}개 켬` : claudeSettings.skillsMode === 'none' ? '모두 꺼짐' : `${total}개 전부`;
  $('skill-picker').hidden = claudeSettings.skillsMode !== 'custom';
  if (claudeSettings.skillsMode !== 'custom') return;
  const list = $('skill-list');
  list.textContent = '';
  const q = $('skill-search').value.trim().toLowerCase();
  const matches = (capabilities?.skills ?? []).filter((s) => !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
  const enabled = new Set(claudeSettings.enabledSkills);
  for (const s of matches.slice(0, 200)) {
    const label = document.createElement('label');
    label.className = 'skill-item';
    label.title = s.description;
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = enabled.has(s.name);
    box.addEventListener('change', () => {
      const next = new Set(claudeSettings.enabledSkills);
      if (box.checked) next.add(s.name);
      else next.delete(s.name);
      saveClaude({ enabledSkills: [...next] });
    });
    const name = document.createElement('strong');
    name.textContent = s.name;
    const desc = document.createElement('span');
    desc.textContent = s.description;
    label.append(box, name, desc);
    list.append(label);
  }
  if (matches.length > 200) {
    const more = document.createElement('div');
    more.className = 'option-sub';
    more.textContent = `… ${matches.length - 200}개 더 있음 — 검색으로 좁혀줘`;
    list.append(more);
  }
  if (!capabilities) list.textContent = '스킬 목록 불러오는 중...';
}
for (const radio of document.querySelectorAll('input[name="skills-mode"]')) {
  radio.addEventListener('change', () => saveClaude({ skillsMode: radio.value }));
}
$('skill-search').addEventListener('input', renderSkills);
const visibleSkillNames = () => [...$('skill-list').querySelectorAll('.skill-item strong')].map((n) => n.textContent);
$('skill-all-visible').addEventListener('click', () => saveClaude({ enabledSkills: [...new Set([...claudeSettings.enabledSkills, ...visibleSkillNames()])] }));
$('skill-none-visible').addEventListener('click', () => {
  const hide = new Set(visibleSkillNames());
  saveClaude({ enabledSkills: claudeSettings.enabledSkills.filter((n) => !hide.has(n)) });
});

const MCP_STATUS = { connected: '연결됨', pending: '대기', failed: '실패', 'needs-auth': '인증 필요', disabled: '꺼짐' };
function renderMcp() {
  const list = $('mcp-list');
  list.textContent = '';
  if (!capabilities) {
    list.textContent = 'MCP 서버 불러오는 중...';
    return;
  }
  if (capabilities.mcpServers.length === 0) {
    list.textContent = '설정된 MCP 서버가 없다';
    return;
  }
  const off = new Set(claudeSettings.disabledMcp);
  for (const server of capabilities.mcpServers) {
    const label = document.createElement('label');
    label.className = 'mcp-item';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = !off.has(server.name);
    box.addEventListener('change', () => {
      const next = new Set(claudeSettings.disabledMcp);
      if (box.checked) next.delete(server.name);
      else next.add(server.name);
      saveClaude({ disabledMcp: [...next] });
    });
    const name = document.createElement('span');
    name.textContent = server.name;
    const status = document.createElement('span');
    status.className = `mcp-status mcp-${server.status}`;
    status.textContent = MCP_STATUS[server.status] ?? server.status;
    label.append(box, name, status);
    list.append(label);
  }
}

function renderClaudeSettings() {
  renderAuth();
  renderEffortSelects();
  renderSkills();
  renderMcp();
}

async function loadCapabilities(refresh = false) {
  capabilities = null;
  renderClaudeSettings();
  capabilities = await window.promptBattle.claudeCapabilities(chosenFolder, refresh);
  if (!capabilities) capabilities = { skills: [], mcpServers: [] };
  renderClaudeSettings();
}
$('caps-refresh').addEventListener('click', () => loadCapabilities(true));
pickFolderBtn.addEventListener('click', () => setTimeout(() => chosenFolder && loadCapabilities(), 300));
window.promptBattle.claudeSettingsInfo().then((info) => {
  speedInfo = info;
  renderClaudeSettings();
});
loadCapabilities();

// ---------------------------------------------------------------------------
// Quest modal: when Claude's final reply asks the player something, it pops
// up large, like a quest giver, with the choices as buttons and a free answer.
let pendingQuest = null;
function isQuestion(el) {
  const blocks = [...el.children];
  const last = blocks[blocks.length - 1];
  const prev = blocks[blocks.length - 2];
  const endsWithQ = (node) => node && /[?？]\s*$/.test(node.textContent.trim());
  return endsWithQ(last) || ((last?.tagName === 'UL' || last?.tagName === 'OL') && endsWithQ(prev));
}
function noteQuestion(el) {
  if (!isQuestion(el)) return;
  pendingQuest = el;
  if (inputEnabled && $('turn-panel').hidden) showQuest(el);
}
function showQuest(el) {
  pendingQuest = null;
  const body = $('quest-body');
  body.innerHTML = el.innerHTML;
  // Choices: a trailing list becomes big buttons (and leaves the body).
  const choices = $('quest-choices');
  choices.textContent = '';
  const last = body.lastElementChild;
  if (last && (last.tagName === 'UL' || last.tagName === 'OL')) {
    for (const li of last.querySelectorAll(':scope > li')) {
      const text = li.textContent.trim();
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quest-choice';
      btn.textContent = text;
      btn.addEventListener('click', () => answerQuest(text));
      choices.append(btn);
    }
    last.remove();
  }
  $('quest-answer').value = '';
  $('quest-overlay').hidden = false;
  pushMusic('quest');
  sfx('party');
  $('quest-answer').focus();
}
function answerQuest(text) {
  const answer = text.trim();
  if (!answer || !inputEnabled) return;
  closeQuest();
  promptInput.value = answer;
  attackForm.requestSubmit();
}
$('quest-submit').addEventListener('click', () => answerQuest($('quest-answer').value));
function closeQuest() {
  if ($('quest-overlay').hidden) return;
  $('quest-overlay').hidden = true;
  popMusic();
}
$('quest-later').addEventListener('click', () => {
  closeQuest();
  promptInput.focus();
});
$('quest-answer').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
    e.preventDefault();
    answerQuest($('quest-answer').value);
  }
});

// ---------------------------------------------------------------------------
// Connection: Claude Code CLI login or an API key (stored encrypted by main).
async function renderAuth() {
  for (const r of document.querySelectorAll('input[name="auth-mode"]')) r.checked = r.value === claudeSettings.auth;
  $('api-key-row').hidden = claudeSettings.auth !== 'api';
  const info = await window.promptBattle.apiKeyInfo();
  $('api-key-info').textContent = info.hasKey ? `저장된 키: ••••${info.last4} (키체인 암호화)` : info.encryption ? '저장된 키 없음' : '⚠️ 이 컴퓨터에서 키체인 암호화를 쓸 수 없음';
  if (claudeSettings.auth === 'api' && !info.hasKey) $('auth-status').textContent = 'API 키를 입력해줘';
}
for (const radio of document.querySelectorAll('input[name="auth-mode"]')) {
  radio.addEventListener('change', async () => {
    await saveClaude({ auth: radio.value });
    $('auth-status').textContent = '';
    renderAuth();
    loadCapabilities(true);
    refreshUsage(true);
  });
}
$('api-key-save').addEventListener('click', async () => {
  const r = await window.promptBattle.setApiKey($('api-key-input').value);
  $('api-key-input').value = '';
  $('auth-status').textContent = r.ok ? '키를 저장했다' : r.message;
  renderAuth();
});
$('api-key-clear').addEventListener('click', async () => {
  await window.promptBattle.setApiKey(null);
  $('auth-status').textContent = '키를 지웠다';
  renderAuth();
});
$('auth-check').addEventListener('click', async () => {
  $('auth-status').textContent = '확인 중...';
  const a = await window.promptBattle.checkAuth();
  $('auth-status').textContent = !a
    ? '❌ 연결 실패 (로그인 또는 키를 확인해줘)'
    : a.apiKeySource && claudeSettings.auth === 'api'
      ? `✅ API 키로 연결 (${a.apiKeySource})`
      : `✅ ${a.email ?? '로그인됨'}${a.subscriptionType ? ` · ${a.subscriptionType}` : ''}${a.apiKeySource ? ` · 키: ${a.apiKeySource}` : ''}`;
});

// What starting with the picked session will do.
let folderRunStates = {};
function renderSessionHint() {
  const run = sessionSelect.value ? folderRunStates[sessionSelect.value] : undefined;
  $('session-hint').textContent = !sessionSelect.value
    ? '새로운 세계로 시작 (1층부터, 새 대화)'
    : run
      ? `이 세션의 저장 상태로 이어하기: ${floorText(run.floor)}, HP ${run.playerHp}/${run.playerMaxHp}`
      : '이 세션의 대화를 이어서, 게임은 새로 시작';
}
sessionSelect.addEventListener('change', renderSessionHint);

// ---------------------------------------------------------------------------
// XP bar: progress toward the next level (profile XP + what this run earned,
// which the profile only banks when the run ends).
let xpPerLevel = 100;
let runXp = 0;
const levelOf = (xp) => Math.floor(xp / xpPerLevel) + 1;
let titles = [{ level: 1, title: '견습 용사' }];
const titleOf = (level) => titles.filter((t) => t.level <= level).pop()?.title ?? titles[0].title;
function renderXp() {
  if (!profile) return;
  const total = profile.xp + runXp;
  for (const el of document.querySelectorAll('.player-label')) el.textContent = titleOf(levelOf(total));
  const into = total % xpPerLevel;
  const pct = Math.round((into / xpPerLevel) * 100);
  for (const el of document.querySelectorAll('[data-xp-level]')) el.textContent = `Lv.${levelOf(total)}`;
  for (const el of document.querySelectorAll('[data-xp-fill]')) el.style.width = `${pct}%`;
  for (const el of document.querySelectorAll('[data-xp-label]')) el.textContent = `${into} / ${xpPerLevel} XP (${pct}%)`;
}

$('stop-turn').addEventListener('click', async () => {
  const btn = $('stop-turn');
  btn.disabled = true;
  btn.textContent = '멈추는 중…';
  if (!(await window.promptBattle.stopTurn())) {
    btn.disabled = false;
    btn.textContent = '⏹ 멈추기';
  }
});

// ---------------------------------------------------------------------------
// Agents tab: the last 10 subagents — live elapsed time while running, how
// long they ran once done; click one for its job, actions and final report.
const AGENT_RUNS_MAX = 10;
const agentRuns = []; // newest first
const openAgentRuns = new Set();
const clockTime = (ms) => new Date(ms).toLocaleTimeString('ko-KR', { hour12: false });
const runById = (id) => agentRuns.find((r) => r.id === id);

function recordAgentStart(ae) {
  agentRuns.unshift({ id: ae.id, type: ae.agentType, description: ae.description, startedAt: Date.now(), endedAt: null, actions: [], report: '' });
  while (agentRuns.length > AGENT_RUNS_MAX) agentRuns.pop();
  renderAgents();
}
function recordAgentAction(ae) {
  const run = ae.agentId && runById(ae.agentId);
  if (!run) return;
  run.actions.push({ toolId: ae.toolId, kind: ae.type, value: ae.value, ok: null });
  renderAgents();
}
function recordAgentResult(ae) {
  for (const run of agentRuns) {
    const action = run.actions.find((a) => a.toolId === ae.toolId);
    if (action) {
      action.ok = !ae.isError;
      renderAgents();
      return;
    }
  }
}
function recordAgentEnd(ae) {
  const run = runById(ae.id);
  if (!run) return;
  run.endedAt = Date.now();
  if (ae.report) run.report = ae.report;
  renderAgents();
}
// A turn that ends (or is stopped) ends its subagents too.
function endOpenAgentRuns() {
  for (const run of agentRuns) if (!run.endedAt) run.endedAt = Date.now();
  renderAgents();
}

function renderAgents() {
  const running = agentRuns.filter((r) => !r.endedAt).length;
  $('agents-btn').textContent = running ? `👥 에이전트 · 🟢 ${running}개 진행 중` : `👥 에이전트${agentRuns.length ? ` (${agentRuns.length})` : ''}`;
  $('agents-btn').classList.toggle('live', running > 0);
  if ($('agents-drawer').hidden) return;
  const list = $('agents-list');
  list.textContent = '';
  if (agentRuns.length === 0) {
    list.textContent = '아직 출격한 서브에이전트가 없다. AI 파티를 켜거나 오래 걸리는 일을 시키면 여기에 기록된다.';
    return;
  }
  for (const run of agentRuns) {
    const role = roleOf(run.type);
    const item = document.createElement('div');
    item.className = `agent-run${run.endedAt ? ' done' : ' running'}${openAgentRuns.has(run.id) ? ' open' : ''}`;
    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'agent-run-head';
    const who = document.createElement('strong');
    who.textContent = `${role.icon} ${role.name}`;
    const what = document.createElement('span');
    what.className = 'agent-run-desc';
    what.textContent = run.description || '(설명 없음)';
    const time = document.createElement('span');
    time.className = 'agent-run-time';
    time.textContent = run.endedAt
      ? `✅ ${fmtElapsed(run.endedAt - run.startedAt)} 동안`
      : `🟢 ${fmtElapsed(Date.now() - run.startedAt)}째`;
    head.append(who, what, time);
    head.addEventListener('click', () => {
      if (openAgentRuns.has(run.id)) openAgentRuns.delete(run.id);
      else openAgentRuns.add(run.id);
      renderAgents();
    });
    item.append(head);
    if (openAgentRuns.has(run.id)) {
      const detail = document.createElement('div');
      detail.className = 'agent-run-detail';
      const meta = document.createElement('div');
      meta.className = 'option-sub';
      meta.textContent = `시작 ${clockTime(run.startedAt)}${run.endedAt ? ` · 끝 ${clockTime(run.endedAt)}` : ' · 진행 중'} · 작업 ${run.actions.length}개`;
      detail.append(meta);
      if (run.actions.length) {
        const ul = document.createElement('ul');
        ul.className = 'agent-run-actions';
        for (const a of run.actions) {
          const li = document.createElement('li');
          li.textContent = `${a.ok === null ? '⏳' : a.ok ? '✓' : '✗'} ${a.kind === 'file' ? '✏️' : '⚙️'} ${a.value}`;
          if (a.ok === false) li.className = 'failed';
          ul.append(li);
        }
        detail.append(ul);
      }
      if (run.report) {
        const report = document.createElement('div');
        report.className = 'markdown agent-run-report';
        report.innerHTML = marked.parse(run.report);
        decorateReply(report);
        detail.append(report);
      }
      item.append(detail);
    }
    list.append(item);
  }
}
$('agents-btn').addEventListener('click', () => {
  $('agents-drawer').hidden = !$('agents-drawer').hidden;
  renderAgents();
});
$('agents-close').addEventListener('click', () => ($('agents-drawer').hidden = true));
// Live elapsed times.
setInterval(() => {
  if (agentRuns.some((r) => !r.endedAt)) renderAgents();
}, 1000);

// ---------------------------------------------------------------------------
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
function speechFor(event) {
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
