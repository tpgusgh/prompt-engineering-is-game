// electron/renderer/renderer.js
import { marked } from '../../node_modules/marked/lib/marked.esm.js';

const setupScreen = document.getElementById('setup-screen');
const dungeonScreen = document.getElementById('dungeon-screen');
const summaryScreen = document.getElementById('summary-screen');
const pickFolderBtn = document.getElementById('pick-folder-btn');
const folderPathEl = document.getElementById('folder-path');
const startBtn = document.getElementById('start-btn');
const monsterPanel = document.getElementById('monster-panel');
const monsterNameEl = document.getElementById('monster-name');
const monsterArtEl = document.getElementById('monster-art');
const hpBarFillEl = document.getElementById('hp-bar-fill');
const hpLabelEl = document.getElementById('hp-label');
const turnStatusEl = document.getElementById('turn-status');
const logEl = document.getElementById('log');
const attackForm = document.getElementById('attack-form');
const promptInput = document.getElementById('prompt-input');
const fleeBtn = document.getElementById('flee-btn');
const summaryTextEl = document.getElementById('summary-text');
const playAgainBtn = document.getElementById('play-again-btn');
const setupErrorEl = document.getElementById('setup-error');
const attackSubmitBtn = attackForm.querySelector('button[type="submit"]');
const fileViewerOverlay = document.getElementById('file-viewer-overlay');
const fileViewerTitleEl = document.getElementById('file-viewer-title');
const fileViewerBodyEl = document.getElementById('file-viewer-body');
const fileViewerCloseBtn = document.getElementById('file-viewer-close');
const themeOptionsEl = document.getElementById('theme-options');

// Pure flavor: sets the opening log line for the run. No mechanical effect
// on difficulty/monsters/damage — just frames why you're here.
const THEMES = [
  { id: 'adventure', title: '모험을 떠나기', intro: '전설의 모험가가 되어, 미지의 던전에 첫 발을 내딛는다...' },
  { id: 'demon-king', title: '마왕 잡으러 가기', intro: '세상을 위협하는 마왕을 물리치기 위해 검을 뽑아 든다...' },
  { id: 'debug-quest', title: '버그 소탕전', intro: '코드 속 깊은 곳에 숨은 버그들을 소탕하러 던전에 들어선다...' },
];
let chosenThemeId = THEMES[0].id;
for (const theme of THEMES) {
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = 'theme';
  input.value = theme.id;
  if (theme.id === chosenThemeId) input.checked = true;
  input.addEventListener('change', () => {
    chosenThemeId = theme.id;
  });
  label.appendChild(input);
  label.appendChild(document.createTextNode(` ${theme.title}`));
  themeOptionsEl.appendChild(label);
}

let chosenFolder = null;

// A turn can take a while (real file/bash work). Without this, a click while
// one is in flight is silently dropped by main.ts (no pending resolver yet),
// and Flee does nothing — with no feedback either way.
function setInputEnabled(enabled) {
  promptInput.disabled = !enabled;
  attackSubmitBtn.disabled = !enabled;
  fleeBtn.disabled = !enabled;
}

// A turn now emits several hpChanged events (one per partial hit, plus one
// at the end) instead of exactly one — so hpChanged itself can no longer be
// "the turn is over" signal. Only these three mark a turn's actual end.
function turnConcluded() {
  setInputEnabled(true);
  turnStatusEl.hidden = true;
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

function setHpBar(hp, maxHp) {
  const safeMax = Math.max(1, maxHp);
  const ratio = Math.max(0, Math.min(hp, safeMax)) / safeMax;
  hpBarFillEl.style.width = `${ratio * 100}%`;
  hpBarFillEl.classList.toggle('warn', ratio <= 0.5 && ratio > 0.2);
  hpBarFillEl.classList.toggle('danger', ratio <= 0.2);
  hpLabelEl.textContent = `${Math.max(0, hp)} / ${safeMax} HP`;
}

function flashMonster() {
  monsterPanel.classList.add('hit-flash');
  setTimeout(() => monsterPanel.classList.remove('hit-flash'), 150);
}

const ATTACK_TEMPLATES = [
  (dmg) => `칼을 휘둘러 ${dmg}의 피해를 입혔다!`,
  (dmg) => `마법을 시전해 ${dmg}의 피해를 입혔다!`,
  (dmg) => `강력한 일격으로 ${dmg}의 피해를 입혔다!`,
  (dmg) => `${dmg}만큼 베어버렸다!`,
  (dmg) => `화살을 날려 ${dmg}의 피해를 입혔다!`,
];
function randomAttackLine(dmg) {
  return ATTACK_TEMPLATES[Math.floor(Math.random() * ATTACK_TEMPLATES.length)](dmg);
}

// Renders the AI's markdown reply properly (headers/bold/lists) instead of
// showing the raw ** and # characters as plain text. If it ends with a
// question followed by a list, the list becomes clickable choices that fill
// the input, instead of the player having to retype an option by hand.
function renderMarkdownLog(text) {
  const wrapper = document.createElement('div');
  wrapper.className = 'markdown';
  wrapper.innerHTML = marked.parse(text);
  logEl.appendChild(wrapper);

  const children = Array.from(wrapper.children);
  const lastList = children[children.length - 1];
  if (lastList && (lastList.tagName === 'UL' || lastList.tagName === 'OL')) {
    const priorText = children[children.length - 2];
    const endsWithQuestion = priorText && /[?？]\s*$/.test(priorText.textContent.trim());
    if (endsWithQuestion) {
      const items = Array.from(lastList.querySelectorAll('li')).map((li) => li.textContent.trim());
      const buttonRow = document.createElement('div');
      buttonRow.className = 'choice-buttons';
      for (const item of items) {
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

// Fetches the real OS icon for a touched file (never its content — see
// openFileViewer for that) and animates it flying from the input toward the
// monster, so a file edit reads as "you hit the monster with that file".
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
    const deltaX = targetRect.left + targetRect.width / 2 - (startRect.left + startRect.width / 2);
    const deltaY = targetRect.top + targetRect.height / 2 - startRect.top;
    img.style.setProperty('--fly-x', `${deltaX}px`);
    img.style.setProperty('--fly-y', `${deltaY}px`);
    requestAnimationFrame(() => img.classList.add('thrown'));
    img.addEventListener('transitionend', () => img.remove());
  });
}

function openFileViewer(filePath) {
  fileViewerTitleEl.textContent = filePath;
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
    const pre = document.createElement('pre');
    pre.textContent = result.content + (result.truncated ? '\n\n… (내용이 길어 일부만 표시)' : '');
    fileViewerBodyEl.appendChild(pre);
  });
}

fileViewerCloseBtn.addEventListener('click', () => {
  fileViewerOverlay.hidden = true;
});
fileViewerOverlay.addEventListener('click', (e) => {
  if (e.target === fileViewerOverlay) fileViewerOverlay.hidden = true;
});

function renderBattleEvent(event) {
  switch (event.type) {
    case 'floorStart':
      monsterNameEl.textContent = `${event.floor + 1}층: ${event.monsterName}`;
      monsterArtEl.textContent = event.monsterArt;
      setHpBar(event.maxHp, event.maxHp);
      appendLog(`${event.monsterName}이(가) 나타났다!`);
      break;
    case 'hesitate':
      appendLog('망설였다. 이번 턴은 공격하지 못했다.');
      turnConcluded();
      break;
    case 'turnStart':
      turnStatusEl.hidden = false;
      turnStatusEl.textContent = 'AI가 작업 중...';
      break;
    case 'partialHit':
      appendLog(`${event.damage}의 피해!`, 'partial-hit');
      if (event.damage > 0) flashMonster();
      break;
    case 'agentEvent': {
      const isFile = event.agentEvent.type === 'file';
      const line = appendLog(
        isFile ? `→ 수정 중: ${event.agentEvent.value}` : `→ 실행 중: ${event.agentEvent.value}`,
        event.agentEvent.type,
      );
      if (isFile) {
        line.classList.add('clickable');
        line.title = '클릭해서 파일 보기';
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
      const label = event.crit ? ' 크리티컬 히트!' : '';
      appendLog(`${randomAttackLine(event.damage)}${label}`, event.crit ? 'crit' : undefined);
      if (event.matchedKeywords.length > 0) appendLog(`(키워드: ${event.matchedKeywords.join(', ')})`);
      if (event.damage > 0) flashMonster();
      turnConcluded();
      break;
    }
    case 'agentSummary':
      renderMarkdownLog(event.summary);
      break;
    case 'hpChanged':
      setHpBar(event.hp, event.maxHp);
      break;
    case 'floorCleared':
      appendLog(`${event.monsterName} 처치! +${event.xpGained} XP`, 'victory');
      break;
    case 'runEnded':
      break;
  }
}

window.promptBattle.onBattleEvent(renderBattleEvent);

startBtn.addEventListener('click', async () => {
  if (!chosenFolder) return;
  const difficulty = document.querySelector('input[name="difficulty"]:checked').value;
  setupErrorEl.hidden = true;
  setupScreen.hidden = true;
  dungeonScreen.hidden = false;
  logEl.textContent = '';
  setInputEnabled(true);
  const theme = THEMES.find((t) => t.id === chosenThemeId) || THEMES[0];
  appendLog(theme.intro, 'story-intro');
  try {
    const result = await window.promptBattle.startRun({ cwd: chosenFolder, difficulty });
    dungeonScreen.hidden = true;
    summaryScreen.hidden = false;
    const { summary, profile } = result;
    summaryTextEl.textContent = `${summary.floorsCleared}층 클리어, +${summary.xpGained} XP 획득. 현재 레벨 ${profile.level} (총 ${profile.xp} XP).`;
  } catch (err) {
    // An unexpected main-process error (not a normal agent-turn error — those
    // are already handled inside runDungeon and never reject this call).
    // Without this catch, a rejection here would leave the player stuck on
    // the dungeon screen forever with no feedback and no way back.
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
  setInputEnabled(false);
  window.promptBattle.submitPrompt(text);
});

fleeBtn.addEventListener('click', () => {
  setInputEnabled(false);
  window.promptBattle.flee();
});

playAgainBtn.addEventListener('click', () => {
  summaryScreen.hidden = true;
  setupScreen.hidden = false;
  chosenFolder = null;
  folderPathEl.textContent = '';
  startBtn.disabled = true;
});
