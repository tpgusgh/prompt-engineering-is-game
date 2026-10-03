// electron/main.ts
import electron from 'electron';
const { app, BrowserWindow, ipcMain, dialog, safeStorage, shell, Notification } = electron;
import electronUpdater from 'electron-updater';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { runDungeon, bestiary, CHEST_GRADES, AUTO_SAVE_SLOT, type BattleEvent } from '../src/battle.ts';
import { THEME_RULES } from '../src/themes.ts';
import { GODS, DEMONS } from '../src/contracts.ts';
import { toAttachment, MAX_ATTACHMENTS, type Attachment } from '../src/attachments.ts';
import { loadRankingConfig, startRankedRun, submitScore, fetchRanking, scoreFor, type RankedRun } from '../src/ranking.ts';
import { DIFFICULTY_MULTIPLIER, DIFFICULTY_REWARD } from '../src/monsters.ts';
import { listServers, killServer } from '../src/servers.ts';
import { runAgentTurn, fetchPlanUsage, fetchClaudeCapabilities, fetchAccount, listFolderSessions, loadSessionHistory } from '../src/agent.ts';
import { ATTACK_SPEED, EFFORT_LEVELS, coerceClaudeSettings, parseMcpEntry, authEnv, type ClaudeSettings } from '../src/claude-settings.ts';
import os from 'node:os';
import { loadSlots, writeSlot, deleteSlot } from '../src/saves.ts';
import { PETS, isPetId } from '../src/pets.ts';
import { dailyDungeon, dailyRandom, seededRandom, dateSeed } from '../src/daily.ts';
import { listSkills, saveSkill, deleteSkill } from '../src/skills.ts';
import { loadJournal, recordJournal } from '../src/journal.ts';
import { buyTitle, wearTitle, cleanBadge } from '../src/titles.ts';
import { TITLE_SHOP } from './renderer/title-shop.js';
import { ROSTER_NAMES } from '../src/monsters.ts';
import { movePath, importPaths, createEntry, resolveInside } from '../src/inventory.ts';
import { loadProfile, saveProfile, finishRun, startingStatPoints, rebirth, withRunKit, XP_PER_LEVEL, TITLES, PRESTIGE_LEVEL } from '../src/profile.ts';
import { ACHIEVEMENTS, DAILY_QUESTS, currentDaily, localDate } from '../src/progress.ts';
import { loadFolderSession, saveFolderSession, appendHistory, type FolderSession } from '../src/sessions.ts';
import type { Difficulty } from '../src/monsters.ts';
import { WEAPONS, DEFAULT_WEAPON_ID, getWeapon, providerOf, type Provider } from '../src/weapons.ts';
import { runCodexTurn, codexModels, codexLoginStatus, codexLogin } from '../src/codex.ts';
import { ITEMS, BOSS_ITEMS } from '../src/items.ts';
import { STATS, STAT_MAX_LEVEL } from '../src/stats.ts';
import { SWORD_MAX_LEVEL } from '../src/forge.ts';
import { isNewerVersion, updateMode, RELEASES_URL, LATEST_RELEASE_API, type UpdateStatus } from '../src/updates.ts';
import { HERO_CLASSES, getHeroClass } from '../src/classes.ts';
import { writeJsonAtomic } from '../src/atomic-write.ts';
import { dataHome } from '../src/home.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Only in a packaged app does the SDK's native `claude` binary need to be
// found at its asarUnpack'd path instead of the SDK's own default lookup —
// see the comment on executableOverrideOptions() in src/agent.ts. Each
// build ships only its own platform's package (see "build" in package.json).
if (app.isPackaged) {
  process.env.PROMPTBATTLE_CLAUDE_EXECUTABLE = path.join(
    process.resourcesPath,
    'app.asar.unpacked',
    'node_modules',
    `@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}`,
    process.platform === 'win32' ? 'claude.exe' : 'claude',
  );
}

// Codex's native binary, likewise, sits in its platform package outside the asar.
if (app.isPackaged) {
  const triple = { 'darwin-arm64': 'aarch64-apple-darwin', 'darwin-x64': 'x86_64-apple-darwin', 'linux-x64': 'x86_64-unknown-linux-musl', 'linux-arm64': 'aarch64-unknown-linux-musl', 'win32-x64': 'x86_64-pc-windows-msvc' }[`${process.platform}-${process.arch}`];
  if (triple) {
    process.env.PROMPTBATTLE_CODEX_EXECUTABLE = path.join(
      process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@openai', `codex-${process.platform}-${process.arch}`,
      'vendor', triple, 'bin', process.platform === 'win32' ? 'codex.exe' : 'codex',
    );
  }
}

// The released app has no DevTools and no remote debugging, so the page
// can't be scripted to cheat; PROMPTBATTLE_DEBUG=1 re-enables both (the CI
// smoke test uses it). Development builds keep them.
const DEBUG_ALLOWED = !app.isPackaged || process.env.PROMPTBATTLE_DEBUG === '1';
// A packaged game always uses the real home (the override is for development).
if (app.isPackaged) delete process.env.PROMPTBATTLE_HOME;
if (!DEBUG_ALLOWED) {
  app.commandLine.removeSwitch('remote-debugging-port');
  app.commandLine.removeSwitch('remote-debugging-pipe');
  app.commandLine.removeSwitch('inspect');
}

let mainWindow: InstanceType<typeof BrowserWindow> | null = null;

// One dungeon run at a time, one window: a single pending resolver is enough.
// A multi-window/multi-run version would need a per-session map instead.
let pendingInputResolve: ((value: string | null) => void) | null = null;
// Slash commands sent while a turn is running (the waiting mini-game's
// stat button, save...) wait here for the next readInput instead of
// being dropped. Plain prompts are never queued: the UI disables them mid-turn.
let queuedCommands: string[] = [];
// Lands a typing mini-game hit on the current monster (set by runDungeon).
let externalHit: ((damage: number) => boolean) | null = null;
// The run's damage preview (the estimate under the input).
let damagePreview: ((prompt: string) => { damage: number; crit: boolean }) | null = null;
ipcMain.handle('preview-damage', (_event, prompt: unknown) => (typeof prompt === 'string' ? (damagePreview?.(prompt.slice(0, 20_000)) ?? null) : null));
// ⏹ 멈추기: stops the AI turn in progress.
let currentTurnStop: AbortController | null = null;
// 작전 회의 (🗺 next to the input): Claude plans first, the player approves.
let planMode = false;
ipcMain.handle('set-plan-mode', (_event, on: unknown) => (planMode = on === true));
// Claude's multiple-choice question (AskUserQuestion) waiting on the player.
let pendingAsk: ((answers: Record<string, string> | null) => void) | null = null;
ipcMain.handle('ask-answer', (_event, answers: unknown) => {
  const resolve = pendingAsk;
  pendingAsk = null;
  const clean: Record<string, string> = {};
  if (answers && typeof answers === 'object' && !Array.isArray(answers)) {
    for (const [q, a] of Object.entries(answers).slice(0, 4)) if (typeof a === 'string' && a.trim()) clean[q.slice(0, 500)] = a.trim().slice(0, 2000);
  }
  resolve?.(Object.keys(clean).length ? clean : null);
});
ipcMain.handle('stop-turn', () => {
  if (!currentTurnStop) return false;
  currentTurnStop.abort();
  return true;
});
// AI party on/off from the settings window: applies from the next turn.
let currentParty = true;
ipcMain.handle('set-party', (_event, on: boolean) => {
  currentParty = Boolean(on);
});
// A typed line can't be finished faster than this: blocks scripted spam of
// the hit from the page (devtools console etc.).
const TYPING_HIT_MIN_MS = 1500;
let lastTypingHitAt = 0;
// 타자의 신: the fastest line typed this run (chars per minute), lines of 20+ chars only.
let runBestCpm = 0;
ipcMain.handle('typing-hit', (_event, cpm: unknown, length: unknown) => {
  const now = Date.now();
  if (now - lastTypingHitAt < TYPING_HIT_MIN_MS) return false;
  lastTypingHitAt = now;
  if (typeof cpm === 'number' && Number.isFinite(cpm) && typeof length === 'number' && length >= 20) runBestCpm = Math.max(runBestCpm, Math.min(cpm, 3000));
  return externalHit?.(1) ?? false;
});

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    icon: path.join(__dirname, 'renderer', 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: DEBUG_ALLOWED,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // The page blocks unload while the file editor has unsaved edits: ask.
  mainWindow.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(mainWindow!, {
      type: 'warning',
      buttons: ['저장하고 나가기', '저장 안 하고 나가기', '계속 편집'],
      defaultId: 0,
      cancelId: 2,
      message: '저장하지 않은 파일 변경이 있어요',
      detail: '지금 나가면 편집한 내용이 사라집니다.',
    });
    if (choice === 1) {
      event.preventDefault(); // leave anyway
    } else if (choice === 0) {
      // Stay for now; the page saves, then reports back (save-and-close-done).
      mainWindow?.webContents.send('save-and-close');
    } else {
      quitting = false;
    }
  });
  mainWindow.on('closed', () => {
    // Closing mid-run: resolve the pending readInput() the same way EOF does
    // on the CLI (battle.ts treats null as "leave the dungeon"), so runDungeon
    // finishes normally, floors already cleared still get saved, and a later
    // window doesn't inherit a resolver for a run that no longer has a window.
    mainWindow = null;
    if (pendingInputResolve) {
      const resolve = pendingInputResolve;
      pendingInputResolve = null;
      resolve(null);
    }
  });
}

app.whenReady().then(() => {
  // The packaged app gets its icon from build/icon.icns; in dev, set the Dock icon.
  if (!app.isPackaged && process.platform === 'darwin') app.dock?.setIcon(path.join(__dirname, 'renderer', 'logo.png'));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Cmd+Q vs. closing the window: after "save and leave", finish whichever
// the user started.
let quitting = false;
app.on('before-quit', () => {
  quitting = true;
});
ipcMain.on('save-and-close-done', (_event, ok: boolean) => {
  if (!ok) {
    quitting = false; // the save failed: stay, the editor shows why
    return;
  }
  if (quitting) app.quit();
  else mainWindow?.close();
});

// Updates (packaged app only): Windows/AppImage download and install on
// restart; the Mac build points at the release page. Failures (offline,
// rate limit) are silent — it's only a convenience.
let updateCheck: Promise<UpdateStatus | null> | null = null;
let updaterWired = false;
// force: the "업데이트 확인" button — checks again (also in development).
function checkForUpdate(force = false): Promise<UpdateStatus | null> {
  if (!app.isPackaged && !force) return Promise.resolve(null);
  if (force) updateCheck = null;
  updateCheck ??= (async () => {
    const latest = { state: 'latest', version: app.getVersion() } as const;
    try {
      if (app.isPackaged && updateMode(process.platform, process.env) === 'install') {
        const { autoUpdater } = electronUpdater;
        if (!updaterWired) {
          updaterWired = true;
          autoUpdater.on('update-downloaded', (info) => {
            mainWindow?.webContents.send('update-status', { state: 'ready', version: info.version } satisfies UpdateStatus);
          });
        }
        const result = await autoUpdater.checkForUpdates();
        const version = result?.updateInfo.version;
        return version && isNewerVersion(version, app.getVersion()) ? { state: 'downloading', version } : latest;
      }
      const res = await fetch(LATEST_RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } });
      if (!res.ok) return null;
      const { tag_name: tag } = (await res.json()) as { tag_name?: string };
      return tag && isNewerVersion(tag, app.getVersion()) ? { state: 'available', version: tag.replace(/^v/, ''), url: RELEASES_URL } : latest;
    } catch {
      return null;
    }
  })();
  return updateCheck;
}
ipcMain.handle('check-update', (_event, force?: boolean) => checkForUpdate(Boolean(force)));

// Online ranking: a defeated run can be submitted once (release builds only —
// they carry the signing key). The run token is fetched when a run starts.
// README screenshots only: PROMPTBATTLE_SHOWCASE=merchant|blacksmith|nightMarket|spring|shrine
// makes every floor clear lead there (and the shelf hold a devil's contract).
// Ignored in packaged builds, so it can't be used to cheat.
const SHOWCASE_ROLL: Record<string, number> = { merchant: 0.1, blacksmith: 0.5, nightMarket: 0.7, spring: 0.77, shrine: 0.85 };
function showcaseRolls(): { random?: () => number; shopRandom?: () => number } {
  const roll = SHOWCASE_ROLL[process.env.PROMPTBATTLE_SHOWCASE ?? ''];
  if (app.isPackaged || roll === undefined) return {};
  let n = 0;
  return { random: () => roll, shopRandom: () => (n++ % 2 === 0 ? 0.01 : 0.9) };
}

const rankingConfig = loadRankingConfig(path.join(__dirname, 'ranking-config.json'));
let pendingRank: Omit<RankedRun, 'name'> | null = null;
ipcMain.handle('ranking-list', async (_event, board: unknown) => {
  if (!rankingConfig) return { error: '랭킹 서버가 설정되지 않은 빌드다' };
  const which = board === 'weekly' || board === 'daily' ? board : 'all';
  try {
    return { entries: await fetchRanking(rankingConfig.url, which, which === 'daily' ? localDate() : undefined) };
  } catch (err) {
    return { error: `랭킹을 불러오지 못했다 (${err instanceof Error ? err.message : err})` };
  }
});
ipcMain.handle('ranking-submit', async (_event, name: unknown) => {
  if (!rankingConfig?.secret || !pendingRank) return { error: '이 기록은 등록할 수 없다' };
  const clean = String(name ?? '').trim().slice(0, 16);
  if (!clean) return { error: '이름을 입력해 줘' };
  try {
    const result = await submitScore(rankingConfig, { ...pendingRank, name: clean });
    pendingRank = null;
    return result;
  } catch (err) {
    return { error: `등록 실패: ${err instanceof Error ? err.message : err}` };
  }
});

// "The AI is done" when the window isn't in front: an OS notification that
// brings the game back when clicked, plus a Dock bounce / taskbar flash.
ipcMain.on('notify', (_event, title: unknown, body: unknown) => {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isFocused()) return;
  if (Notification.isSupported()) {
    const n = new Notification({ title: String(title).slice(0, 80), body: String(body).slice(0, 200) });
    n.on('click', () => {
      mainWindow?.show();
      mainWindow?.focus();
    });
    n.show();
  }
  if (process.platform === 'darwin') app.dock?.bounce('informational');
  else mainWindow.flashFrame(true);
});
app.on('browser-window-focus', () => mainWindow?.flashFrame(false));
ipcMain.handle('open-release-page', () => shell.openExternal(RELEASES_URL));
ipcMain.handle('install-update', () => electronUpdater.autoUpdater.quitAndInstall());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Files and pictures attached to the next prompt (📎, drop, paste). The next
// AI turn takes them and the list empties.
let attachments: (Attachment & { id: string; size: number })[] = [];
let attachmentSeq = 0;
const attachmentList = () => attachments.map(({ id, name, kind, size }) => ({ id, name, kind, size }));
function addAttachment(name: string, bytes: Buffer): string | null {
  if (attachments.length >= MAX_ATTACHMENTS) return `${name}: 한 번에 ${MAX_ATTACHMENTS}개까지 첨부할 수 있다`;
  const a = toAttachment(name, bytes);
  if ('error' in a) return a.error;
  attachments.push({ ...a, id: `a${++attachmentSeq}`, size: bytes.length });
  return null;
}
async function attachPaths(paths: unknown): Promise<{ list: ReturnType<typeof attachmentList>; errors: string[] }> {
  const errors: string[] = [];
  for (const p of Array.isArray(paths) ? paths : []) {
    if (typeof p !== 'string') continue;
    try {
      const stat = await fs.stat(p);
      if (!stat.isFile()) throw new Error('폴더는 첨부할 수 없다');
      if (stat.size > 31 * 1024 * 1024) throw new Error('파일이 너무 크다');
      const error = addAttachment(path.basename(p), await fs.readFile(p));
      if (error) errors.push(error);
    } catch (err) {
      errors.push(`${path.basename(String(p))}: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { list: attachmentList(), errors };
}
ipcMain.handle('attach-pick', async () => {
  if (!mainWindow) return { list: attachmentList(), errors: [] };
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile', 'multiSelections'], defaultPath: currentCwd ?? undefined });
  return result.canceled ? { list: attachmentList(), errors: [] } : attachPaths(result.filePaths);
});
ipcMain.handle('attach-paths', (_event, paths: unknown) => attachPaths(paths));
ipcMain.handle('attach-data', (_event, name: unknown, base64: unknown) => {
  const error = typeof base64 === 'string' ? addAttachment(String(name || 'image.png').slice(0, 80), Buffer.from(base64, 'base64')) : '잘못된 첨부';
  return { list: attachmentList(), errors: error ? [error] : [] };
});
ipcMain.handle('attach-remove', (_event, id: unknown) => {
  attachments = attachments.filter((a) => a.id !== id);
  return { list: attachmentList(), errors: [] };
});

// Switching the project folder mid-run: set by start-run while a run is on.
let switchRunFolder: ((dir: string) => Promise<void>) | null = null;
ipcMain.handle('change-folder', async () => {
  if (!mainWindow || !switchRunFolder) return { error: '진행 중인 모험이 없다' };
  if (currentTurnStop) return { error: 'AI가 작업하는 중에는 폴더를 바꿀 수 없다' };
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], defaultPath: currentCwd ?? undefined });
  if (result.canceled || result.filePaths.length === 0) return null;
  const next = path.resolve(result.filePaths[0]);
  if (next === currentCwd) return null;
  await switchRunFolder(next);
  return { folder: next };
});

ipcMain.handle('pick-folder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// The project folder of the run in progress — the only place the in-app
// file editor is allowed to write.
let currentCwd: string | null = null;
// 🖥 서버 (src/servers.ts): only a pid from the latest listing can be killed.
let knownServers = new Set<number>();
ipcMain.handle('servers-list', async () => {
  if (!currentCwd) return [];
  const list = await listServers(currentCwd);
  if (Array.isArray(list)) knownServers = new Set(list.map((s) => s.pid));
  return list;
});
ipcMain.handle('servers-kill', (_event, pid: unknown) => (typeof pid === 'number' && knownServers.has(pid) ? killServer(pid) : false));
ipcMain.handle('open-local', (_event, port: unknown) =>
  Number.isInteger(port) && (port as number) > 0 && (port as number) < 65536 ? shell.openExternal(`http://localhost:${port}`) : undefined,
);
// The weapon (Claude model) in hand; switchable mid-run via set-model.
let currentModel = DEFAULT_WEAPON_ID;

ipcMain.handle('get-setup-info', async () => ({
  ...((runActive = false), {}), // back on the start screen: no run in progress
  profile: await loadProfile(),
  weapons: WEAPONS,
  items: [...ITEMS, ...BOSS_ITEMS],
  stats: STATS,
  statMaxLevel: STAT_MAX_LEVEL,
  swordMaxLevel: SWORD_MAX_LEVEL,
  classes: HERO_CLASSES,
  xpPerLevel: XP_PER_LEVEL,
  titles: TITLES,
  // Plain data only (the achievement checks are functions: they stay here).
  achievements: ACHIEVEMENTS.map(({ done: _done, ...a }) => a),
  dailyQuests: DAILY_QUESTS,
  bestiary: bestiary(),
  themeRules: THEME_RULES,
  difficulty: DIFFICULTY_MULTIPLIER,
  difficultyReward: DIFFICULTY_REWARD,
  chestGrades: CHEST_GRADES,
  pacts: { god: GODS, demon: DEMONS },
  pets: PETS,
  prestigeLevel: PRESTIGE_LEVEL,
  daily: dailyDungeon(localDate()),
  rosterNames: ROSTER_NAMES,
  appVersion: app.getVersion(),
}));

// Today's quest (a new day swaps it in even before the next run ends).
ipcMain.handle('get-daily', async () => currentDaily((await loadProfile()).daily, localDate()));

// Settings tab: what can be toggled (skills, MCP servers) per folder, and
// the chosen settings (saved in the profile; a running game picks changes up
// on its next turn).
const capabilityCache = new Map<string, Awaited<ReturnType<typeof fetchClaudeCapabilities>>>();
ipcMain.handle('claude-capabilities', async (_event, cwd: string | null, refresh = false) => {
  await authReady;
  const dir = path.resolve(cwd ?? app.getPath('home'));
  const mcp = (currentClaude ?? (await loadProfile()).claude).mcpServers;
  if (refresh || !capabilityCache.get(dir)) capabilityCache.set(dir, await fetchClaudeCapabilities(dir, claudeEnv(), mcp));
  return capabilityCache.get(dir) ?? null;
});
let currentClaude: ClaudeSettings | null = null;
ipcMain.handle('set-claude-settings', async (_event, settings: unknown) => {
  const next = coerceClaudeSettings(settings);
  if (currentClaude?.auth !== next.auth || JSON.stringify(currentClaude?.mcpServers ?? {}) !== JSON.stringify(next.mcpServers ?? {})) capabilityCache.clear();
  currentClaude = next;
  await saveProfile({ ...(await loadProfile()), claude: next });
  return next;
});
ipcMain.handle('claude-settings-info', () => ({ levels: EFFORT_LEVELS, attackSpeed: ATTACK_SPEED }));
// 🔌 MCP 연결하러 가기: check a server from the form; the renderer saves it
// into the Claude settings (coerced again there).
ipcMain.handle('mcp-parse', (_event, name: unknown, kind: unknown, value: unknown) =>
  parseMcpEntry(String(name ?? ''), kind === 'url' ? 'url' : 'command', String(value ?? '')),
);
const LINKS: Record<string, string> = {
  connectors: 'https://claude.ai/settings/connectors',
  servers: 'https://github.com/modelcontextprotocol/servers',
};
ipcMain.handle('open-link', (_event, key: unknown) => (typeof key === 'string' && LINKS[key] ? shell.openExternal(LINKS[key]) : undefined));

ipcMain.handle('get-usage', async () => {
  await authReady;
  return fetchPlanUsage(currentCwd ?? app.getPath('home'), claudeEnv());
});

// ---------------------------------------------------------------------------
// Auth: the Claude Code CLI login (default) or an Anthropic API key. The key
// is encrypted with the OS keychain (safeStorage) at rest and never sent back
// to the page — the page only learns whether one is set (and its last 4).
const SECRETS_FILE = path.join(dataHome(), '.promptbattle', 'secrets.json');
let apiKey: string | undefined;
// A saved key the keychain couldn't open (entry gone, access refused): said once, not retried.
let keyUnreadable = false;
// The keychain is only touched when a key was actually saved: asking it for
// nothing made macOS pop its access prompt again and again.
async function loadApiKey(): Promise<void> {
  let saved: unknown;
  try {
    saved = JSON.parse(await fs.readFile(SECRETS_FILE, 'utf-8')).anthropicApiKey;
  } catch {
    return; // no key saved: nothing to look up
  }
  if (typeof saved !== 'string') return;
  try {
    apiKey = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(saved, 'base64')) : undefined;
    keyUnreadable = !apiKey;
  } catch {
    apiKey = undefined;
    keyUnreadable = true;
  }
}
// The key and the saved auth mode must be loaded before any claude process spawns.
const authReady = app.whenReady().then(async () => {
  await loadApiKey();
  currentClaude ??= (await loadProfile()).claude;
});
function claudeEnv(): Record<string, string | undefined> {
  return authEnv(process.env, (currentClaude ?? { auth: 'cli' }).auth, apiKey);
}
const keyInfo = () => ({ hasKey: Boolean(apiKey), last4: apiKey ? apiKey.slice(-4) : null });
ipcMain.handle('api-key-info', async () => {
  await authReady;
  return { ...keyInfo(), unreadable: keyUnreadable };
});
ipcMain.handle('set-api-key', async (_event, key: string | null) => {
  await fs.mkdir(path.dirname(SECRETS_FILE), { recursive: true });
  const trimmed = key?.trim();
  if (!trimmed) {
    apiKey = undefined;
    keyUnreadable = false;
    await fs.rm(SECRETS_FILE, { force: true });
  } else {
    if (!safeStorage.isEncryptionAvailable()) return { ok: false, message: '이 컴퓨터에서 키체인 암호화를 쓸 수 없어 저장하지 않았다' };
    apiKey = trimmed;
    keyUnreadable = false;
    const encrypted = safeStorage.encryptString(trimmed).toString('base64');
    await writeJsonAtomic(SECRETS_FILE, { anthropicApiKey: encrypted }, 0o600);
  }
  capabilityCache.clear();
  return { ok: true, ...keyInfo() };
});
// "연결 확인": which account/key the game's sessions would use right now.
ipcMain.handle('check-auth', async () => {
  await authReady;
  const account = await fetchAccount(currentCwd ?? app.getPath('home'), claudeEnv());
  return account ?? null;
});

ipcMain.handle('set-model', (_event, model: string) => {
  const weapon = getWeapon(model);
  currentModel = weapon.model;
  return weapon;
});

ipcMain.handle('get-folder-session', (_event, cwd: string) => loadFolderSession(path.resolve(cwd)));
ipcMain.handle('list-sessions', (_event, cwd: string) => listFolderSessions(path.resolve(cwd)));
ipcMain.handle('session-history', (_event, cwd: string, sessionId: string) => loadSessionHistory(sessionId, path.resolve(cwd)));
ipcMain.handle('list-slots', () => loadSlots());
// 환생: level 1 again for a prestige star (only between runs).
ipcMain.handle('rebirth', async () => {
  const reborn = rebirth(await loadProfile());
  if (!reborn) return { error: `레벨 ${PRESTIGE_LEVEL}부터 환생할 수 있다` };
  await saveProfile(reborn);
  return { profile: reborn };
});

ipcMain.handle('delete-slot', async (_event, slot: number) => {
  if (!Number.isInteger(slot) || slot < 1 || slot > AUTO_SAVE_SLOT) return loadSlots();
  await deleteSlot(slot);
  return loadSlots();
});

ipcMain.handle(
  'start-run',
  async (
    _event,
    requested: {
      cwd: string;
      difficulty: Difficulty;
      model: string;
      themeId: string;
      startFloor: number;
      // Claude session to resume (from the session picker); omit for a new one.
      sessionId?: string;
      // Load a save slot instead: its folder, theme, model and run state win.
      loadSlot?: number;
      // Let the AI send out the wizard/swordsman/archer subagents.
      party?: boolean;
      heroClass?: string;
      // The pet to bring ('' = none); must be one the profile owns.
      pet?: string;
      // 일일 도전: today's fixed dungeon (theme, areas and rolls from the date).
      daily?: boolean;
    },
  ) => {
    const profile = await loadProfile();
    runActive = true;
    if (requested.pet !== undefined) {
      const chosen = isPetId(requested.pet) && profile.pets?.includes(requested.pet) ? requested.pet : undefined;
      if (chosen) profile.activePet = chosen;
      else delete profile.activePet;
    }
    const day = requested.daily ? dailyDungeon(localDate()) : null;
    if (day) Object.assign(requested, { difficulty: 'normal', themeId: day.themeId, startFloor: 0, sessionId: undefined, loadSlot: undefined });
    const manual = requested.loadSlot ? (await loadSlots())[requested.loadSlot - 1] : null;
    if (requested.loadSlot && !manual) throw new Error(`슬롯 ${requested.loadSlot}이(가) 비어 있습니다.`);
    // Resuming a Claude session also resumes that session's autosaved run.
    const autosaved =
      !manual && requested.sessionId
        ? (await loadFolderSession(path.resolve(requested.cwd))).runStates?.[requested.sessionId]
        : undefined;
    const slot = manual ?? autosaved ?? null;
    const options = slot
      ? { ...requested, cwd: slot.cwd, difficulty: slot.difficulty, model: slot.model, themeId: slot.themeId, startFloor: slot.floor, sessionId: slot.sessionId, heroClass: slot.heroClass ?? requested.heroClass }
      : requested;
    currentCwd = path.resolve(options.cwd);
    queuedCommands = [];
    // Save/load XP dupe guard: a loaded save continues its run line, and the
    // floors that line was already paid for give no XP again. A save from
    // before run lines existed gets a stable id from its timestamp.
    const runId = slot ? (slot.runId ?? `legacy-${slot.savedAt}`) : crypto.randomUUID();
    const paidXp = profile.xpClaims?.[runId];
    currentParty = requested.party ?? true;
    pendingRank = null;
    const runTokenPromise = rankingConfig ? startRankedRun(rankingConfig) : Promise.resolve(null);
    await authReady;
    currentClaude = profile.claude;
    const heroClass = getHeroClass(options.heroClass).id;
    currentModel = getWeapon(options.model).model;
    // The run's project folder can change mid-run (📁 in battle).
    let cwd = currentCwd;
    const send = (event: unknown) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('battle-event', event);
    };

    // The folder's session id + chat log, saved as the run goes so a crash
    // or closed window loses nothing. Saves are chained to never interleave.
    let folder: FolderSession = await loadFolderSession(cwd);
    let saving = Promise.resolve();
    switchRunFolder = async (next: string) => {
      await saving; // finish writing the old folder's history first
      cwd = next;
      currentCwd = next;
      folder = await loadFolderSession(next);
    };
    const persistFolder = () => {
      const snapshot = { ...folder, history: [...folder.history], runStates: { ...folder.runStates } };
      saving = saving.then(() => saveFolderSession(cwd, snapshot)).catch(() => {});
    };
    // 모험 일지: a turn (and its prompt) right away; the files it touched are
    // flushed with the next turn or at the end; tokens/tests/floors at the end.
    let journalFiles: string[] = [];
    const flushJournal = (delta: Parameters<typeof recordJournal>[2] = {}) => {
      const files = journalFiles;
      journalFiles = [];
      const nothing = !files.length && !delta.prompts?.length && !['turns', 'floorsCleared', 'testsPassed', 'tokens'].some((k) => (delta as Record<string, number>)[k] > 0);
      if (nothing) return Promise.resolve(); // a run with no AI turns leaves no empty day
      return recordJournal(cwd, localDate(), { ...delta, files }).catch(() => {});
    };
    const trackJournal = (event: BattleEvent) => {
      if (event.type === 'turnStart') void flushJournal({ turns: 1, prompts: [event.prompt] });
      else if (event.type === 'agentEvent' && event.agentEvent.type === 'file') journalFiles.push(path.relative(cwd, path.resolve(cwd, event.agentEvent.value)) || event.agentEvent.value);
    };
    // Claude and Codex each keep their own session; switching AI hands the new
    // one what was said since it last worked (the files are shared anyway).
    const sessions: Record<Provider, string | undefined> = { claude: undefined, codex: undefined };
    if (options.sessionId?.startsWith('codex:')) sessions.codex = options.sessionId.slice('codex:'.length);
    else sessions.claude = options.sessionId;
    let lastReturned: string | undefined = options.sessionId;
    const convo: { provider: Provider; role: 'user' | 'assistant'; text: string }[] = [];
    const seen: Record<Provider, number> = { claude: 0, codex: 0 };
    const providersUsed = new Set<Provider>();
    let walletWrites: Promise<unknown> = Promise.resolve();
    runBestCpm = 0;
    const NAME: Record<Provider, string> = { claude: 'Claude', codex: 'Codex' };
    const handoff = (provider: Provider) => {
      const missed = convo.slice(seen[provider]).filter((e) => e.provider !== provider);
      if (!missed.length) return '';
      const other = NAME[missed[0].provider];
      let budget = 6000;
      const lines: string[] = [];
      for (const e of missed.slice(-12).reverse()) {
        const line = `${e.role === 'user' ? 'User' : other}: ${e.text.replace(/\s+/g, ' ').slice(0, 700)}`;
        if ((budget -= line.length) < 0) break;
        lines.unshift(line);
      }
      return `[Game note: until now another AI (${other}) was working on this project in this folder. Its files and changes are already here. What was said meanwhile:\n${lines.join('\n')}\n— Pick up from there.]\n\n`;
    };
    // Codex reads text attachments inline; pictures and PDFs only go to Claude.
    const withTextAttachments = (text: string, files: typeof attachments) => {
      const texts = files.filter((a) => a.kind === 'text').map((a) => `첨부 파일 ${a.name}:\n\`\`\`\n${(a as { text: string }).text}\n\`\`\``);
      const skipped = files.filter((a) => a.kind !== 'text').map((a) => a.name);
      return [...texts, ...(skipped.length ? [`(Codex에는 이미지·PDF 첨부를 보낼 수 없어 뺐다: ${skipped.join(', ')})`] : []), text].join('\n\n');
    };

    const trackHistory = (event: BattleEvent) => {
      trackJournal(event);
      if (event.type === 'turnStart') folder.history = appendHistory(folder.history, { role: 'user', text: event.prompt });
      else if (event.type === 'agentSummary') folder.history = appendHistory(folder.history, { role: 'assistant', text: event.summary });
      else if (event.type === 'agentError') folder.history = appendHistory(folder.history, { role: 'assistant', text: `(오류) ${event.error}` });
      else if (event.type === 'sessionSaved') {
        if (!event.sessionId.startsWith('codex:')) folder.sessionId = event.sessionId; // the folder's Claude session
      }
      else if (event.type === 'sessionReset') delete folder.sessionId;
      else if (event.type === 'sessionSwitched') folder.sessionId = event.sessionId;
      else return;
      persistFolder();
    };

    const summary = await runDungeon({
      runTurn: async (prompt, _cwd, sessionId, onEvent) => {
        const stop = new AbortController();
        currentTurnStop = stop;
        try {
          // /new (or a failed first turn) cleared the battle's session: both AIs start fresh.
          if (sessionId === undefined && lastReturned !== undefined) {
            sessions.claude = sessions.codex = undefined;
            convo.length = 0;
          }
          const provider = providerOf(currentModel);
          providersUsed.add(provider);
          const sent = attachments;
          attachments = [];
          const full = handoff(provider) + prompt;
          const turn =
            provider === 'codex'
              ? await runCodexTurn(withTextAttachments(full, sent), cwd, sessions.codex, onEvent, {
                  model: (await codexModels())[currentModel.slice('codex:'.length) as 'luna'],
                  effort: (currentClaude ?? profile.claude).effort,
                  signal: stop.signal,
                })
              : await runAgentTurn(full, cwd, sessions.claude, onEvent, {
                  model: currentModel, party: currentParty, claude: currentClaude ?? undefined, env: claudeEnv(), signal: stop.signal, attachments: sent,
                  ...((currentClaude ?? profile.claude).safeMode
                    ? {
                        guard: (command: string, danger: string) =>
                          new Promise<boolean>((resolve) => {
                            pendingAsk?.(null);
                            const done = (answers: Record<string, string> | null) => resolve(answers?.danger === 'allow');
                            pendingAsk = done;
                            send({ type: 'askDanger', command, danger });
                            stop.signal.addEventListener('abort', () => {
                              if (pendingAsk !== done) return;
                              pendingAsk = null;
                              resolve(false);
                              send({ type: 'askClosed' });
                            }, { once: true });
                          }),
                      }
                    : {}),
                  ...(planMode
                    ? {
                        reviewPlan: (plan: string) =>
                          new Promise<{ approve: true } | { approve: false; feedback: string } | null>((resolve) => {
                            pendingAsk?.(null);
                            const done = (answers: Record<string, string> | null) =>
                              resolve(!answers ? null : answers.plan === 'approve' ? { approve: true } : { approve: false, feedback: answers.feedback ?? '' });
                            pendingAsk = done;
                            send({ type: 'askPlan', plan });
                            stop.signal.addEventListener('abort', () => {
                              if (pendingAsk !== done) return;
                              pendingAsk = null;
                              resolve(null);
                              send({ type: 'askClosed' });
                            }, { once: true });
                          }),
                      }
                    : {}),
                  askUser: (questions) =>
                    new Promise((resolve) => {
                      pendingAsk?.(null);
                      pendingAsk = resolve;
                      send({ type: 'askUser', questions });
                      // ⏹ 멈추기 while it's open: no answer, the quest closes.
                      stop.signal.addEventListener('abort', () => {
                        if (pendingAsk !== resolve) return;
                        pendingAsk = null;
                        resolve(null);
                        send({ type: 'askClosed' });
                      }, { once: true });
                    }),
                });
          if (turn.sessionId) sessions[provider] = turn.sessionId;
          convo.push({ provider, role: 'user', text: prompt }, { provider, role: 'assistant', text: turn.summary || turn.error || '' });
          seen[provider] = convo.length;
          lastReturned = provider === 'codex' && turn.sessionId ? `codex:${turn.sessionId}` : turn.sessionId;
          return { ...turn, sessionId: lastReturned };
        } finally {
          if (currentTurnStop === stop) currentTurnStop = null;
        }
      },
      cwd,
      difficulty: options.difficulty,
      // The wallet is the profile's, never a save slot's: reloading a save
      // can't copy coins back (it's kept up to date below). The bag and the
      // pact are the run's: none for a new one, the run's latest for a save.
      coins: profile.coins,
      bag: slot ? (profile.runKits?.[runId]?.bag ?? slot.bag) : {},
      playerMaxHp: slot ? slot.playerMaxHp : profile.maxHp,
      playerHp: slot?.playerHp,
      monsterHp: slot?.monsterHp,
      bindExternalHit: (fn) => (externalHit = fn),
      bindDamagePreview: (fn) => (damagePreview = fn),
      getModel: () => currentModel,
      contract: slot ? ((profile.runKits?.[runId] ? profile.runKits[runId].contract : slot.contract) ?? null) : null,
      relics: profile.relics,
      themeId: options.themeId,
      initialSessionId: options.sessionId,
      startFloor: Math.max(0, Math.floor(options.startFloor || 0)),
      getDamageMultiplier: () => getWeapon(currentModel).multiplier * ATTACK_SPEED[(currentClaude ?? profile.claude).effort].multiplier,
      // Hero stats are per-run: fresh each game, restored only from a save slot.
      stats: slot?.stats,
      statPoints: slot ? slot.statPoints : startingStatPoints(profile),
      swordLevel: profile.swordLevel, // permanent, like the wallet: a save can't undo a broken sword
      runId,
      ...(paidXp ? { paidXp } : {}),
      ...(profile.activePet ? { pet: profile.activePet } : {}),
      ownedPets: profile.pets ?? [],
      prestige: profile.prestige ?? 0,
      equipment: profile.equipment ?? [],
      ...(day ? { daily: day.date, rosters: day.rosters, random: dailyRandom(day.date), shopRandom: seededRandom(dateSeed(day.date) ^ 0x5bd1e995) } : {}),
      ...showcaseRolls(),
      onBattleEvent: (event: BattleEvent) => {
        trackHistory(event);
        if (event.type !== 'snapshot') {
          send(event);
          return;
        }
        const savedAt = Date.now();
        const data = { ...event.state, savedAt, cwd, themeId: options.themeId, difficulty: options.difficulty, model: currentModel, heroClass };
        if (event.slot === 0) {
          // Every input wait: the live wallet goes to the profile (a crash keeps it).
          const { coins: liveCoins, bag: liveBag, swordLevel: liveSword } = event.state;
          walletWrites = walletWrites.then(async () => saveProfile({ ...withRunKit(await loadProfile(), runId, liveBag, event.state.contract), coins: liveCoins, swordLevel: liveSword })).catch(() => {});
          if (data.sessionId) {
            // Autosave, keyed by Claude session; keep the 30 most recent.
            const all = { ...folder.runStates, [data.sessionId]: data };
            folder.runStates = Object.fromEntries(
              Object.entries(all).sort(([, a], [, b]) => b.savedAt - a.savedAt).slice(0, 30),
            );
            persistFolder();
          }
          return;
        }
        if (event.slot === AUTO_SAVE_SLOT) {
          writeSlot(event.slot, data).catch(() => {}); // quiet: every input wait
          return;
        }
        send(event);
        writeSlot(event.slot, data)
          .then(() => send({ type: 'slotSaved', slot: event.slot, data }))
          .catch((err) => send({ type: 'saveFailed', reason: err instanceof Error ? err.message : String(err) }));
      },
      readInput: () =>
        queuedCommands.length > 0
          ? Promise.resolve(queuedCommands.shift()!)
          : new Promise<string | null>((resolve) => {
              pendingInputResolve = resolve;
            }),
    });

    // Settings changed mid-run win over the copy loaded at the start.
    // A daily run doesn't move the theme's story progress.
    await flushJournal({ floorsCleared: summary.floorsCleared, testsPassed: summary.runStats.testsPassed, tokens: summary.runStats.tokens });
    await walletWrites; // the last live-wallet write lands before the run's own save
    summary.runStats.bestTypingCpm = runBestCpm;
    summary.runStats.bothAis = providersUsed.size > 1 ? 1 : 0;
    const finished = finishRun(profile, summary, day ? undefined : options.themeId);
    const updated = { ...finished.profile, heroClass, claude: currentClaude ?? profile.claude };
    await saveProfile(updated);
    await saving;
    switchRunFolder = null;

    const { unlocked, dailyCompleted, rewardCoins } = finished.progress;
    // A defeat can go on the ranking (if the server issued this run a token).
    const runToken = summary.defeated ? await runTokenPromise : null;
    // Ranked by how far the run got (chapter/floor), not just this sitting's
    // floors: a run continued from a save still counts from the beginning.
    const rankStats = { floors: summary.nextFloor, bosses: summary.chaptersCleared, xp: summary.xpGained, difficulty: options.difficulty };
    const rankScore = scoreFor(rankStats);
    const startFloor = Math.min(summary.nextFloor, Math.max(0, Math.floor(options.startFloor || 0)));
    pendingRank =
      runToken && rankScore > 0
        ? { runToken, ...rankStats, startFloor, theme: options.themeId, heroClass, level: updated.level, prestige: updated.prestige ?? 0, ...(cleanBadge(updated.badge) ? { badge: updated.badge } : {}), ...(day ? { daily: day.date } : {}) }
        : null;
    const rankReason = !rankingConfig?.secret ? '이 빌드는 랭킹 등록을 지원하지 않는다' : !runToken ? '랭킹 서버에 연결하지 못했다' : rankScore > 0 ? '' : '점수가 0점이라 등록할 수 없다 — 몬스터를 쓰러뜨려 보자';
    const ranking = summary.defeated ? { submittable: Boolean(pendingRank), score: rankScore, reason: rankReason } : null;
    runActive = false;
    return { summary, profile: updated, ranking, progress: { unlocked: unlocked.map(({ done: _done, ...a }) => a), dailyCompleted, rewardCoins } };
  },
);

function insideCwd(filePath: string): string | null {
  if (!currentCwd) return null;
  const resolved = resolveInside(currentCwd, filePath);
  return resolved === currentCwd ? null : resolved;
}

// Inventory drag & drop and "new file/folder" — all confined to the project.
const noProject = { ok: false, message: '진행 중인 프로젝트가 없다' } as const;
// 스킬북 (src/skills.ts): the run's project skills plus the user's.
ipcMain.handle('journal-get', () => loadJournal());
// 칭호 상점: buy and wear titles with the profile's coins — only between runs
// (during one the live wallet is the run's).
let runActive = false;
const titleChange = async (change: (p: Awaited<ReturnType<typeof loadProfile>>) => ReturnType<typeof buyTitle>) => {
  if (runActive) return { error: '모험 중에는 살 수 없다 — 시작 화면에서!' };
  const result = change(await loadProfile());
  if ('error' in result) return result;
  await saveProfile(result.profile);
  return { profile: result.profile };
};
ipcMain.handle('title-buy', (_event, id: unknown) => titleChange((p) => buyTitle(p, TITLE_SHOP, String(id))));
ipcMain.handle('title-wear', (_event, id: unknown) => titleChange((p) => wearTitle(p, id === null ? null : String(id))));
// Codex: sign-in (ChatGPT, in the browser) and its model families.
ipcMain.handle('codex-status', async () => ({ ...(await codexLoginStatus()), models: await codexModels() }));
ipcMain.handle('codex-login', () => codexLogin());
ipcMain.handle('skills-list', () => (currentCwd ? listSkills(currentCwd) : []));
ipcMain.handle('skill-save', (_event, skill: { name: string; description: string; body: string }) =>
  currentCwd ? saveSkill(currentCwd, { name: String(skill?.name ?? ''), description: String(skill?.description ?? ''), body: String(skill?.body ?? '') }) : { error: noProject.message },
);
ipcMain.handle('skill-delete', (_event, name: string) => (currentCwd ? deleteSkill(currentCwd, String(name)) : { error: noProject.message }));
ipcMain.handle('move-path', (_event, src: string, destDir: string) => (currentCwd ? movePath(currentCwd, src, destDir) : noProject));
ipcMain.handle('import-files', (_event, sources: string[], destDir: string) =>
  currentCwd ? importPaths(currentCwd, sources, destDir) : { imported: 0, failed: sources },
);
ipcMain.handle('create-entry', (_event, parentDir: string, name: string, kind: 'file' | 'dir') =>
  currentCwd ? createEntry(currentCwd, parentDir, name, kind) : noProject,
);

const TREE_SKIP = new Set(['node_modules', '.git', 'release', 'dist', '.superpowers', '.claude', '.DS_Store']);
const TREE_MAX_ENTRIES = 5000;
const TREE_MAX_DEPTH = 12;

interface TreeNode {
  name: string;
  path: string;
  type: 'dir' | 'file';
  children?: TreeNode[];
}

// The project folder as an "inventory" tree, bounded so a huge repo can't
// freeze the UI: skips build/vendor dirs, caps depth and total entries.
ipcMain.handle('list-tree', async () => {
  if (!currentCwd) return null;
  let count = 0;
  const walk = async (dir: string, depth: number): Promise<TreeNode[]> => {
    if (depth > TREE_MAX_DEPTH || count >= TREE_MAX_ENTRIES) return [];
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
    const nodes: TreeNode[] = [];
    for (const entry of entries) {
      if (TREE_SKIP.has(entry.name) || count >= TREE_MAX_ENTRIES) continue;
      count += 1;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) nodes.push({ name: entry.name, path: full, type: 'dir', children: await walk(full, depth + 1) });
      else if (entry.isFile()) nodes.push({ name: entry.name, path: full, type: 'file' });
    }
    return nodes;
  };
  return { root: currentCwd, children: await walk(currentCwd, 0), truncated: count >= TREE_MAX_ENTRIES };
});

ipcMain.handle('write-file', async (_event, filePath: string, content: string) => {
  const target = insideCwd(filePath);
  if (!target) return { ok: false, message: '프로젝트 폴더 밖의 파일은 수정할 수 없습니다.' };
  try {
    await fs.writeFile(target, content, 'utf-8');
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.on('submit-prompt', (_event, text: string) => {
  if (pendingInputResolve) {
    const resolve = pendingInputResolve;
    pendingInputResolve = null;
    resolve(text);
  } else if (text.trim().startsWith('/') && text.trim() !== '/quit') {
    queuedCommands.push(text);
  }
});


// The OS's own icon for a touched file — used for the "throw the file at the
// monster" flourish. Never reads the file's actual content (see
// read-file-content below for that), so this stays safe for any file type.
ipcMain.handle('get-file-icon', async (_event, filePath: string) => {
  try {
    const icon = await app.getFileIcon(filePath, { size: 'normal' });
    return icon.toDataURL();
  } catch {
    return null;
  }
});

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']);
const MAX_FILE_PREVIEW_CHARS = 100_000;

// Backs the in-app file viewer: an image is shown directly (the renderer
// loads it via its own file:// URL — no content passes through IPC); any
// other file's text content is read here and capped, since a toucher could
// be an enormous log file the agent generated.
ipcMain.handle('read-file-content', async (_event, filePath: string) => {
  const ext = path.extname(filePath).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) {
    return { kind: 'image', url: `file://${filePath}` };
  }
  try {
    const stat = await fs.stat(filePath);
    const buffer = await fs.readFile(filePath);
    const isProbablyBinary = buffer.subarray(0, 1000).includes(0);
    if (isProbablyBinary) {
      return { kind: 'error', message: '바이너리 파일로 보입니다 — 텍스트 미리보기를 지원하지 않습니다.' };
    }
    const text = buffer.toString('utf-8');
    const truncated = text.length > MAX_FILE_PREVIEW_CHARS;
    return {
      kind: 'text',
      content: truncated ? text.slice(0, MAX_FILE_PREVIEW_CHARS) : text,
      truncated,
      size: stat.size,
    };
  } catch (err) {
    return { kind: 'error', message: err instanceof Error ? err.message : String(err) };
  }
});
