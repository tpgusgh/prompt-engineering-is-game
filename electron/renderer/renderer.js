// electron/renderer/renderer.js
import { marked } from '../../node_modules/marked/lib/marked.esm.js';
import { monsterSvg } from './monster-art.js';

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
let profile = null;
let chosenFolder = null;
let chosenThemeId = THEMES[0].id;
let chosenWeapon = 'claude-sonnet-5';
let activeTheme = THEMES[0];
let currentMonsterName = '';
let lastSummary = '';
const touchedFiles = new Set();

function weaponLabel(w) {
  return `${w.name} — ${w.flavor} (x${w.multiplier})`;
}

function refreshContinueOption() {
  const cleared = profile?.storyChapters?.[chosenThemeId] ?? 0;
  const theme = THEMES.find((t) => t.id === chosenThemeId);
  if (cleared > 0 && theme) {
    continueLabel.hidden = false;
    continueText.textContent = `이어하기: 챕터 ${cleared + 1} "${chapterInfo(theme, cleared + 1).title}"부터`;
  } else {
    continueLabel.hidden = true;
  }
}

async function loadSetup() {
  const info = await window.promptBattle.getSetupInfo();
  profile = info.profile;
  weapons = info.weapons;
  profileLineEl.textContent = `레벨 ${profile.level} 용사 · 총 ${profile.xp} XP · ${profile.totalWins}승`;

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
    const cleared = profile.storyChapters?.[theme.id] ?? 0;
    if (cleared > 0) {
      const sub = document.createElement('span');
      sub.className = 'option-sub';
      sub.textContent = `(챕터 ${cleared}까지 클리어)`;
      label.append(sub);
    }
    themeOptionsEl.append(label);
  }

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
    option.textContent = `${w.name} (x${w.multiplier})`;
    weaponSelect.append(option);
  }
  refreshContinueOption();
}
loadSetup();

// A turn can take a while (real file/bash work). Without this, a click while
// one is in flight is silently dropped by main.ts (no pending resolver yet).
function setInputEnabled(enabled) {
  promptInput.disabled = !enabled;
  attackSubmitBtn.disabled = !enabled;
  fleeBtn.disabled = !enabled;
}

// A turn emits several hpChanged events (one per partial hit, plus one at
// the end), so hpChanged can't mean "turn over" — only these events do.
function turnConcluded() {
  setInputEnabled(true);
  turnStatusEl.hidden = true;
  refreshTree();
}

pickFolderBtn.addEventListener('click', async () => {
  const folder = await window.promptBattle.pickFolder();
  if (folder) {
    chosenFolder = folder;
    folderPathEl.textContent = folder;
    startBtn.disabled = false;
  }
});

function appendLog(text, className) {
  const line = document.createElement('div');
  if (className) line.className = className;
  line.textContent = text;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
  return line;
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

const ATTACK_TEMPLATES = [
  (dmg, w) => `${w}을(를) 휘둘러 ${dmg}의 피해를 입혔다!`,
  (dmg) => `마법을 시전해 ${dmg}의 피해를 입혔다!`,
  (dmg) => `강력한 일격으로 ${dmg}의 피해를 입혔다!`,
  (dmg, w) => `${w}(으)로 ${dmg}만큼 베어버렸다!`,
  (dmg) => `빈틈을 파고들어 ${dmg}의 피해를 입혔다!`,
];
const DODGE_LINES = ['몬스터가 마지막 일격을 회피했다!', '몬스터가 몸을 비틀어 공격을 피했다!', '아슬아슬하게 빗나갔다... 몬스터가 회피했다!'];
const COUNTER_LINES = ['의 반격!', '이(가) 달려든다!', '의 날카로운 공격!'];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const weaponName = () => weapons.find((w) => w.model === weaponSelect.value)?.name ?? '검';

// Renders the AI's markdown reply properly (headers/bold/lists). If it ends
// with a question followed by a list, the list items become clickable
// choices that fill the input.
function renderMarkdownLog(text) {
  const wrapper = document.createElement('div');
  wrapper.className = 'markdown';
  wrapper.innerHTML = marked.parse(text);
  logEl.appendChild(wrapper);

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
          promptInput.focus();
        });
        buttonRow.appendChild(btn);
      }
      logEl.appendChild(buttonRow);
    }
  }
  logEl.scrollTop = logEl.scrollHeight;
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

function renderTreeNodes(nodes) {
  const ul = document.createElement('ul');
  for (const node of nodes) {
    const li = document.createElement('li');
    const item = document.createElement('div');
    item.className = `tree-item ${node.type}`;
    item.textContent = node.name;
    item.title = node.path;
    li.append(item);
    if (node.type === 'dir') {
      const childList = renderTreeNodes(node.children ?? []);
      const setOpen = (open) => {
        item.classList.toggle('open', open);
        childList.hidden = !open;
      };
      setOpen(openDirs.has(node.path));
      item.addEventListener('click', () => {
        const open = !openDirs.has(node.path);
        if (open) openDirs.add(node.path);
        else openDirs.delete(node.path);
        setOpen(open);
      });
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
  const tree = await window.promptBattle.listTree();
  fileTreeEl.textContent = '';
  if (!tree) return;
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
  appendLog(`무기를 바꿨다: ${w.name} — ${w.flavor} (x${w.multiplier})`, 'story-line');
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
      turnStatusEl.hidden = false;
      turnStatusEl.textContent = `AI가 ${weaponName()}을(를) 들고 작업 중...`;
      break;
    case 'partialHit':
      appendLog(`  » ${event.damage}의 피해!`, 'partial-hit');
      flashMonster();
      break;
    case 'agentEvent': {
      const isFile = event.agentEvent.type === 'file';
      const line = appendLog(isFile ? `→ 수정 중: ${event.agentEvent.value}` : `→ 실행 중: ${event.agentEvent.value}`, event.agentEvent.type);
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
        appendLog(`${pick(ATTACK_TEMPLATES)(event.damage, weaponName())}${label}`, event.crit ? 'crit' : undefined);
        flashMonster();
      }
      if (event.matchedKeywords.length > 0) appendLog(`(키워드: ${event.matchedKeywords.join(', ')})`);
      turnConcluded();
      break;
    }
    case 'agentSummary':
      lastSummary = event.summary;
      renderMarkdownLog(event.summary);
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
      sessionBanner.hidden = true;
      appendLog('새로운 세션이 시작되었다.', 'story-line');
      break;
    case 'sessionNearlyFull':
      sessionBannerText.textContent = `세션이 ${Math.round((event.usedTokens / event.contextWindow) * 100)}% 찼습니다. 아래 프롬프트를 쳐서 새로운 세션으로 이어가세요.`;
      sessionBannerPrompt.textContent = continuationPrompt();
      sessionBanner.hidden = false;
      break;
    case 'runEnded':
      break;
  }
}

window.promptBattle.onBattleEvent(renderBattleEvent);

startBtn.addEventListener('click', async () => {
  if (!chosenFolder) return;
  const difficulty = document.querySelector('input[name="difficulty"]:checked').value;
  activeTheme = THEMES.find((t) => t.id === chosenThemeId) || THEMES[0];
  const cleared = profile?.storyChapters?.[activeTheme.id] ?? 0;
  const startFloor = cleared > 0 && continueCheckbox.checked ? cleared * 6 : 0;
  weaponSelect.value = chosenWeapon;
  touchedFiles.clear();
  lastSummary = '';
  sessionBanner.hidden = true;
  setupErrorEl.hidden = true;
  setupScreen.hidden = true;
  dungeonScreen.hidden = false;
  logEl.textContent = '';
  setInputEnabled(true);
  try {
    const runPromise = window.promptBattle.startRun({ cwd: chosenFolder, difficulty, model: chosenWeapon, themeId: activeTheme.id, startFloor });
    setTimeout(refreshTree, 300);
    const { summary, profile: updated } = await runPromise;
    profile = updated;
    dungeonScreen.hidden = true;
    summaryScreen.hidden = false;
    summaryTitleEl.textContent = summary.defeated ? '패배...' : '런 종료';
    summaryTextEl.textContent = `${summary.floorsCleared}층 클리어, +${summary.xpGained} XP 획득. 현재 레벨 ${updated.level} (총 ${updated.xp} XP).`;
    const nextChapter = summary.chaptersCleared + 1;
    summaryStoryEl.textContent =
      summary.chaptersCleared > 0
        ? `${activeTheme.title}: 챕터 ${summary.chaptersCleared}까지 클리어. 다음엔 챕터 ${nextChapter} "${chapterInfo(activeTheme, nextChapter).title}"부터 이어할 수 있다.`
        : '';
  } catch (err) {
    // An unexpected main-process error (agent-turn errors never reject this
    // call). Without this, the player would be stuck on the dungeon screen.
    dungeonScreen.hidden = true;
    setupScreen.hidden = false;
    setupErrorEl.textContent = `문제가 발생했습니다: ${err && err.message ? err.message : String(err)}`;
    setupErrorEl.hidden = false;
  }
});

attackForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = promptInput.value;
  promptInput.value = '';
  // A bare "/new" only resets the session — no turn follows, so nothing
  // would ever re-enable the input if it were disabled here.
  if (text.trim() !== '/new') setInputEnabled(false);
  window.promptBattle.submitPrompt(text);
});

fleeBtn.addEventListener('click', () => {
  setInputEnabled(false);
  window.promptBattle.flee();
});

playAgainBtn.addEventListener('click', async () => {
  summaryScreen.hidden = true;
  setupScreen.hidden = false;
  await loadSetup();
});
