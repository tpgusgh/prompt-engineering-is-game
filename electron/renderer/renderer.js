// electron/renderer/renderer.js
const setupScreen = document.getElementById('setup-screen');
const dungeonScreen = document.getElementById('dungeon-screen');
const summaryScreen = document.getElementById('summary-screen');
const pickFolderBtn = document.getElementById('pick-folder-btn');
const folderPathEl = document.getElementById('folder-path');
const startBtn = document.getElementById('start-btn');
const monsterNameEl = document.getElementById('monster-name');
const monsterArtEl = document.getElementById('monster-art');
const hpBarFillEl = document.getElementById('hp-bar-fill');
const hpLabelEl = document.getElementById('hp-label');
const logEl = document.getElementById('log');
const attackForm = document.getElementById('attack-form');
const promptInput = document.getElementById('prompt-input');
const fleeBtn = document.getElementById('flee-btn');
const summaryTextEl = document.getElementById('summary-text');
const playAgainBtn = document.getElementById('play-again-btn');
const setupErrorEl = document.getElementById('setup-error');

let chosenFolder = null;

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
}

function setHpBar(hp, maxHp) {
  const safeMax = Math.max(1, maxHp);
  const ratio = Math.max(0, Math.min(hp, safeMax)) / safeMax;
  hpBarFillEl.style.width = `${ratio * 100}%`;
  hpBarFillEl.classList.toggle('warn', ratio <= 0.5 && ratio > 0.2);
  hpBarFillEl.classList.toggle('danger', ratio <= 0.2);
  hpLabelEl.textContent = `${Math.max(0, hp)} / ${safeMax} HP`;
}

function renderBattleEvent(event) {
  switch (event.type) {
    case 'floorStart':
      monsterNameEl.textContent = `Floor ${event.floor + 1}: ${event.monsterName}`;
      monsterArtEl.textContent = event.monsterArt;
      setHpBar(event.maxHp, event.maxHp);
      appendLog(`${event.monsterName} appears!`);
      break;
    case 'hesitate':
      appendLog('You hesitate. No attack this turn.');
      break;
    case 'agentEvent':
      appendLog(
        event.agentEvent.type === 'command' ? `→ running: ${event.agentEvent.value}` : `→ editing: ${event.agentEvent.value}`,
        event.agentEvent.type,
      );
      break;
    case 'agentError':
      appendLog(`Your attack misses! The spell fizzles: ${event.error}`, 'error');
      break;
    case 'attack': {
      const label = event.crit ? ' CRITICAL HIT!' : '';
      appendLog(`You attack for ${event.damage} damage!${label}`, event.crit ? 'crit' : undefined);
      if (event.matchedKeywords.length > 0) appendLog(`(keywords: ${event.matchedKeywords.join(', ')})`);
      break;
    }
    case 'agentSummary':
      appendLog(event.summary);
      break;
    case 'hpChanged':
      setHpBar(event.hp, event.maxHp);
      break;
    case 'floorCleared':
      appendLog(`${event.monsterName} defeated! +${event.xpGained} XP`, 'victory');
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
  try {
    const result = await window.promptBattle.startRun({ cwd: chosenFolder, difficulty });
    dungeonScreen.hidden = true;
    summaryScreen.hidden = false;
    const { summary, profile } = result;
    summaryTextEl.textContent = `${summary.floorsCleared} floor(s) cleared, +${summary.xpGained} XP. Now level ${profile.level} (${profile.xp} total XP).`;
  } catch (err) {
    // An unexpected main-process error (not a normal agent-turn error — those
    // are already handled inside runDungeon and never reject this call).
    // Without this catch, a rejection here would leave the player stuck on
    // the dungeon screen forever with no feedback and no way back.
    dungeonScreen.hidden = true;
    setupScreen.hidden = false;
    setupErrorEl.textContent = `Something went wrong: ${err && err.message ? err.message : String(err)}`;
    setupErrorEl.hidden = false;
  }
});

attackForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = promptInput.value;
  promptInput.value = '';
  window.promptBattle.submitPrompt(text);
});

fleeBtn.addEventListener('click', () => {
  window.promptBattle.flee();
});

playAgainBtn.addEventListener('click', () => {
  summaryScreen.hidden = true;
  setupScreen.hidden = false;
  chosenFolder = null;
  folderPathEl.textContent = '';
  startBtn.disabled = true;
});
