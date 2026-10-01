// electron/renderer/renderer.js
import { marked } from '../../node_modules/marked/lib/marked.esm.js';
import { monsterSvg, merchantSvg, blacksmithSvg, chestSvg } from './monster-art.js';
import './iconize.js';
import { $ } from './dom.js';
import { logEl, appendLog, scrollLogToBottom } from './log.js';
import { THEMES, chapterInfo, PROLOGUES, bossTaunt, bossRoar } from './story.js';
import { decorateReply } from './reply-format.js';
import { startTyping, stopTyping } from './typing-drill.js';
import { speechFor } from './speech.js';
import { openSettings } from './settings-window.js';
import './updates.js';
import { MONSTER_LORE } from './monster-lore.js';
import { MONSTER_LINES } from './monster-lines.js';
import { fatigueOf } from './fatigue.js';
import { fx } from './fx.js';
import { playMusic, stopMusic, pushMusic, popMusic, sfx, getAudioSettings, setVolume, toggleMute } from './audio.js';

const setupScreen = $('setup-screen');
const dungeonScreen = $('dungeon-screen');
const summaryScreen = $('summary-screen');
const pickFolderBtn = $('pick-folder-btn');
const folderPathEl = $('folder-path');
const startBtn = $('start-btn');
const profileLineEl = $('profile-line');
const themeOptionsEl = $('theme-options');
const weaponOptionsEl = $('weapon-options');
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

// Token cost as dots: stronger models and higher effort use up the plan's
// usage limits faster. Weapons are ranked by damage multiplier.
const costDots = (n, max) => '●'.repeat(n) + '○'.repeat(Math.max(0, max - n));
const weaponCost = (w) => costDots([...weapons].sort((a, b) => a.multiplier - b.multiplier).indexOf(w) + 1, weapons.length);

// Setup choices are radio inputs styled as cards (keyboard still works).
function choiceCard(name, value, checked, title, sub, onChange) {
  const label = document.createElement('label');
  label.className = 'choice';
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = name;
  input.value = value;
  input.checked = checked;
  input.addEventListener('change', onChange);
  const strong = document.createElement('strong');
  strong.textContent = title;
  label.append(input, strong);
  if (sub) {
    const small = document.createElement('small');
    small.textContent = sub;
    label.append(small);
  }
  return label;
}

function renderWeaponOptions() {
  weaponOptionsEl.textContent = '';
  weaponSelect.textContent = '';
  for (const w of weapons) {
    const card = choiceCard('weapon', w.model, w.model === chosenWeapon, classWeapon(w.model).name, `${classWeapon(w.model).flavor} · 피해 x${w.multiplier} · 토큰 ${weaponCost(w)}`, () => {
      chosenWeapon = w.model;
    });
    card.title = classWeapon(w.model).flavor;
    weaponOptionsEl.append(card);

    const option = document.createElement('option');
    option.value = w.model;
    option.textContent = `${classWeapon(w.model).name} (x${w.multiplier} · 토큰 ${weaponCost(w)})`;
    weaponSelect.append(option);
  }
  weaponSelect.value = chosenWeapon;
}

let prestigeLevel = 20;
$('rebirth-btn').addEventListener('click', async () => {
  const next = (profile.prestige ?? 0) + 1;
  const ok = window.confirm(
    `환생할까?\n\n레벨 ${profile.level} → 레벨 1 (경험치 0)\n대신 환생 ★${next}: 피해·코인 +${next * 10}%, 시작 능력치 포인트 +${next * 2}\n코인·무기 강화·동료·계약·도감은 그대로 남는다.`,
  );
  if (!ok) return;
  const res = await window.promptBattle.rebirth();
  if (res.error) return window.alert(res.error);
  profile = res.profile;
  runXp = 0;
  renderXp();
  renderProfileLine();
  sfx('fanfare');
});

// Pets: owned ones from the profile; '' = go alone.
let petDefs = [];
let chosenPet = '';
const petInfo = (id) => petDefs.find((p) => p.id === id);
const PET_ICON = { slime: '🟢', drake: '🐉', owl: '🦉' };
function renderPetOptions() {
  const el = $('pet-options');
  el.textContent = '';
  const owned = profile?.pets ?? [];
  $('pet-hint').textContent = owned.length ? '한 번에 한 마리만 데려간다. 보물상자(금 이상)에서 드물게 새 동료가 나온다.' : '아직 동료가 없다. 보물상자(금 이상)에서 드물게 나온다.';
  if (!owned.length) return;
  el.append(choiceCard('pet', '', chosenPet === '', '혼자 간다', '동료 없이', () => (chosenPet = '')));
  for (const id of owned) {
    const pet = petInfo(id);
    if (pet) el.append(choiceCard('pet', id, chosenPet === id, `${PET_ICON[id] ?? '🐾'} ${pet.name}`, pet.text, () => (chosenPet = id)));
  }
}
function renderPetBadge() {
  const el = $('pet-badge');
  const pet = petInfo(chosenPet);
  el.hidden = !pet;
  if (pet) {
    el.textContent = `${PET_ICON[pet.id] ?? '🐾'} ${pet.name}`;
    el.title = pet.text;
  }
}

function renderClassOptions() {
  const el = $('class-options');
  el.textContent = '';
  for (const c of heroClasses) {
    const card = choiceCard('hero-class', c.id, c.id === chosenClass, `${c.icon} ${c.name}`, Object.values(c.weapons).map((w) => w.name).join(' · '), () => {
      chosenClass = c.id;
      renderWeaponOptions();
      renderEffortSelects();
    });
    el.append(card);
  }
}

const savedFloor = (themeId) => profile?.storyFloors?.[themeId] ?? 0;
const floorText = (floor) => `챕터 ${Math.floor(floor / 6) + 1} ${(floor % 6) + 1}/6층`;


async function loadSetup() {
  const info = await window.promptBattle.getSetupInfo();
  profile = info.profile;
  claudeSettings = profile.claude;
  heroClasses = info.classes;
  xpPerLevel = info.xpPerLevel ?? xpPerLevel;
  titles = info.titles ?? titles;
  achievementDefs = info.achievements ?? [];
  dailyQuestDefs = info.dailyQuests ?? [];
  bestiaryDefs = info.bestiary ?? [];
  themeRuleDefs = info.themeRules ?? [];
  difficultyMult = info.difficulty ?? difficultyMult;
  difficultyReward = info.difficultyReward ?? difficultyReward;
  chestGrades = info.chestGrades ?? [];
  pacts = info.pacts ?? pacts;
  petDefs = info.pets ?? [];
  prestigeLevel = info.prestigeLevel ?? prestigeLevel;
  todayDungeon = info.daily ?? null;
  rosterNames = info.rosterNames ?? [];
  renderDailyInfo();
  chosenPet = profile.activePet ?? '';
  renderPetOptions();
  heroContract = profile.contract ?? null;
  renderContract();
  renderDailyLine();
  runXp = 0;
  renderXp();
  chosenClass = profile.heroClass ?? chosenClass;
  weapons = info.weapons;
  items = info.items;
  statDefs = info.stats;
  statMax = info.statMaxLevel;
  swordMax = info.swordMaxLevel;
  renderProfileLine();

  themeOptionsEl.textContent = '';
  for (const theme of THEMES) {
    themeOptionsEl.append(
      choiceCard('theme', theme.id, theme.id === chosenThemeId, theme.title, `난이도 ${stars(ruleOf(theme.id)?.stars ?? 1)}`, () => {
        chosenThemeId = theme.id;
        renderThemeInfo();
      }),
    );
  }

  renderClassOptions();
  renderWeaponOptions();
  renderThemeInfo();
  renderDifficultyInfo();
  renderClaudeSettings();
}
loadSetup();

function renderProfileLine() {
  const pact = pactInfo(profile.contract);
  const charm = profile.relics?.includes('coinCharm') ? ' · 코인의 부적' : '';
  const stars = profile.prestige ? `${'★'.repeat(Math.min(profile.prestige, 5))}${profile.prestige > 5 ? `×${profile.prestige}` : ''} ` : '';
  const btn = $('rebirth-btn');
  btn.hidden = profile.level < prestigeLevel;
  btn.title = `레벨 1로 돌아가는 대신 환생 ★ 하나: 피해·코인 +10%, 시작 능력치 포인트 +2 (영구, 누적). 코인·무기·동료·계약은 그대로.`;
  profileLineEl.textContent = `🎖 ${stars}${titleOf(profile.level)} · 레벨 ${profile.level} · 총 ${profile.xp} XP · ${profile.totalWins}승 · ${profile.coins} 코인 · 최대 HP ${profile.maxHp} · 무기 +${profile.swordLevel}${pact ? ` · 계약: ${pact.name}` : ''}${charm}`;
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

// Rest stops: the healing spring and the shrine of broken pacts.
const SPRING_SVG = '<svg viewBox="0 0 200 200" width="160" height="160"><ellipse cx="100" cy="150" rx="80" ry="26" fill="#2e5a7a"/><ellipse cx="100" cy="146" rx="66" ry="18" fill="#5fb0d8"/><path d="M100 60 Q90 100 100 140 Q110 100 100 60Z" fill="#a8e0ff" opacity=".85"/><circle cx="70" cy="120" r="4" fill="#fff" opacity=".8"/><circle cx="132" cy="112" r="3" fill="#fff" opacity=".7"/><circle cx="118" cy="90" r="2.5" fill="#fff" opacity=".7"/><path d="M30 150 Q20 110 40 96 M170 150 Q182 112 160 98" stroke="#5c8a4a" stroke-width="6" fill="none" stroke-linecap="round"/></svg>';
const SHRINE_SVG = '<svg viewBox="0 0 200 200" width="160" height="160"><rect x="50" y="120" width="100" height="50" rx="4" fill="#4c566a"/><rect x="40" y="166" width="120" height="12" rx="3" fill="#3b4252"/><rect x="62" y="60" width="12" height="62" fill="#5e6779"/><rect x="126" y="60" width="12" height="62" fill="#5e6779"/><path d="M50 60 H150 L140 46 H60 Z" fill="#6b7489"/><circle cx="100" cy="100" r="16" fill="none" stroke="#b48ead" stroke-width="4"/><path d="M90 92 L110 108 M110 92 L90 108" stroke="#bf616a" stroke-width="4" stroke-linecap="round"/><path d="M84 120 Q100 108 116 120" stroke="#ebcb8b" stroke-width="3" fill="none"/></svg>';
function openRest(kind, text, action, command) {
  monsterPanel.hidden = true;
  fleeBtn.disabled = true;
  const panel = $('rest-panel');
  panel.hidden = false;
  panel.dataset.kind = kind;
  $('rest-title').textContent = kind === 'spring' ? '회복의 샘' : '계약 파기의 제단';
  $('rest-art').innerHTML = kind === 'spring' ? SPRING_SVG : SHRINE_SVG;
  $('rest-text').textContent = text;
  $('rest-action').textContent = action;
  $('rest-action').disabled = false;
  $('rest-action').onclick = () => window.promptBattle.submitPrompt(command);
  $('rest-result').textContent = '';
}
// 야시장: rare stall, 4 discounted goods, one of each.
const NIGHT_SVG = '<svg viewBox="0 0 200 200" width="160" height="160"><rect x="30" y="96" width="140" height="70" rx="6" fill="#3b2a4a"/><path d="M20 100 L100 52 L180 100 Z" fill="#5a3a6e"/><path d="M20 100 Q40 112 60 100 Q80 112 100 100 Q120 112 140 100 Q160 112 180 100" fill="#bf616a"/><line x1="60" y1="70" x2="60" y2="84" stroke="#d8dee9" stroke-width="2"/><ellipse cx="60" cy="92" rx="10" ry="12" fill="#ff8a3d"/><ellipse cx="60" cy="92" rx="5" ry="7" fill="#ffd36b"/><line x1="140" y1="70" x2="140" y2="84" stroke="#d8dee9" stroke-width="2"/><ellipse cx="140" cy="92" rx="10" ry="12" fill="#ff8a3d"/><ellipse cx="140" cy="92" rx="5" ry="7" fill="#ffd36b"/><circle cx="160" cy="30" r="12" fill="#ebcb8b"/><circle cx="166" cy="26" r="11" fill="#151922"/><rect x="58" y="124" width="22" height="18" rx="3" fill="#ebcb8b"/><rect x="92" y="120" width="18" height="22" rx="3" fill="#88c0d0"/><rect x="120" y="126" width="22" height="16" rx="3" fill="#b48ead"/></svg>';
let nightSold = new Set();
let nightCorrupted = false; // the devil's contract corrupts once per stall
let nightGoods = [];
function renderNightGoods() {
  const el = $('night-goods');
  el.textContent = '';
  for (const g of nightGoods) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'night-good';
    const sold = nightSold.has(g.id);
    btn.disabled = sold || !inputEnabled;
    const icon = ITEM_ICONS[g.id] ?? (g.id.startsWith('boss-') ? '👑' : '📦');
    btn.innerHTML = '';
    const name = document.createElement('strong');
    name.textContent = `${icon} ${g.name}`;
    const price = document.createElement('span');
    price.className = 'night-price';
    price.innerHTML = sold ? '팔림' : `<s>🪙 ${g.original}</s> 🪙 ${g.price} <em>-${Math.round(g.discount * 100)}%</em>`;
    const desc = document.createElement('small');
    desc.textContent = g.description;
    btn.append(name, price, desc);
    btn.addEventListener('click', () => window.promptBattle.submitPrompt(`/buy ${g.id}`));
    el.append(btn);
    if (g.id === 'devilContract' && !nightCorrupted) {
      nightCorrupted = true;
      corruptIntoDevil(btn, name, desc);
    } else if (g.id === 'devilContract') btn.classList.add('corrupted');
  }
}
function openNightMarket(event) {
  monsterPanel.hidden = true;
  fleeBtn.disabled = true;
  nightGoods = event.items;
  nightSold = new Set();
  nightCorrupted = false;
  $('night-panel').hidden = false;
  $('night-art').innerHTML = NIGHT_SVG;
  renderNightGoods();
}
function closeNightMarket() {
  $('night-panel').hidden = true;
  nightGoods = [];
  monsterPanel.hidden = !merchantPanel.hidden || !$('blacksmith-panel').hidden || !$('rest-panel').hidden;
  fleeBtn.disabled = !inputEnabled;
}
$('night-leave').addEventListener('click', () => window.promptBattle.submitPrompt('/leave'));

function closeRest() {
  $('rest-panel').hidden = true;
  monsterPanel.hidden = !merchantPanel.hidden || !$('blacksmith-panel').hidden;
  fleeBtn.disabled = !inputEnabled;
}
$('rest-leave').addEventListener('click', () => window.promptBattle.submitPrompt('/leave'));

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
  renderFatigue();
}

// Hero fatigue from the plan usage: a badge at 75%+, a red one and a battle
// warning (once per level) at 90%+ — the AI may stop answering soon.
let warnedFatigue = null;
function renderFatigue() {
  const f = fatigueOf(planUsage);
  const show = f && f.level !== 'ok';
  for (const el of document.querySelectorAll('[data-usage]')) el.classList.toggle('usage-danger', f?.level === 'danger');
  for (const el of document.querySelectorAll('[data-fatigue]')) {
    el.hidden = !show;
    if (!show) continue;
    el.className = `fatigue ${f.level}`;
    el.textContent = f.level === 'danger' ? `⚠️ 피로도 위험 · ${f.window} 토큰 ${f.percent}%` : `⏳ 피로도 높음 · ${f.window} 토큰 ${f.percent}%`;
    el.title = f.level === 'danger' ? 'Claude 사용량 한도에 거의 닿았다. 곧 AI가 응답하지 않을 수 있다 — 가벼운 무기나 느린 공격 속도를 줄이자.' : 'Claude 사용량 한도의 75%를 넘었다.';
  }
  if (show && !dungeonScreen.hidden && warnedFatigue !== f.level) {
    warnedFatigue = f.level;
    appendLog(
      f.level === 'danger'
        ? `⚠️ 피로도 위험! ${f.window} 토큰 ${f.percent}% 사용 — 곧 AI가 멈출 수 있다. 가벼운 무기(모델)나 빠른 공격 속도(낮은 effort)로 아껴 쓰자.`
        : `⏳ 용사가 지쳐 간다... ${f.window} 토큰 ${f.percent}% 사용.`,
      f.level === 'danger' ? 'error' : 'story-line',
    );
  }
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
  $('change-folder').disabled = !enabled;
  $('attach-btn').disabled = !enabled;
  for (const btn of document.querySelectorAll('.bag-list button, .merchant-panel button')) btn.disabled = !enabled;
  if (nightGoods.length) renderNightGoods(); // sold-out goods stay disabled
  if (statDefs.length) renderStatPanel();
}

// A turn emits several hpChanged events (one per partial hit, plus one at
// the end), so hpChanged can't mean "turn over" — only these events do.
// notify: a message for the OS notification when the window isn't in front
// (the AI finished; time for the next command). Off for hesitation/stop.
function turnConcluded(notify) {
  if (notify) notifyTurnDone(notify);
  setInputEnabled(true);
  endOpenAgentRuns();
  refreshUsage(false);
  stopTurnTimer();
  stopTyping();
  finalizeLive();
  $('turn-panel').hidden = true;
  refreshTree();
  if (pendingQuest) showQuest(pendingQuest);
  // With a quest open the answer goes first; the memo waits for its turn.
  if ($('quest-overlay').hidden) useNextMemo();
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
    turnStatusEl.textContent = `🤖 AI가 ${weaponName()}(으)로 『${skillName()}』 시전 중 · ${elapsed}째`;
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


// My most recent message, shown next to the monster so I remember what I
// asked for while the AI works on it.
function setLastPrompt(text) {
  $('last-prompt-text').textContent = text;
  $('last-prompt-answers').textContent = '';
  $('last-prompt-answers').hidden = true;
  $('last-prompt').hidden = !text;
  $('last-prompt').classList.remove('expanded');
}
// A quest answer stacks under the original command (which stays), with the
// question it answered.
let answeringQuest = null; // the question, while its answer is being sent
function addQuestAnswer(question, answer) {
  const list = $('last-prompt-answers');
  const li = document.createElement('li');
  const q = document.createElement('small');
  q.textContent = `❔ ${question}`;
  const a = document.createElement('span');
  a.textContent = `↳ ${answer}`;
  li.append(q, a);
  list.append(li);
  list.hidden = false;
  $('last-prompt').hidden = false;
}
$('last-prompt').addEventListener('click', () => $('last-prompt').classList.toggle('expanded'));

function appendUserChat(text, extraClass) {
  if (answeringQuest !== null) {
    addQuestAnswer(answeringQuest, text);
    answeringQuest = null;
  } else setLastPrompt(text);
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
const ITEM_ICONS = { bandage: '🩹', potion: '🧪', whetstone: '🪨', amulet: '🧿', smoke: '💨', elixir: '💎', bomb: '💣', scroll: '📃', contract: '🤝', devilContract: '💀' };
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
    icon.textContent = ITEM_ICONS[id] ?? (id.startsWith('boss-') ? '👑' : '📦');
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

// A devil's contract first poses as a plain one; a second later it corrupts.
function corruptIntoDevil(card, nameEl, descEl) {
  const devil = { name: nameEl.textContent, desc: descEl.textContent };
  const plain = items.find((i) => i.id === 'contract');
  nameEl.textContent = plain?.name ?? '계약서';
  descEl.textContent = plain?.description ?? '';
  card.classList.add('disguised');
  card.disabled = true;
  setTimeout(() => {
    card.classList.add('corrupting');
    sfx('hurt');
    setTimeout(() => {
      nameEl.textContent = `💀 ${devil.name}`;
      descEl.textContent = devil.desc;
      card.classList.remove('corrupting', 'disguised');
      card.classList.add('corrupted');
      card.disabled = !inputEnabled;
      fx.burst('awaken', card, 12);
    }, 450);
  }, 1000);
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
    const limit = document.createElement('span');
    limit.className = 'limit';
    limit.dataset.limitFor = item.id;
    limit.textContent = item.limit ? `남은 ${item.limit}개` : '';
    btn.dataset.itemId = item.id;
    btn.append(name, desc, price, limit);
    btn.addEventListener('click', () => window.promptBattle.submitPrompt(`/buy ${item.id}`));
    merchantItemsEl.append(btn);
    if (item.id === 'devilContract') corruptIntoDevil(btn, name, desc);
  }
  renderSellList();
}

// The merchant buys back what's in the bag, at half its price.
function renderSellList() {
  const el = $('merchant-sell');
  el.textContent = '';
  const entries = Object.entries(bag).filter(([, n]) => n > 0);
  if (!entries.length) {
    el.textContent = '팔 물건이 없다';
    return;
  }
  for (const [id, count] of entries) {
    const item = items.find((i) => i.id === id);
    if (!item) continue;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sell-item';
    btn.disabled = !inputEnabled;
    const gain = Math.floor(Math.round(item.price * merchantPriceMult) / 2); // half today's price
    btn.textContent = `${ITEM_ICONS[id] ?? (id.startsWith('boss-') ? '👑' : '📦')} ${item.name} ×${count} · 🪙 ${gain}`;
    btn.title = `${item.name} 1개를 ${gain} 코인에 판다`;
    btn.addEventListener('click', () => window.promptBattle.submitPrompt(`/sell ${id}`));
    el.append(btn);
  }
}

let merchantPriceMult = 1;
function closeMerchant() {
  merchantPanel.hidden = true;
  monsterPanel.hidden = false;
  fleeBtn.disabled = !inputEnabled;
}

// Previous chats in this folder, shown dimmed above today's adventure.
function setBar(fillEl, labelEl, hp, maxHp, suffix) {
  fillEl.classList.remove('chest-fill');
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

const baseName = (p) => p.split(/[\\/]/).filter(Boolean).pop();

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
    case 'bossEnraged':
      sfx('boss');
      break;
    case 'counterBlocked':
    case 'gimmickBlocked':
    case 'gimmickHeal':
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

// Hit numbers, sparkles and flashes for what just happened (fx.js).
let fxPlayerHp = null;
function fxFor(event) {
  switch (event.type) {
    case 'attack':
      if (event.damage > 0) {
        fx.number('monster-art', event.damage, event.crit ? 'crit' : 'hit');
        fx.burst(event.crit ? 'crit' : 'hit');
        if (event.crit) fx.flash();
      }
      break;
    case 'partialHit':
    case 'typingHit':
    case 'reflectHit':
      fx.number('monster-art', event.damage, 'small');
      break;
    case 'bombHit':
      fx.number('monster-art', event.damage, 'crit');
      fx.burst('fire');
      break;
    case 'petHelped':
      if (event.pet === 'drake') {
        fx.number('monster-art', event.amount, 'small');
        fx.burst('fire', 'monster-art', 8);
      }
      break;
    case 'chestHit':
      fx.number('monster-art', event.damage, 'small');
      break;
    case 'chestOpened':
      setTimeout(() => fx.burst('chest'), 900); // after the lid opens
      break;
    case 'floorCleared':
      fx.burst('clear');
      break;
    case 'bossEnraged':
      fx.flash('rgba(191, 97, 106, 0.35)');
      break;
    case 'playerHpChanged':
      if (fxPlayerHp !== null && event.hp !== fxPlayerHp) {
        const diff = event.hp - fxPlayerHp;
        fx.number('player-hp-fill', Math.abs(diff), diff > 0 ? 'heal' : 'hurt');
        if (diff > 0) fx.burst('heal', 'player-hp-fill', 8);
      }
      fxPlayerHp = event.hp;
      break;
    case 'runStart':
      fxPlayerHp = event.playerHp;
      break;
  }
}

function renderBattleEvent(event) {
  soundFor(event);
  fxFor(event);
  if (PROGRESS_EVENTS.has(event.type) && !dailyRun) unsaved = true; // a daily run can't be saved anyway
  speechFor(event);
  switch (event.type) {
    case 'runStart':
      setBar(playerHpFill, playerHpLabel, event.playerHp, event.playerMaxHp, '');
      appendLog('새로운 세션으로 모험을 시작한다.', 'story-line');
      break;
    case 'floorStart': {
      Object.assign(chest, { active: false, opened: false, total: 0, maxHp: event.maxHp });
      const info = chapterInfo(activeTheme, event.chapter);
      if (event.floor % 6 === 0) {
        appendLog(`— 챕터 ${event.chapter}: ${info.title} —`, 'story-intro');
        appendLog(info.intro, 'story-intro');
      }
      chapterBanner.textContent = `챕터 ${event.chapter} · ${info.title} · ${(event.floor % 6) + 1}/6층`;
      currentMonsterName = event.isBoss ? info.boss : event.monsterName;
      monsterPanel.classList.toggle('boss', event.isBoss);
      monsterPanel.classList.remove('defeated', 'enraged');
      monsterNameEl.textContent = event.isBoss ? `보스: ${currentMonsterName}` : `${event.floor + 1}층: ${currentMonsterName}`;
      monsterArtEl.innerHTML = monsterSvg(event.monsterIndex, event.isBoss);
      setBar(hpBarFillEl, hpLabelEl, event.maxHp, event.maxHp, ' HP');
      currentChapter = event.chapter;
      appendLog(event.isBoss ? `보스 ${currentMonsterName}이(가) 모습을 드러냈다!` : `${currentMonsterName}이(가) 나타났다!`, event.isBoss ? 'crit' : undefined);
      if (event.isBoss) appendLog(`${currentMonsterName}: ${bossTaunt(currentMonsterName, event.chapter)}`, 'boss-taunt');
      if (event.trait) appendLog(`특성 — ${event.trait.name}: ${event.trait.text}`, 'trait-line');
      $('boss-rule').hidden = !event.gimmick;
      if (event.gimmick) {
        $('boss-rule').textContent = `보스 규칙 — ${event.gimmick.text}`;
        appendLog(`⚠️ 보스 규칙: ${event.gimmick.text}`, 'boss-rule-line');
      }
      break;
    }
    case 'gimmickBlocked':
      appendLog(`🛡 보스 규칙에 막혔다! ${event.text} — 이번 턴 피해가 없던 일이 됐다.`, 'error');
      turnConcluded('보스 규칙에 막혔다. 다음 명령을 내려줘.');
      break;
    case 'gimmickHeal':
      appendLog(`🩹 도구가 실패하자 ${currentMonsterName}이(가) 체력을 ${event.amount} 회복했다!`, 'error');
      break;
    case 'traitThorns':
      appendLog(`작업이 실패하자 ${currentMonsterName}의 가시에 찔렸다! ${event.damage}의 피해.`, 'error');
      break;
    case 'traitRegen':
      appendLog(`🩹 ${currentMonsterName}이(가) 체력을 ${event.amount} 재생했다.`);
      break;
    case 'petHelped': {
      const pet = petInfo(event.pet)?.name ?? '동료';
      appendLog(event.pet === 'slime' ? `${PET_ICON.slime} ${pet}가 HP ${event.amount}을(를) 회복시켰다.` : `${PET_ICON.drake} ${pet}의 불꽃! ${event.amount}의 피해!`, 'partial-hit');
      if (event.pet === 'drake') flashMonster();
      break;
    }
    case 'petFound': {
      const pet = petInfo(event.pet);
      appendLog(`🐾 상자 안에서 새 동료를 찾았다: ${PET_ICON[event.pet] ?? ''} ${pet?.name ?? event.pet} — ${pet?.text ?? ''} (다음 판부터 데려갈 수 있다)`, 'victory');
      break;
    }
    case 'bossEnraged':
      monsterPanel.classList.add('enraged');
      monsterPanel.dataset.awakening = event.awakening ?? 'rage';
      appendLog(`${currentMonsterName}: ${bossRoar(currentChapter)}`, 'boss-taunt');
      appendLog(`🔥 ${currentMonsterName}이(가) 각성했다! 2페이즈 「${event.name ?? '격노'}」 — ${event.text ?? '반격이 30% 더 강해진다'}!`, 'crit');
      shakeScreen();
      fx.burst('awaken');
      break;
    case 'bossDrop':
      appendLog(`👑 보스가 고유 유물을 떨어뜨렸다: 「${event.name}」 — ${event.description} (가방에 넣었다)`, 'victory');
      fx.burst('chest');
      break;
    case 'bossDrain':
      appendLog(`🩸 ${currentMonsterName}이(가) 피를 빨아 HP ${event.amount}을(를) 회복했다!`, 'error');
      break;
    case 'monsterWaits':
      appendLog(stoppedTurn ? `${currentMonsterName}이(가) 다음 명령을 기다린다...` : `❔ AI가 묻고 있다. ${currentMonsterName}이(가) 대답을 기다린다...`);
      stoppedTurn = false;
      break;
    case 'hesitate':
      appendLog('망설였다. 이번 턴은 공격하지 못했다.');
      turnConcluded();
      break;
    case 'turnStart':
      if (attachedNow.length) {
        appendLog(`📎 첨부: ${attachedNow.map((a) => a.name).join(', ')}`, 'story-line');
        renderAttachments([]); // the turn took them
      }
      $('turn-panel').hidden = false;
      turnStatusEl.textContent = `AI가 ${weaponName()}(으)로 『${skillName()}』 시전 중...`;
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
      turnConcluded('작업이 실패했다. 다음 명령을 내려줘.');
      break;
    case 'attack': {
      if (event.damage === 0) {
        appendLog(pick(DODGE_LINES), 'dodge');
      } else {
        const label = event.crit ? ' 크리티컬 히트!' : '';
        appendLog(`『${skillName()}』 ${pick(ATTACK_LINES[chosenClass] ?? ATTACK_LINES.swordsman)(event.damage, weaponName())}${label}`, event.crit ? 'crit' : undefined);
        flashMonster();
      }
      if (event.matchedKeywords.length > 0) appendLog(`(키워드: ${event.matchedKeywords.join(', ')})`);
      turnConcluded(chest.active || chest.opened ? `${currentMonsterName}을(를) 쓰러뜨렸다! 다음 명령을 내려줘.` : `『${skillName()}』 작업 완료 — 다음 명령을 내려줘.`);
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
      if (chest.active) break; // the bar shows the chest's progress now
      setBar(hpBarFillEl, hpLabelEl, event.hp, event.maxHp, ' HP');
      break;
    case 'monsterDown':
      chest.active = true;
      chest.total = 0;
      monsterPanel.classList.add('defeated');
      appendLog(`${currentMonsterName}이(가) 쓰러졌다! 남은 공격은 보물상자를 두드린다...`, 'victory');
      setTimeout(() => {
        monsterPanel.classList.remove('defeated');
        renderChest(false);
      }, 600);
      break;
    case 'chestHit':
      chest.total = event.total;
      renderChest(false);
      flashMonster();
      break;
    case 'chestOpened': {
      chest.active = true;
      chest.total = event.overkill;
      chest.opened = true;
      // Shake the closed chest, then burst it open; the following events
      // (coins, floor cleared, shop) wait until it has opened.
      renderChest(false, event.grade);
      monsterArtEl.classList.add('chest-shaking');
      sfx('partial');
      holdBattleEvents(CHEST_SHAKE_MS + CHEST_REVEAL_MS);
      setTimeout(() => {
        monsterArtEl.classList.remove('chest-shaking');
        renderChest(true, event.grade);
        monsterArtEl.classList.add('chest-opening');
        sfx(['wood', 'iron', 'silver'].includes(event.grade) ? 'coin' : 'fanfare');
        const found = event.items.map((id) => itemName(id));
        appendLog(`🎁 ${event.name} 개봉! (넘친 피해 ${event.overkill}) +${event.coins} 코인${found.length ? ` · ${found.join(', ')} 발견!` : ''}`, 'victory');
        setTimeout(() => monsterArtEl.classList.remove('chest-opening'), CHEST_REVEAL_MS);
      }, CHEST_SHAKE_MS);
      break;
    }
    case 'monsterAttack':
      pendingCounter = event.damage;
      appendLog(`${currentMonsterName}${pick(COUNTER_LINES)} ${event.damage}의 피해를 받았다!`, 'error');
      shakeScreen();
      break;
    case 'playerHpChanged':
      if (lastPlayerHp !== null && event.hp < lastPlayerHp) {
        lastHit = { damage: pendingCounter ?? lastPlayerHp - event.hp, by: currentMonsterName, hpBefore: lastPlayerHp };
      }
      pendingCounter = null;
      lastPlayerHp = event.hp;
      setBar(playerHpFill, playerHpLabel, event.hp, event.maxHp, '');
      break;
    case 'playerDefeated':
      appendLog('용사가 쓰러졌다...', 'error');
      showDeathCard();
      break;
    case 'floorCleared': {
      const before = levelOf(profile.xp + runXp);
      runXp += event.xpGained;
      const after = levelOf(profile.xp + runXp);
      renderXp();
      if (after > before) {
        appendLog(`⬆️ 레벨 업! 용사 레벨 ${after}이(가) 되었다! (다음 판은 능력치 포인트 ${after}개로 시작)`, 'victory');
        fx.burst('levelup', document.querySelector('[data-xp-fill]'));
        if (titleOf(after) !== titleOf(before)) appendLog(`🎖 새 칭호 획득: 「${titleOf(after)}」`, 'victory');
        sfx('fanfare');
      }
    }
      if (!chest.opened) monsterPanel.classList.add('defeated');
      appendLog(`${currentMonsterName} 처치! ${event.xpGained ? `+${event.xpGained} XP` : '경험치 없음 (불러온 저장에서 이미 받은 층)'} (체력 조금 회복)`, 'victory');
      break;
    case 'chapterCleared': {
      const info = chapterInfo(activeTheme, event.chapter);
      appendLog(`★ 챕터 ${event.chapter} 클리어! ★`, 'victory');
      appendLog(info.outro, 'story-intro');
      showStoryCard(`★ 챕터 ${event.chapter} 클리어 — ${info.title}`, [info.outro, `다음: ${chapterInfo(activeTheme, event.chapter + 1).title}`], { autoClose: 6000 });
      appendLog('이야기는 계속된다... (지금 도망쳐도 다음에 이어서 할 수 있다)', 'story-line');
      break;
    }
    case 'sessionReset':
      currentSessionId = null;
      contextUsage = null;
      renderUsage();
      sessionBanner.hidden = true;
      // /new: the old chat belongs to a session Claude no longer sees.
      if (event.reason === 'new') {
        finalizeLive();
        logEl.textContent = '';
      }
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
      merchantPriceMult = event.priceMult ?? 1;
      renderCoins();
      appendLog(merchantPriceMult > 1 ? `상인 고블린이 나타났다! "헤헤, 이 깊이까지 오느라 물가가 ${Math.round((merchantPriceMult - 1) * 100)}% 올랐어~"` : '상인 고블린이 나타났다! "헤헤, 구경하고 가~"', 'coin-line');
      openMerchant(event);
      break;
    case 'purchased':
      coins = event.coins;
      renderCoins();
      if (nightGoods.length) {
        nightSold.add(event.itemId);
        renderNightGoods();
      }
      if (event.left !== undefined) {
        const tag = merchantItemsEl.querySelector(`[data-limit-for="${event.itemId}"]`);
        if (tag) tag.textContent = event.left > 0 ? `남은 ${event.left}개` : '품절';
        const btn = merchantItemsEl.querySelector(`[data-item-id="${event.itemId}"]`);
        if (btn && event.left <= 0) btn.classList.add('sold-out');
      }
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
      if (!merchantPanel.hidden) renderSellList();
      break;
    case 'sold':
      coins = event.coins;
      renderCoins();
      appendLog(`💰 ${itemName(event.itemId)}을(를) 팔았다! +${event.gained} 코인 (보유 ${event.coins})`, 'coin-line');
      break;
    case 'sellFailed':
      appendLog(`팔 수 없다: ${event.reason}`, 'error');
      break;
    case 'itemUsed': {
      const lines = {
        potion: '회복 물약을 마셨다! 체력이 회복된다.',
        bandage: '🩹 붕대를 감았다! 체력이 조금 회복된다.',
        whetstone: '숫돌로 무기를 갈았다! 다음 공격은 2배.',
        amulet: '수호의 부적이 빛난다! 다음 반격을 막아준다.',
        elixir: '💎 엘릭서를 마셨다! 체력이 완전히 회복됐다.',
        scroll: '📃 지혜의 두루마리를 읽었다!',
      };
      appendLog(lines[event.itemId] ?? `${itemName(event.itemId)} 사용!`, 'victory');
      break;
    }
    case 'contractSigned':
      heroContract = { kind: event.kind, id: event.id };
      renderContract();
      appendLog(
        event.kind === 'god'
          ? `🤝 ${event.name}와(과) 계약했다! 모든 타격 +5% · ${event.text}`
          : `💀 ${event.name}와(과) 계약했다... 최대 HP의 대가로 체력 ${event.hpCost}을(를) 바쳤다. ${event.text}`,
        event.kind === 'god' ? 'victory' : 'crit',
      );
      break;
    case 'contractBroken':
      heroContract = null;
      renderContract();
      appendLog(`⚠️ 계약이 서로 충돌해 모두 깨졌다! 최대 HP가 영구히 ${event.penalty} 줄었다 (최대 HP ${event.maxHp}). 이제 다시 계약할 수 있다.`, 'error');
      break;
    case 'relicGained':
      appendLog(`✨ ${itemName(event.itemId)}을(를) 손에 넣었다! 이제부터 얻는 코인 +25% (영구)`, 'victory');
      break;
    case 'bombHit':
      appendLog(`💣 폭탄을 던졌다! ${currentMonsterName}에게 ${event.damage}의 피해!`, 'crit');
      flashMonster();
      break;
    case 'bonusXp':
      runXp += event.amount;
      renderXp();
      appendLog(event.amount ? `✨ 경험치 +${event.amount}` : '✨ 이 층에서 이미 받은 두루마리 경험치다 (불러온 저장, +0)', event.amount ? 'victory' : 'sys-line');
      break;
    case 'reflectHit':
      appendLog(`질투의 계약: 받은 반격의 일부(${event.damage})를 되돌려 줬다!`);
      break;
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
    case 'nightMarketOpen':
      coins = event.coins;
      renderCoins();
      appendLog('🏮 어둠 속에 등불이 하나둘 켜진다... 야시장이 열렸다! 오늘 밤만, 하나씩만.', 'coin-line');
      openNightMarket(event);
      fx.burst('chest', 'night-art', 14);
      break;
    case 'nightMarketClosed':
      closeNightMarket();
      break;
    case 'springOpen':
      appendLog('💧 숲 사이로 맑은 샘이 보인다. 한 모금이면 상처가 아물 것 같다.', 'story-line');
      openRest('spring', `"지친 용사여, 한 번만 마시게나." — 최대 HP의 50%를 회복한다. (지금 ${event.playerHp}/${event.playerMaxHp})`, '샘물 마시기', '/drink');
      break;
    case 'springDrank':
      $('rest-result').textContent = `HP ${event.amount} 회복!`;
      $('rest-action').disabled = true;
      appendLog(`💧 샘물을 마셨다. HP ${event.amount} 회복!`, 'victory');
      fx.burst('heal', 'rest-art', 18);
      break;
    case 'springFailed':
      $('rest-result').textContent = event.reason;
      break;
    case 'springClosed':
    case 'shrineClosed':
      closeRest();
      break;
    case 'shrineOpen': {
      const pact = pactInfo(event.contract);
      appendLog('🕯 무너진 제단이 나타났다. 계약의 사슬이 희미하게 울린다...', 'story-line');
      openRest('shrine', `"맺은 계약을 이곳에 내려놓을 수 있다. 대가는 없다." — 지금 계약: ${pact?.name ?? '?'}. 파기하면 효과가 사라지고 최대 HP는 깎이지 않는다.`, '계약 파기하기', '/renounce');
      break;
    }
    case 'contractRenounced':
      heroContract = null;
      renderContract();
      $('rest-action').disabled = true;
      $('rest-result').textContent = '계약이 풀렸다';
      appendLog(`🕯 ${event.name}와(과)의 계약을 제단에 내려놓았다. 몸이 가벼워진다. (최대 HP 그대로)`, 'victory');
      fx.burst('awaken', 'rest-art', 16);
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
      unsaved = false;
      appendLog(`💾 슬롯 ${event.slot}에 저장했다.`, 'victory');
      if (saveThenExit) {
        saveThenExit = false;
        leaveRun();
      }
      break;
    case 'saveFailed':
      saveThenExit = false;
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
      stoppedTurn = true;
      appendLog('⏹ 공격을 멈췄다. 지금까지 들어간 타격은 그대로, 마무리 일격은 없다. 다른 명령을 내려 보자.', 'story-line');
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
// Story cards: lines fade in one by one; the button shows the rest, then
// closes. autoClose (ms) closes a short card by itself.
let storyTimer = 0;
function showStoryCard(title, lines, { button = '계속 ▶', autoClose = 0 } = {}) {
  clearInterval(storyTimer);
  const card = $('story-card');
  const box = $('story-card-lines');
  $('story-card-title').textContent = title;
  box.textContent = '';
  const els = lines.map((text) => {
    const p = document.createElement('p');
    p.textContent = text;
    box.append(p);
    return p;
  });
  let shown = 0;
  const step = () => {
    if (shown < els.length) els[shown++].classList.add('shown');
    if (shown >= els.length) {
      clearInterval(storyTimer);
      $('story-card-next').textContent = button;
      if (autoClose) storyTimer = setTimeout(close, autoClose);
    }
  };
  const close = () => {
    clearInterval(storyTimer);
    card.hidden = true;
    promptInput.focus();
  };
  $('story-card-next').textContent = '건너뛰기 ▶▶';
  $('story-card-next').onclick = () => (shown < els.length ? (els.forEach((p) => p.classList.add('shown')), (shown = els.length), step()) : close());
  card.hidden = false;
  step();
  storyTimer = setInterval(step, 1500);
}
let currentChapter = 1;

// Death: the battle screen stays with the killing blow shown until 다음으로.
let lastPlayerHp = null;
let lastHit = null;
let pendingCounter = null; // a counter's full damage, before HP clamps at 0
let deathAck = null; // resolves when 다음으로 is clicked
function showDeathCard() {
  $('death-last-hit').textContent = lastHit ? `마지막 피해: ${lastHit.by}에게 ${lastHit.damage} (남아 있던 HP ${lastHit.hpBefore})` : '';
  $('death-card').hidden = false;
  setInputEnabled(false);
  $('death-next').focus();
}
function resetDeathCard() {
  lastPlayerHp = null;
  lastHit = null;
  pendingCounter = null;
  $('death-card').hidden = true;
  deathAck = new Promise((resolve) => $('death-next').addEventListener('click', resolve, { once: true }));
}
let stoppedTurn = false; // the last turn was stopped with ⏹ (monsterWaits follows)
const typingBehind = new Set(); // bubbles whose shown text lags the stream
// Animations that should play out before the next events (the chest opening).
let animHolds = 0;
const CHEST_SHAKE_MS = 1100;
const CHEST_REVEAL_MS = 900;
function holdBattleEvents(ms) {
  animHolds += 1;
  setTimeout(() => {
    animHolds -= 1;
    drainBattleEvents();
  }, ms);
}
function drainBattleEvents() {
  while (battleQueue.length && typingBehind.size === 0 && animHolds === 0) renderBattleEvent(battleQueue.shift());
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
// Short: "챕터 1 · 5층"; everything else goes in the card's tooltip.
const slotPlace = (slot) => `챕터 ${Math.floor(slot.floor / 6) + 1} · ${(slot.floor % 6) + 1}층`;
const slotTheme = (slot) => THEMES.find((t) => t.id === slot.themeId)?.title ?? slot.themeId;
const slotFolder = (slot) => slot.cwd.split(/[\\/]/).filter(Boolean).pop();
function slotSummary(slot) {
  return `${slotTheme(slot)} · ${slotPlace(slot)}`;
}
function slotDetails(slot) {
  return `${slotTheme(slot)} · ${slotPlace(slot)}${slot.monsterHp ? ` (몬스터 HP ${slot.monsterHp})` : ''}\nHP ${slot.playerHp}/${slot.playerMaxHp} · 🪙 ${slot.coins} · 무기 +${slot.swordLevel}\n📁 ${slot.cwd}\n${shortTime(slot.savedAt)} 저장`;
}

const AUTO_SLOT_INDEX = 3; // slot 4: the per-floor autosave
function renderSlotRows(container, onPick, allowEmpty, includeAuto, onDelete) {
  container.textContent = '';
  slots.forEach((slot, i) => {
    if (i === AUTO_SLOT_INDEX && !includeAuto) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot-row';
    const strong = document.createElement('strong');
    strong.textContent = i === AUTO_SLOT_INDEX ? '🔄 자동 저장 (최근)' : `슬롯 ${i + 1}`;
    btn.append(strong);
    if (slot) {
      const place = document.createElement('span');
      place.className = 'slot-place';
      place.textContent = slotPlace(slot);
      const meta = document.createElement('small');
      meta.textContent = `${slotTheme(slot)} · 📁 ${slotFolder(slot)} · ${shortTime(slot.savedAt)}`;
      btn.append(place, meta);
      btn.title = slotDetails(slot);
    } else {
      const empty = document.createElement('span');
      empty.textContent = '비어 있음';
      btn.append(empty);
    }
    btn.disabled = !slot && !allowEmpty;
    btn.addEventListener('click', () => onPick(i + 1, slot));
    if (!(onDelete && slot)) {
      container.append(btn);
      return;
    }
    // A delete button beside the card (not inside it: no nested buttons).
    const cell = document.createElement('div');
    cell.className = 'slot-cell';
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'slot-delete';
    del.title = '이 저장 삭제';
    del.setAttribute('aria-label', `${strong.textContent} 삭제`);
    del.textContent = '🗑';
    del.addEventListener('click', () => onDelete(i + 1, strong.textContent));
    cell.append(btn, del);
    container.append(cell);
  });
}

async function refreshSlots() {
  slots = await window.promptBattle.listSlots();
  renderSlotRows($('slot-list'), (n, slot) => slot && startGame({ loadSlot: n, slot }), false, true, async (n, name) => {
    if (!confirm(`${name}을(를) 삭제할까요? 되돌릴 수 없어요.`)) return;
    await window.promptBattle.deleteSlot(n);
    await refreshSlots();
  });
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

// 일일 도전: today's fixed dungeon, same for everyone, normal difficulty, no saving.
let todayDungeon = null;
let rosterNames = [];
let dailyRun = false;
function renderDailyInfo() {
  if (!todayDungeon) return;
  const theme = THEMES.find((t) => t.id === todayDungeon.themeId);
  const areas = todayDungeon.rosters.slice(0, 3).map((r) => rosterNames[r]).filter(Boolean).join(' → ');
  $('daily-info').textContent = `${todayDungeon.date.slice(5).replace('-', '/')} · ${theme?.title ?? ''} · ${areas} … · 보통 난이도 · 저장 불가 · 일일 랭킹`;
}
$('daily-btn').addEventListener('click', () => {
  if (!chosenFolder) {
    setupErrorEl.textContent = '작업할 폴더를 먼저 골라 주세요.';
    setupErrorEl.hidden = false;
    return;
  }
  startGame({ daily: true });
});

async function startGame({ loadSlot, slot, daily = false }) {
  dailyRun = daily;
  if (daily) {
    slot = undefined;
    loadSlot = undefined;
  }
  // Picking a Claude session resumes its autosaved run too (main does the
  // same lookup); treat it like a slot for the starting UI state.
  if (!daily && !slot && chosenFolder && !sessionPicker.hidden && sessionSelect.value) {
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
  const difficulty = slot ? slot.difficulty : daily ? 'normal' : document.querySelector('input[name="difficulty"]:checked').value;
  activeTheme = THEMES.find((t) => t.id === (daily && todayDungeon ? todayDungeon.themeId : chosenThemeId)) || THEMES[0];
  // A new adventure starts at the beginning; continuing is the slots' job.
  const startFloor = 0;
  const sessionId = slot ? slot.sessionId : daily || sessionPicker.hidden ? undefined : sessionSelect.value || undefined;
  currentSessionId = sessionId ?? null;
  weaponSelect.value = chosenWeapon;
  touchedFiles.clear();
  renderFolderLabel();
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
  const startPoints = profile.level + 2 * (profile.prestige ?? 0); // 환생 ★: +2 each
  statPoints = slot ? slot.statPoints : startPoints;
  swordLevel = from.swordLevel;
  renderCoins();
  renderSwordLevel();
  closeMerchant();
  closeBlacksmith();
  closeRest();
  closeNightMarket();
  exitOverlay.hidden = true;
  unsaved = false;
  saveThenExit = false;
  setInputEnabled(true);
  renderBag();
  if (sessionId) {
    const title = sessionSelect.selectedOptions[0]?.textContent ?? '';
    await renderSessionHistory(sessionId, slot ? '저장된 세션' : title.replace(/ · .*$/, ''));
    appendLog('이전 세션을 이어서 모험을 계속한다.', 'story-line');
  }
  // A new session starts on a clean log: Claude doesn't remember earlier
  // sessions, so their chat isn't shown either.
  if (!slot) appendLog(`⭐ 레벨 ${profile.level}${profile.prestige ? ` · 환생 ★${profile.prestige}` : ''} 보너스: 능력치 포인트 ${startPoints}개로 시작한다! 위쪽 버튼으로 바로 올려보자.`, 'coin-line');
  if (!slot) {
    const lines = PROLOGUES[daily ? 'daily' : activeTheme.id] ?? [];
    if (lines.length) showStoryCard(daily ? '📅 오늘의 도전' : activeTheme.title, lines, { button: '모험 시작 ▶' });
  }
  if (daily) appendLog(`📅 오늘의 도전 (${todayDungeon?.date ?? ''}) — 모두가 같은 던전을 돈다. 저장은 안 된다. 쓰러지면 일일 랭킹에 올릴 수 있다!`, 'story-intro');
  if (slot) {
    const from = loadSlot ? `슬롯 ${loadSlot}을(를)` : '이 세션의 자동 저장을';
    appendLog(`💾 ${from} 불러왔다. ${slotSummary(slot)}`, 'story-line');
  }
  contextUsage = null;
  refreshUsage(true);
  try {
    const party = $('party-mode').checked;
    const heroClassId = chosenClass;
    resetDeathCard();
    renderPetBadge();
    $('save-btn').hidden = daily;
    const runPromise = window.promptBattle.startRun({ cwd: chosenFolder, difficulty, model: chosenWeapon, themeId: activeTheme.id, startFloor, sessionId, loadSlot, party, heroClass: heroClassId, pet: chosenPet, daily });
    setTimeout(refreshTree, 300);
    const { summary, profile: updated, progress, ranking } = await runPromise;
    if (summary.defeated) await deathAck;
    $('death-card').hidden = true;
    profile = updated;
    dungeonScreen.hidden = true;
    summaryScreen.hidden = false;
    renderSummary(summary, updated, progress, { difficulty, startCoins: from.coins });
    renderRankingCard(ranking);
  } catch (err) {
    // An unexpected main-process error (agent-turn errors never reject this
    // call). Without this, the player would be stuck on the dungeon screen.
    dungeonScreen.hidden = true;
    setupScreen.hidden = false;
    setupErrorEl.textContent = `문제가 발생했습니다: ${err && err.message ? err.message : String(err)}`;
    setupErrorEl.hidden = false;
  }
}

// Summary screen after a run: outcome, this run's numbers as tiles, the
// level bar, rewards and how to continue.
const DIFFICULTY_LABEL = { easy: '쉬움', normal: '보통', hard: '어려움' };
function renderSummary(summary, updated, progress, { difficulty, startCoins }) {
  const reached = summary.nextFloor;
  $('summary-badge').textContent = summary.defeated ? '💀' : summary.floorsCleared > 0 ? '🏆' : '🎒';
  $('summary-badge').className = `summary-badge${summary.defeated ? ' lost' : ''}`;
  summaryTitleEl.textContent = summary.defeated ? '쓰러졌다...' : summary.floorsCleared > 0 ? '모험 완료!' : '오늘은 여기까지';
  summaryTextEl.textContent = `${activeTheme.title} · 챕터 ${Math.floor(reached / 6) + 1} ${(reached % 6) + 1}층까지 · ${DIFFICULTY_LABEL[difficulty] ?? difficulty}`;
  const r = summary.runStats ?? {};
  const coinDelta = summary.coins - (startCoins ?? summary.coins);
  const tiles = [
    ['⚔️', '처치', `${summary.floorsCleared}마리`],
    ['✨', '경험치', `+${summary.xpGained}`],
    ['🪙', '코인', `${coinDelta >= 0 ? '+' : ''}${coinDelta} (보유 ${summary.coins})`],
    ['💥', '최고 한 방', fmtNum(r.bestHit)],
    ['🗨', '공격 명령', `${fmtNum(r.turns)}번`],
    ['🧪', '테스트 통과', `${fmtNum(r.testsPassed)}번`],
    ['📝', '파일 수정', `${fmtNum(r.filesEdited)}번`],
    ['⏱', '가장 긴 턴', fmtDuration(r.longestTurnMs)],
  ];
  const grid = $('summary-tiles');
  grid.textContent = '';
  for (const [icon, label, value] of tiles) {
    const cell = document.createElement('div');
    const v = document.createElement('strong');
    v.textContent = value;
    const l = document.createElement('small');
    l.textContent = `${icon} ${label}`;
    cell.append(v, l);
    grid.append(cell);
  }
  runXp = 0; // the profile already holds this run's XP
  renderXp();
  renderRunRewards(progress);
  summaryStoryEl.textContent = summary.defeated
    ? '💾 자동 저장에 마지막 상태가 남아 있다. 시작 화면의 이어하기에서 다시 도전하자.'
    : '💾 시작 화면의 이어하기(자동 저장)에서 방금 상태 그대로 이어갈 수 있다.';
}

// Summary screen: achievements unlocked and the daily quest, if done this run.
function renderRunRewards(progress) {
  const el = $('summary-rewards');
  el.textContent = '';
  if (!progress) return;
  const add = (text, cls) => {
    const row = document.createElement('div');
    row.className = cls;
    row.textContent = text;
    el.append(row);
  };
  for (const a of progress.unlocked) add(`🏆 업적 달성: ${a.icon} ${a.title} — ${a.description} (+${a.coins} 코인)`, 'reward-achievement');
  if (progress.dailyCompleted) add(`📅 오늘의 퀘스트 완료: ${progress.dailyCompleted.icon} ${progress.dailyCompleted.title} (+${progress.dailyCompleted.coins} 코인)`, 'reward-daily');
  if (progress.unlocked.length || progress.dailyCompleted) sfx('fanfare');
}

const GAME_COMMANDS = ['/bet', '/buy', '/drink', '/enhance', '/flee', '/leave', '/new', '/quit', '/renounce', '/save', '/sell', '/session', '/stat', '/use'];
const isGameCommand = (text) => GAME_COMMANDS.some((c) => text === c || text.startsWith(`${c} `));

attackForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = promptInput.value;
  const trimmed = text.trim();
  promptInput.value = '';
  // Only a real agent turn (or an empty hesitate) waits on an event that
  // re-enables input; slash commands (/new alone, /use, /buy, /flee...)
  // resolve instantly, so disabling for them would lock the input.
  // At a shop an empty line just leaves it (no hesitate follows).
  const atMerchant = !merchantPanel.hidden || !$('blacksmith-panel').hidden || !$('rest-panel').hidden || !$('night-panel').hidden;
  // A skill (/fix-tests ...) is a real attack; only the game's own commands aren't.
  const command = isGameCommand(trimmed);
  const startsTurn = (!command && !(atMerchant && trimmed === '')) || /^\/new\s+\S/.test(trimmed);
  if (startsTurn) setInputEnabled(false);
  // Show my message right away, then jump to the bottom.
  const shown = trimmed.startsWith('/new ') ? trimmed.slice(5).trim() : trimmed;
  if (shown && !isGameCommand(shown) && !atMerchant) appendUserChat(shown);
  answeringQuest = null;
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

// Progress since the last manual save: leaving then asks first.
let unsaved = false;
let saveThenExit = false;
const PROGRESS_EVENTS = new Set(['turnStart', 'floorCleared', 'purchased', 'itemUsed', 'statRaised', 'enhanceResult', 'betResult', 'contractSigned', 'contractBroken', 'relicGained']);
exitBtn.addEventListener('click', () => {
  $('exit-unsaved').hidden = !unsaved;
  $('exit-save').hidden = !unsaved;
  exitConfirmBtn.textContent = unsaved ? '저장 안 하고 종료' : '오늘 모험 종료하기';
  exitOverlay.hidden = false;
});
$('exit-save').addEventListener('click', () => {
  exitOverlay.hidden = true;
  saveThenExit = true;
  $('save-btn').click();
});
$('save-close').addEventListener('click', () => (saveThenExit = false));
function leaveRun() {
  exitOverlay.hidden = true;
  setInputEnabled(false);
  window.promptBattle.submitPrompt('/quit');
}
exitCancelBtn.addEventListener('click', () => {
  exitOverlay.hidden = true;
  promptInput.focus();
});
exitConfirmBtn.addEventListener('click', leaveRun);

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

// Effort is picked as the hero class's skill: low → max = weakest → strongest.
const skillOf = (level) => heroClass()?.skills?.[level] ?? { name: level, text: '' };
const skillName = () => skillOf(claudeSettings.effort).name;
function renderEffortSelects() {
  if (!speedInfo) return;
  const select = $('effort-battle');
  select.textContent = '';
  const grid = $('hero-skill-options');
  grid.textContent = '';
  for (const level of speedInfo.levels) {
    const { multiplier } = speedInfo.attackSpeed[level];
    const cost = costDots(speedInfo.levels.indexOf(level) + 1, speedInfo.levels.length);
    const skill = skillOf(level);
    const option = document.createElement('option');
    option.value = level;
    option.textContent = `${skill.name} x${multiplier} · 토큰 ${cost}`;
    select.append(option);
    const card = choiceCard('hero-skill', level, level === claudeSettings.effort, skill.name, `${skill.text} · 피해 x${multiplier} · 토큰 ${cost}`, () => saveClaude({ effort: level }));
    card.title = `effort ${level}`;
    grid.append(card);
  }
  select.value = claudeSettings.effort;
}
$('effort-battle').addEventListener('change', async (e) => {
  await saveClaude({ effort: e.target.value });
  const s = speedInfo.attackSpeed[claudeSettings.effort];
  appendLog(`⚡ 스킬을 바꿨다: ${skillName()} (effort ${claudeSettings.effort}, 피해 x${s.multiplier}) — 다음 공격부터`, 'story-line');
});

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

// Servers added in the game (claudeSettings.mcpServers), with a remove button.
function renderGameMcp() {
  const list = $('mcp-game-list');
  list.textContent = '';
  for (const [name, server] of Object.entries(claudeSettings.mcpServers ?? {})) {
    const row = document.createElement('div');
    row.className = 'mcp-item';
    const label = document.createElement('span');
    label.textContent = `${name} — ${server.type === 'http' ? server.url : [server.command, ...server.args].join(' ')}`;
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = '빼기';
    del.addEventListener('click', async () => {
      const { [name]: _gone, ...rest } = claudeSettings.mcpServers ?? {};
      await saveClaude({ mcpServers: rest });
      loadCapabilities(true);
    });
    row.append(label, del);
    list.append(row);
  }
}
$('mcp-connect').addEventListener('click', () => ($('mcp-connect-panel').hidden = !$('mcp-connect-panel').hidden));
$('mcp-open-connectors').addEventListener('click', () => window.promptBattle.openLink('connectors'));
$('mcp-open-servers').addEventListener('click', () => window.promptBattle.openLink('servers'));
$('mcp-add-kind').addEventListener('change', () => {
  $('mcp-add-value').placeholder = $('mcp-add-kind').value === 'url' ? 'https://example.com/mcp' : 'npx -y @modelcontextprotocol/server-filesystem .';
});
$('mcp-add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('mcp-add-name').value.trim();
  const res = await window.promptBattle.mcpParse(name, $('mcp-add-kind').value, $('mcp-add-value').value);
  $('mcp-add-error').hidden = !res.error;
  if (res.error) {
    $('mcp-add-error').textContent = res.error;
    return;
  }
  await saveClaude({ mcpServers: { ...(claudeSettings.mcpServers ?? {}), [name]: res.server } });
  $('mcp-add-name').value = '';
  $('mcp-add-value').value = '';
  loadCapabilities(true);
});

function renderClaudeSettings() {
  renderAuth();
  renderGameMcp();
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
// The question line of a quest, short, for the answer stack.
let questSummary = '';
function showQuest(el) {
  pendingQuest = null;
  const lines = el.textContent.split('\n').map((l) => l.trim()).filter(Boolean);
  const q = [...lines].reverse().find((l) => /[?？]$/.test(l)) ?? lines.at(-1) ?? '';
  questSummary = q.length > 80 ? `${q.slice(0, 79)}…` : q;
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
  // Whatever was in the prompt box isn't thrown away: back to the memo.
  const draft = promptInput.value.trim();
  if (draft && draft !== answer) keepInMemo(draft);
  answeringQuest = questSummary;
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
  useNextMemo();
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
// Records window: today's quest, lifetime stats, per-model win rate, achievements.
let achievementDefs = [];
let dailyQuestDefs = [];
const fmtNum = (n) => Number(n || 0).toLocaleString('ko-KR');
const fmtDuration = (ms) => {
  const s = Math.round((ms || 0) / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`;
};
async function renderDailyLine() {
  const daily = await window.promptBattle.getDaily();
  const quest = dailyQuestDefs.find((q) => q.id === daily.questId);
  $('daily-line').textContent = quest
    ? `📅 오늘의 퀘스트: ${quest.icon} ${quest.title} (${daily.progress}/${quest.target})${daily.done ? ' ✓ 완료' : ` · 보상 ${quest.coins} 코인`}`
    : '';
  return { daily, quest };
}
async function openRecords() {
  const { daily, quest } = await renderDailyLine();
  const r = profile?.records ?? {};
  $('records-daily').textContent = quest ? `${quest.icon} ${quest.title} — ${daily.progress}/${quest.target}${daily.done ? ' ✓ 완료!' : ` (보상 ${quest.coins} 코인)`}` : '';
  const stats = [
    ['모험 횟수', `${fmtNum(r.runs)}판`],
    ['공격 명령', `${fmtNum(r.turns)}번`],
    ['처리한 토큰', fmtNum(r.tokens)],
    ['최고 한 방', fmtNum(r.bestHit)],
    ['가장 긴 턴', fmtDuration(r.longestTurnMs)],
    ['크리티컬', `${fmtNum(r.crits)}번`],
    ['처치한 몬스터', `${fmtNum(r.floorsCleared)}마리`],
    ['처치한 보스', `${fmtNum(r.bossesDefeated)}마리`],
    ['테스트 통과', `${fmtNum(r.testsPassed)}번`],
    ['파일 수정', `${fmtNum(r.filesEdited)}번`],
    ['코딩 타자', `${fmtNum(r.typingLines)}줄`],
    ['홀짝 승리', `${fmtNum(r.betsWon)}번`],
    ['최고 무기 강화', `+${fmtNum(r.maxSwordLevel)}`],
  ];
  const grid = $('records-stats');
  grid.textContent = '';
  for (const [label, value] of stats) {
    const cell = document.createElement('div');
    const v = document.createElement('strong');
    v.textContent = value;
    const l = document.createElement('small');
    l.textContent = label;
    cell.append(v, l);
    grid.append(cell);
  }
  const models = $('records-models');
  models.textContent = '';
  const entries = Object.entries(r.byModel ?? {}).filter(([, m]) => m.engaged > 0);
  if (!entries.length) models.textContent = '아직 기록이 없어요. 한 판 싸우면 채워진다.';
  for (const [model, m] of entries.sort((a, b) => b[1].engaged - a[1].engaged)) {
    const known = weapons.find((w) => w.model === model);
    const row = document.createElement('div');
    row.className = 'model-row';
    const name = document.createElement('span');
    name.textContent = known ? classWeapon(model).name : model;
    name.title = model;
    const bar = document.createElement('div');
    bar.className = 'hp-bar-track xp';
    const fill = document.createElement('div');
    fill.className = 'xp-fill';
    const rate = m.cleared / m.engaged;
    fill.style.width = `${Math.round(rate * 100)}%`;
    bar.append(fill);
    const text = document.createElement('small');
    text.textContent = `${Math.round(rate * 100)}% (${m.cleared}/${m.engaged}층)`;
    row.append(name, bar, text);
    models.append(row);
  }
  const got = new Set(profile?.achievements ?? []);
  $('records-ach-count').textContent = `${got.size}/${achievementDefs.length}`;
  const ach = $('records-achievements');
  ach.textContent = '';
  for (const a of achievementDefs) {
    const card = document.createElement('div');
    card.className = `ach-card${got.has(a.id) ? ' got' : ''}`;
    const t = document.createElement('strong');
    t.textContent = `${got.has(a.id) ? a.icon : '🔒'} ${a.title}`;
    const d = document.createElement('small');
    d.textContent = `${a.description} · ${a.coins} 코인`;
    card.append(t, d);
    ach.append(card);
  }
  $('records-overlay').hidden = false;
}
$('records-btn').addEventListener('click', openRecords);
$('records-close').addEventListener('click', () => ($('records-overlay').hidden = true));
$('records-overlay').addEventListener('click', (e) => {
  if (e.target === $('records-overlay')) $('records-overlay').hidden = true;
});

// ---------------------------------------------------------------------------
// Bestiary: every monster as first met — art, name, HP, counterattack, boss
// rule — and how many you've defeated. Unmet ones are silhouettes.
let bestiaryDefs = [];
let bestiaryFilter = 'all'; // 'all' or a theme id
function openBestiary() {
  const tabs = $('bestiary-filter');
  tabs.textContent = '';
  for (const [id, label] of [['all', '전체'], ...THEMES.map((t) => [t.id, t.title])]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.classList.toggle('active', id === bestiaryFilter);
    b.addEventListener('click', () => {
      bestiaryFilter = id;
      openBestiary();
    });
    tabs.append(b);
  }
  const seen = new Set(profile?.records?.seen ?? []);
  const kills = profile?.records?.kills ?? {};
  $('bestiary-count').textContent = `발견 ${seen.size}/${bestiaryDefs.length} · 처치 ${Object.keys(kills).length}/${bestiaryDefs.length}`;
  const list = $('bestiary-list');
  list.textContent = '';
  // 전체: grouped by roster (area). A theme: its chapters in order.
  const theme = THEMES.find((t) => t.id === bestiaryFilter);
  const themeTitle = (id) => THEMES.find((t) => t.id === id)?.title ?? id;
  const groups = theme
    ? (ruleOf(theme.id)?.rosters ?? []).map((roster, i) => ({
        title: `챕터 ${i + 1} · ${chapterInfo(theme, i + 1).title}`,
        monsters: bestiaryDefs.filter((m) => m.roster === roster),
      }))
    : [...new Set(bestiaryDefs.map((m) => m.roster))].map((roster) => {
        const monsters = bestiaryDefs.filter((m) => m.roster === roster);
        const only = monsters[0]?.exclusiveTo;
        return { title: `${monsters[0]?.rosterName ?? ''}${only ? ` · ${themeTitle(only)} 전용` : ''}`, monsters };
      });
  for (const group of groups) {
    const h = document.createElement('h3');
    h.textContent = group.title;
    h.className = 'bestiary-chapter';
    list.append(h);
    for (const m of group.monsters) renderBestiaryCard(list, m, seen, kills, themeTitle);
  }
  list.hidden = false;
  $('bestiary-detail').hidden = true;
  $('bestiary-overlay').hidden = false;
}

function renderBestiaryCard(list, m, seen, kills, themeTitle) {
  const known = seen.has(m.index);
  const card = document.createElement('div');
  card.className = `bestiary-card${known ? '' : ' unknown'}${m.isBoss ? ' boss' : ''}`;
  const art = document.createElement('div');
  art.className = 'bestiary-art';
  art.innerHTML = monsterSvg(m.index, m.isBoss && known); // static, trusted markup
  const info = document.createElement('div');
  info.className = 'bestiary-info';
  const name = document.createElement('strong');
  name.textContent = known ? `${m.isBoss ? '👑 ' : ''}${m.name}` : '???';
  const stats = document.createElement('small');
  stats.textContent = known ? `❤️ HP ${m.maxHp} · 🗡 반격 ${m.counter}` : m.exclusiveTo ? `${themeTitle(m.exclusiveTo)}에서만 만날 수 있다는데...` : '어딘가에 산다는데...';
  info.append(name, stats);
  if (known && m.gimmick) {
    const rule = document.createElement('small');
    rule.className = 'bestiary-rule';
    rule.textContent = m.gimmick.text;
    info.append(rule);
  }
  const count = document.createElement('small');
  count.className = 'bestiary-kills';
  count.textContent = kills[m.index] ? `처치 ${kills[m.index]}회 · 눌러서 상세보기` : known ? '쓰러뜨리면 특성이 밝혀진다' : '';
  info.append(count);
  card.append(art, info);
  if (kills[m.index]) {
    card.classList.add('defeated');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.addEventListener('click', () => showMonsterDetail(m, kills[m.index]));
    card.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && showMonsterDetail(m, kills[m.index]));
  }
  list.append(card);
}

// Detail page of a defeated monster: its trait, personality and lines.
function showMonsterDetail(m, killCount) {
  const el = $('bestiary-detail');
  el.textContent = '';
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'bestiary-back';
  back.textContent = '← 도감으로';
  back.addEventListener('click', () => {
    el.hidden = true;
    $('bestiary-list').hidden = false;
  });
  const top = document.createElement('div');
  top.className = 'detail-top';
  const art = document.createElement('div');
  art.innerHTML = monsterSvg(m.index, m.isBoss); // static, trusted markup
  const head = document.createElement('div');
  const name = document.createElement('h3');
  name.textContent = `${m.isBoss ? '👑 ' : ''}${m.name}`;
  const where = document.createElement('p');
  where.className = 'option-sub';
  const places = m.appearances.map((a) => `${THEMES.find((t) => t.id === a.themeId)?.title ?? a.themeId} 챕터 ${a.chapter}`).join(' · ');
  where.textContent = `${m.rosterName}${m.exclusiveTo ? ' (전용)' : ''} · ${places}${m.isBoss ? ' · 보스' : ''} · 처치 ${killCount}회`;
  const stats = document.createElement('p');
  stats.textContent = `❤️ HP ${m.maxHp}   🗡 반격 ${m.counter}`;
  head.append(name, where, stats);
  top.append(art, head);
  const section = (title, text, cls) => {
    const box = document.createElement('div');
    box.className = `detail-box${cls ? ` ${cls}` : ''}`;
    const t = document.createElement('strong');
    t.textContent = title;
    const p = document.createElement('p');
    p.textContent = text;
    box.append(t, p);
    return box;
  };
  el.append(back, top, section(`특성 — ${m.trait.name}`, m.trait.text, 'trait'));
  if (m.gimmick) el.append(section('보스 규칙', m.gimmick.text, 'rule'));
  if (m.awakening) el.append(section(`2페이즈 — ${m.awakening.name}`, `HP가 절반 아래로 떨어지면 각성: ${m.awakening.text}`, 'rule'));
  el.append(section('성격', MONSTER_LORE[m.index] ?? ''));
  const lines = MONSTER_LINES[m.index];
  if (lines) el.append(section('자주 하는 말', [lines.appear[0], ...lines.idle.slice(0, 2)].map((l) => `“${l}”`).join('\n'), 'quotes'));
  $('bestiary-list').hidden = true;
  el.hidden = false;
}
$('bestiary-btn').addEventListener('click', openBestiary);
$('bestiary-close').addEventListener('click', () => ($('bestiary-overlay').hidden = true));
$('bestiary-overlay').addEventListener('click', (e) => {
  if (e.target === $('bestiary-overlay')) $('bestiary-overlay').hidden = true;
});

// ---------------------------------------------------------------------------
// Theme and difficulty details on the start screen (shown for the pick).
let themeRuleDefs = [];
let difficultyMult = { easy: 0.7, normal: 1, hard: 1.4 };
let difficultyReward = { easy: 0.7, normal: 1, hard: 1.5 };
const ruleOf = (id) => themeRuleDefs.find((t) => t.id === id);
const stars = (n) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));
function renderThemeInfo() {
  const el = $('theme-info');
  const theme = THEMES.find((t) => t.id === chosenThemeId);
  const rules = ruleOf(chosenThemeId);
  el.textContent = '';
  if (!theme || !rules) return;
  const intro = document.createElement('p');
  intro.className = 'choice-info-intro';
  intro.textContent = `${theme.chapters[0]?.intro ?? ''} (챕터 ${theme.chapters.length}개 · 난이도 ${stars(rules.stars)})`;
  const list = document.createElement('ul');
  for (const perk of rules.perks) {
    const li = document.createElement('li');
    li.textContent = perk;
    list.append(li);
  }
  el.append(intro, list);
}
const DIFFICULTY_TEXT = {
  easy: '처음이라면. 반격도 약해진다.',
  normal: '기본 밸런스.',
  hard: '반격도 세지지만 그만큼 더 번다.',
};
function renderDifficultyInfo() {
  const d = document.querySelector('input[name="difficulty"]:checked')?.value ?? 'normal';
  $('difficulty-info').textContent = `몬스터 HP x${difficultyMult[d]} · 코인·경험치 x${difficultyReward[d]} · ${DIFFICULTY_TEXT[d]}`;
}
for (const r of document.querySelectorAll('input[name="difficulty"]')) r.addEventListener('change', renderDifficultyInfo);

// ---------------------------------------------------------------------------
// Treasure chest: once the monster falls mid-turn, the rest of the damage
// fills a chest; the bar shows progress to the next grade.
let chestGrades = [];
// Grades are shares of the fallen monster's max HP (g.min is a percentage).
const chest = { active: false, opened: false, total: 0, maxHp: 1 };
const chestPct = () => (chest.total / Math.max(1, chest.maxHp)) * 100;
function gradeFor() {
  const pct = chestPct();
  return [...chestGrades].reverse().find((g) => pct >= g.min) ?? chestGrades[0];
}
function renderChest(open, gradeId) {
  const grade = gradeId ? chestGrades.find((g) => g.id === gradeId) : gradeFor();
  if (!grade) return;
  const next = chestGrades[chestGrades.indexOf(grade) + 1];
  monsterArtEl.innerHTML = chestSvg(grade.id, open);
  monsterNameEl.textContent = open ? `🎁 ${grade.name}` : `보물상자 — ${grade.name}`;
  const pct = chestPct();
  hpBarFillEl.style.width = `${next ? Math.min(100, Math.max(0, ((pct - grade.min) / (next.min - grade.min)) * 100)) : 100}%`;
  hpBarFillEl.classList.add('chest-fill');
  const toNext = next ? Math.max(1, Math.ceil((next.min / 100) * chest.maxHp - chest.total)) : 0;
  hpLabelEl.textContent = open
    ? `넘친 피해 ${chest.total} (몬스터 HP의 ${Math.round(pct)}%) · ${grade.name} 개봉!`
    : `넘친 피해 ${chest.total} (${Math.round(pct)}%)${next ? ` · 다음 ${next.name}까지 ${toNext}` : ' · 최고 등급!'}`;
}

// ---------------------------------------------------------------------------
// "AI is done" notification (settings: 사운드·알림 tab), only when the
// window isn't in front — clicking it brings the game back.
const NOTIFY_KEY = 'pb-notify';
let notifyOn = true;
try {
  notifyOn = localStorage.getItem(NOTIFY_KEY) !== 'off';
} catch {}
$('notify-toggle').checked = notifyOn;
$('notify-toggle').addEventListener('change', () => {
  notifyOn = $('notify-toggle').checked;
  try {
    localStorage.setItem(NOTIFY_KEY, notifyOn ? 'on' : 'off');
  } catch {}
});
function notifyTurnDone(body) {
  if (!notifyOn || document.hasFocus()) return;
  window.promptBattle.notify('프롬프트 배틀', body);
}

// ---------------------------------------------------------------------------
// The hero's contract (god or demon), shown next to the HP in battle.
let pacts = { god: [], demon: [] };
let heroContract = null;
const pactInfo = (c) => (c ? pacts[c.kind]?.find((p) => p.id === c.id) : undefined);
function renderContract() {
  const el = $('contract-badge');
  const pact = pactInfo(heroContract);
  el.hidden = !pact;
  if (!pact) return;
  const god = heroContract.kind === 'god';
  el.className = `contract-badge ${heroContract.kind}`;
  el.textContent = `${god ? '🤝' : '💀'} ${pact.name}`;
  el.tabIndex = 0; // hover or focus shows the card
  // Hover card: what the pact does (and cost), and the one-pact rule.
  const tip = document.createElement('div');
  tip.className = 'contract-tip';
  tip.setAttribute('role', 'tooltip');
  const head = document.createElement('strong');
  head.textContent = `${god ? '원소신의 계약' : '악마의 계약'} — ${pact.name}`;
  const list = document.createElement('ul');
  const effects = [...(god ? ['모든 타격 +5%'] : []), ...pact.text.split(/,\s*/)];
  if (!god && pact.hpCost) effects.push(`서명할 때 최대 HP의 ${Math.round(pact.hpCost * 100)}%를 바쳤다`);
  for (const e of effects) {
    const li = document.createElement('li');
    li.textContent = e;
    list.append(li);
  }
  const rule = document.createElement('small');
  rule.textContent = '계약은 하나만. 또 계약서를 쓰면 모든 계약이 깨지고 최대 HP가 영구히 -10.';
  tip.append(head, list, rule);
  el.append(tip);
}

// ---------------------------------------------------------------------------
// Online ranking: submit a defeated run from the summary; view the top 100.
const RANK_NAME_KEY = 'pb-rank-name';
function renderRankingCard(ranking) {
  const card = $('summary-ranking');
  card.hidden = !ranking;
  if (!ranking) return;
  $('summary-rank-score').textContent = `이번 판 점수 ${fmtNum(ranking.score)}`;
  $('rank-result').textContent = ranking.submittable ? '' : ranking.reason;
  $('rank-form').hidden = !ranking.submittable;
  $('rank-submit').disabled = false;
  try {
    $('rank-name').value = localStorage.getItem(RANK_NAME_KEY) ?? '';
  } catch {}
}
$('rank-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('rank-name').value.trim();
  if (!name) return;
  try {
    localStorage.setItem(RANK_NAME_KEY, name);
  } catch {}
  $('rank-submit').disabled = true;
  $('rank-result').textContent = '등록 중...';
  const result = await window.promptBattle.rankingSubmit(name);
  if (result.error) {
    $('rank-result').textContent = result.error;
    $('rank-submit').disabled = false;
    return;
  }
  $('rank-form').hidden = true;
  const places = [
    result.dailyRank ? `오늘의 도전 ${result.dailyRank}위` : '',
    result.rank ? `전체 ${result.rank}위` : '',
    result.weeklyRank ? `이번 주 ${result.weeklyRank}위` : '',
  ].filter(Boolean);
  $('rank-result').textContent = places.length ? `🏆 ${places.join(' · ')}로 등록됐다! (${fmtNum(result.score)}점)` : `등록했지만 상위 100위 밖이다 (${fmtNum(result.score)}점)`;
  sfx(result.rank && result.rank <= 10 ? 'fanfare' : 'coin');
});

const CLASS_NAME = { swordsman: '검사', wizard: '마법사', archer: '궁수' };
let rankingBoard = 'all';
let rankingEntries = [];
async function openRanking() {
  $('ranking-overlay').hidden = false;
  const themeSel = $('ranking-theme');
  if (themeSel.options.length === 1) {
    for (const t of THEMES) themeSel.append(new Option(t.title, t.id));
  }
  for (const tab of document.querySelectorAll('.ranking-tab')) tab.classList.toggle('active', tab.dataset.board === rankingBoard);
  $('ranking-table').textContent = '';
  $('ranking-status').textContent = '불러오는 중...';
  const board = rankingBoard;
  const res = await window.promptBattle.rankingList(board);
  if (board !== rankingBoard) return; // switched tabs meanwhile
  if (res.error) {
    $('ranking-status').textContent = res.error;
    return;
  }
  rankingEntries = res.entries;
  renderRankingTable();
}
// Theme / difficulty filters work on the board's top 100 (ranks stay the board's).
function renderRankingTable() {
  const table = $('ranking-table');
  table.textContent = '';
  const theme = $('ranking-theme').value;
  const difficulty = $('ranking-difficulty').value;
  const shown = rankingEntries.filter((e) => (!theme || e.theme === theme) && (!difficulty || e.difficulty === difficulty));
  const empty = rankingBoard === 'daily' ? '오늘의 도전 기록이 아직 없다. 첫 번째가 되어 보자!' : '아직 기록이 없다. 첫 번째가 되어 보자!';
  $('ranking-status').textContent = shown.length ? '' : rankingEntries.length ? '조건에 맞는 기록이 없다' : empty;
  if (!shown.length) return;
  const head = document.createElement('tr');
  for (const h of ['순위', '이름', '칭호', '점수', '직업', '테마', '도달', '난이도', '날짜']) {
    const th = document.createElement('th');
    th.textContent = h;
    head.append(th);
  }
  table.append(head);
  for (const e of shown) {
    const tr = document.createElement('tr');
    if (e.rank <= 3) tr.className = `top${e.rank}`;
    const stars = e.prestige ? `${'★'.repeat(Math.min(e.prestige, 5))}${e.prestige > 5 ? `×${e.prestige}` : ''} ` : '';
    const cells = [
      e.rank <= 3 ? ['1위', '2위', '3위'][e.rank - 1] : String(e.rank),
      e.name ?? '',
      `${stars}${titleOf(e.level ?? 1)}`,
      fmtNum(e.score),
      CLASS_NAME[e.heroClass] ?? '',
      THEMES.find((t) => t.id === e.theme)?.title ?? '',
      `${Math.floor((e.floors ?? 0) / 6) + 1}챕터 ${((e.floors ?? 0) % 6) + 1}층`,
      DIFFICULTY_LABEL[e.difficulty] ?? '',
      e.at ? new Date(e.at).toLocaleDateString('ko-KR') : '',
    ];
    for (const c of cells) {
      const td = document.createElement('td');
      td.textContent = c;
      tr.append(td);
    }
    table.append(tr);
  }
}
for (const tab of document.querySelectorAll('.ranking-tab')) {
  tab.addEventListener('click', () => {
    rankingBoard = tab.dataset.board;
    openRanking();
  });
}
$('ranking-theme').addEventListener('change', renderRankingTable);
$('ranking-difficulty').addEventListener('change', renderRankingTable);
$('ranking-btn').addEventListener('click', openRanking);
$('ranking-close').addEventListener('click', () => ($('ranking-overlay').hidden = true));
$('ranking-overlay').addEventListener('click', (e) => {
  if (e.target === $('ranking-overlay')) $('ranking-overlay').hidden = true;
});

// ---------------------------------------------------------------------------
// Switch the project folder mid-run (not while the AI works): the file tree
// follows, and Claude continues in a fresh session for the new folder.
function renderFolderLabel() {
  const el = $('inventory-folder-name');
  el.textContent = chosenFolder ? `📁 ${baseName(chosenFolder)}` : '';
  el.title = chosenFolder ?? '';
}
$('change-folder').addEventListener('click', async () => {
  const res = await window.promptBattle.changeFolder();
  if (!res) return;
  if (res.error) {
    appendLog(`📁 ${res.error}`, 'error');
    return;
  }
  chosenFolder = res.folder;
  folderPathEl.textContent = res.folder;
  touchedFiles.clear();
  renderFolderLabel();
  refreshTree();
  appendLog(`📁 작업 폴더를 바꿨다: ${res.folder} — 여기서부터 새 Claude 세션으로 이어간다.`, 'story-line');
  window.promptBattle.submitPrompt('/new');
});

// ---------------------------------------------------------------------------
// Attachments for the next prompt: 📎, drag & drop onto the input, or paste
// an image. Main keeps the files; the next AI turn sends and clears them.
let attachedNow = [];
const KIND_ICON = { image: '🖼', pdf: '📄', text: '📝' };
function renderAttachments(list) {
  attachedNow = list;
  const box = $('attachments');
  box.textContent = '';
  box.hidden = !list.length;
  for (const a of list) {
    const chip = document.createElement('span');
    chip.className = 'attachment-chip';
    chip.textContent = `${KIND_ICON[a.kind] ?? '📎'} ${a.name}`;
    chip.title = `${a.name} · ${Math.max(1, Math.round(a.size / 1024))}KB`;
    const x = document.createElement('button');
    x.type = 'button';
    x.textContent = '✕';
    x.setAttribute('aria-label', `${a.name} 빼기`);
    x.addEventListener('click', async () => applyAttachResult(await window.promptBattle.attachRemove(a.id)));
    chip.append(x);
    box.append(chip);
  }
}
function applyAttachResult(res) {
  renderAttachments(res.list);
  for (const e of res.errors) appendLog(`📎 ${e}`, 'error');
}
$('attach-btn').addEventListener('click', async () => applyAttachResult(await window.promptBattle.attachPick()));
for (const el of [promptInput, attackForm]) {
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    attackForm.classList.add('drop-target');
  });
  el.addEventListener('dragleave', () => attackForm.classList.remove('drop-target'));
  el.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    attackForm.classList.remove('drop-target');
    const paths = [...(e.dataTransfer?.files ?? [])].map((f) => window.promptBattle.pathForFile(f)).filter(Boolean);
    if (paths.length) applyAttachResult(await window.promptBattle.attachPaths(paths));
  });
}
let pastedCount = 0;
promptInput.addEventListener('paste', async (e) => {
  const images = [...(e.clipboardData?.items ?? [])].filter((i) => i.type.startsWith('image/'));
  if (!images.length) return;
  e.preventDefault();
  for (const item of images) {
    const blob = item.getAsFile();
    if (!blob) continue;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const ext = item.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
    applyAttachResult(await window.promptBattle.attachData(`붙여넣은 이미지 ${++pastedCount}.${ext}`, btoa(binary)));
  }
});

// ---------------------------------------------------------------------------
// Next-prompt memo: jot down the next command while the AI works; when the
// turn ends it moves into the (empty) prompt box. Kept across restarts.
const MEMO_KEY = 'pb-next-memo';
const memoEl = $('next-memo');
try {
  memoEl.value = localStorage.getItem(MEMO_KEY) ?? '';
} catch {}
memoEl.addEventListener('input', () => {
  try {
    localStorage.setItem(MEMO_KEY, memoEl.value);
  } catch {}
});
function keepInMemo(text) {
  memoEl.value = memoEl.value.trim() ? `${memoEl.value.trim()}\n${text}` : text;
  try {
    localStorage.setItem(MEMO_KEY, memoEl.value);
  } catch {}
}
function useNextMemo() {
  const memo = memoEl.value.trim();
  if (!memo || promptInput.value.trim()) return;
  promptInput.value = memo;
  promptInput.dispatchEvent(new Event('input')); // grow the textarea
  memoEl.value = '';
  try {
    localStorage.removeItem(MEMO_KEY);
  } catch {}
  appendLog('📝 메모해 둔 다음 명령을 입력창에 넣었다. Enter로 바로 공격!', 'story-line');
  promptInput.focus();
}

// ---------------------------------------------------------------------------
// 스킬북: Claude Code skills as files (project .claude/skills/<name>/SKILL.md,
// plus the user's ~/.claude/skills). 불러오기 puts /<name> in front of the prompt.
async function openSkillbook() {
  $('skillbook-overlay').hidden = false;
  $('skill-form').hidden = true;
  $('skill-new').hidden = false;
  const list = $('skillbook-list');
  list.textContent = '불러오는 중...';
  const skills = await window.promptBattle.skillsList();
  list.textContent = '';
  if (!skills.length) {
    list.textContent = '아직 스킬이 없다. 자주 쓰는 지시를 스킬로 만들어 두면 /이름 으로 바로 쓴다.';
    return;
  }
  for (const skill of skills) {
    const card = document.createElement('div');
    card.className = 'skill-card';
    const head = document.createElement('div');
    head.className = 'skill-head';
    const title = document.createElement('strong');
    title.textContent = `/${skill.name}`;
    const scope = document.createElement('span');
    scope.className = 'option-sub';
    scope.textContent = skill.scope === 'project' ? '이 프로젝트' : '내 전체 (~/.claude)';
    head.append(title, scope);
    const desc = document.createElement('p');
    desc.textContent = skill.description || '(설명 없음)';
    const actions = document.createElement('div');
    actions.className = 'skill-actions';
    const load = document.createElement('button');
    load.type = 'button';
    load.textContent = '불러오기';
    load.addEventListener('click', () => {
      const rest = promptInput.value.replace(/^\/[a-z0-9-]+\s*/, '');
      promptInput.value = `/${skill.name} ${rest}`;
      $('skillbook-overlay').hidden = true;
      promptInput.focus();
      autoGrowInput();
    });
    actions.append(load);
    if (skill.scope === 'project') {
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = '편집';
      edit.addEventListener('click', () => openSkillForm(skill));
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = '삭제';
      del.addEventListener('click', async () => {
        if (!confirm(`/${skill.name} 스킬을 삭제할까요? (.claude/skills/${skill.name}/SKILL.md)`)) return;
        const res = await window.promptBattle.skillDelete(skill.name);
        if (res.error) return alert(res.error);
        openSkillbook();
      });
      actions.append(edit, del);
    }
    card.append(head, desc, actions);
    list.append(card);
  }
}
function openSkillForm(skill) {
  $('skill-form').hidden = false;
  $('skill-new').hidden = true;
  $('skill-error').hidden = true;
  $('skill-name').value = skill?.name ?? '';
  $('skill-name').readOnly = Boolean(skill);
  $('skill-description').value = skill?.description ?? '';
  $('skill-body').value = skill?.body ?? promptInput.value.trim();
  (skill ? $('skill-body') : $('skill-name')).focus();
}
$('skillbook-btn').addEventListener('click', openSkillbook);
$('skillbook-close').addEventListener('click', () => ($('skillbook-overlay').hidden = true));
$('skillbook-overlay').addEventListener('click', (e) => {
  if (e.target === $('skillbook-overlay')) $('skillbook-overlay').hidden = true;
});
$('skill-new').addEventListener('click', () => openSkillForm(null));
$('skill-cancel').addEventListener('click', () => {
  $('skill-form').hidden = true;
  $('skill-new').hidden = false;
});
$('skill-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await window.promptBattle.skillSave({ name: $('skill-name').value, description: $('skill-description').value, body: $('skill-body').value });
  if (res.error) {
    $('skill-error').textContent = res.error;
    $('skill-error').hidden = false;
    return;
  }
  openSkillbook();
});
