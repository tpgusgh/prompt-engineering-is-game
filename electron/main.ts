// electron/main.ts
import electron from 'electron';
const { app, BrowserWindow, ipcMain, dialog, safeStorage, shell } = electron;
import electronUpdater from 'electron-updater';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { runDungeon, bestiary, AUTO_SAVE_SLOT, type BattleEvent } from '../src/battle.ts';
import { THEME_RULES } from '../src/themes.ts';
import { DIFFICULTY_MULTIPLIER } from '../src/monsters.ts';
import { runAgentTurn, fetchPlanUsage, fetchClaudeCapabilities, fetchAccount, listFolderSessions, loadSessionHistory } from '../src/agent.ts';
import { ATTACK_SPEED, EFFORT_LEVELS, coerceClaudeSettings, authEnv, type ClaudeSettings } from '../src/claude-settings.ts';
import os from 'node:os';
import { loadSlots, writeSlot, deleteSlot } from '../src/saves.ts';
import { movePath, importPaths, createEntry, resolveInside } from '../src/inventory.ts';
import { loadProfile, saveProfile, finishRun, startingStatPoints, XP_PER_LEVEL, TITLES } from '../src/profile.ts';
import { ACHIEVEMENTS, DAILY_QUESTS, currentDaily, localDate } from '../src/progress.ts';
import { loadFolderSession, saveFolderSession, appendHistory, type FolderSession } from '../src/sessions.ts';
import type { Difficulty } from '../src/monsters.ts';
import { WEAPONS, DEFAULT_WEAPON_ID, getWeapon } from '../src/weapons.ts';
import { ITEMS } from '../src/items.ts';
import { STATS, STAT_MAX_LEVEL } from '../src/stats.ts';
import { SWORD_MAX_LEVEL } from '../src/forge.ts';
import { isNewerVersion, updateMode, RELEASES_URL, LATEST_RELEASE_API, type UpdateStatus } from '../src/updates.ts';
import { HERO_CLASSES, getHeroClass } from '../src/classes.ts';
import { writeJsonAtomic } from '../src/atomic-write.ts';

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

// The released app has no DevTools and no remote debugging, so the page
// can't be scripted to cheat; PROMPTBATTLE_DEBUG=1 re-enables both (the CI
// smoke test uses it). Development builds keep them.
const DEBUG_ALLOWED = !app.isPackaged || process.env.PROMPTBATTLE_DEBUG === '1';
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
// ⏹ 멈추기: stops the AI turn in progress.
let currentTurnStop: AbortController | null = null;
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
ipcMain.handle('typing-hit', () => {
  const now = Date.now();
  if (now - lastTypingHitAt < TYPING_HIT_MIN_MS) return false;
  lastTypingHitAt = now;
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
ipcMain.handle('open-release-page', () => shell.openExternal(RELEASES_URL));
ipcMain.handle('install-update', () => electronUpdater.autoUpdater.quitAndInstall());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
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
// The weapon (Claude model) in hand; switchable mid-run via set-model.
let currentModel = DEFAULT_WEAPON_ID;

ipcMain.handle('get-setup-info', async () => ({
  profile: await loadProfile(),
  weapons: WEAPONS,
  items: ITEMS,
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
  if (refresh || !capabilityCache.get(dir)) capabilityCache.set(dir, await fetchClaudeCapabilities(dir, claudeEnv()));
  return capabilityCache.get(dir) ?? null;
});
let currentClaude: ClaudeSettings | null = null;
ipcMain.handle('set-claude-settings', async (_event, settings: unknown) => {
  const next = coerceClaudeSettings(settings);
  if (currentClaude?.auth !== next.auth) capabilityCache.clear();
  currentClaude = next;
  await saveProfile({ ...(await loadProfile()), claude: next });
  return next;
});
ipcMain.handle('claude-settings-info', () => ({ levels: EFFORT_LEVELS, attackSpeed: ATTACK_SPEED }));

ipcMain.handle('get-usage', async () => {
  await authReady;
  return fetchPlanUsage(currentCwd ?? app.getPath('home'), claudeEnv());
});

// ---------------------------------------------------------------------------
// Auth: the Claude Code CLI login (default) or an Anthropic API key. The key
// is encrypted with the OS keychain (safeStorage) at rest and never sent back
// to the page — the page only learns whether one is set (and its last 4).
const SECRETS_FILE = path.join(os.homedir(), '.promptbattle', 'secrets.json');
let apiKey: string | undefined;
async function loadApiKey(): Promise<void> {
  try {
    const { anthropicApiKey } = JSON.parse(await fs.readFile(SECRETS_FILE, 'utf-8'));
    if (typeof anthropicApiKey === 'string' && safeStorage.isEncryptionAvailable()) {
      apiKey = safeStorage.decryptString(Buffer.from(anthropicApiKey, 'base64'));
    }
  } catch {
    apiKey = undefined;
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
  return { ...keyInfo(), encryption: safeStorage.isEncryptionAvailable() };
});
ipcMain.handle('set-api-key', async (_event, key: string | null) => {
  await fs.mkdir(path.dirname(SECRETS_FILE), { recursive: true });
  const trimmed = key?.trim();
  if (!trimmed) {
    apiKey = undefined;
    await fs.rm(SECRETS_FILE, { force: true });
  } else {
    if (!safeStorage.isEncryptionAvailable()) return { ok: false, message: '이 컴퓨터에서 키체인 암호화를 쓸 수 없어 저장하지 않았다' };
    apiKey = trimmed;
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
    },
  ) => {
    const profile = await loadProfile();
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
    currentParty = requested.party ?? true;
    await authReady;
    currentClaude = profile.claude;
    const heroClass = getHeroClass(options.heroClass).id;
    currentModel = getWeapon(options.model).model;
    const cwd = currentCwd;
    const send = (event: unknown) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('battle-event', event);
    };

    // The folder's session id + chat log, saved as the run goes so a crash
    // or closed window loses nothing. Saves are chained to never interleave.
    const folder: FolderSession = await loadFolderSession(cwd);
    let saving = Promise.resolve();
    const persistFolder = () => {
      const snapshot = { ...folder, history: [...folder.history], runStates: { ...folder.runStates } };
      saving = saving.then(() => saveFolderSession(cwd, snapshot)).catch(() => {});
    };
    const trackHistory = (event: BattleEvent) => {
      if (event.type === 'turnStart') folder.history = appendHistory(folder.history, { role: 'user', text: event.prompt });
      else if (event.type === 'agentSummary') folder.history = appendHistory(folder.history, { role: 'assistant', text: event.summary });
      else if (event.type === 'agentError') folder.history = appendHistory(folder.history, { role: 'assistant', text: `(오류) ${event.error}` });
      else if (event.type === 'sessionSaved') folder.sessionId = event.sessionId;
      else if (event.type === 'sessionReset') delete folder.sessionId;
      else if (event.type === 'sessionSwitched') folder.sessionId = event.sessionId;
      else return;
      persistFolder();
    };

    const summary = await runDungeon({
      runTurn: async (prompt, cwd, sessionId, onEvent) => {
        const stop = new AbortController();
        currentTurnStop = stop;
        try {
          return await runAgentTurn(prompt, cwd, sessionId, onEvent, {
            model: currentModel, party: currentParty, claude: currentClaude ?? undefined, env: claudeEnv(), signal: stop.signal,
          });
        } finally {
          if (currentTurnStop === stop) currentTurnStop = null;
        }
      },
      cwd,
      difficulty: options.difficulty,
      coins: slot ? slot.coins : profile.coins,
      bag: slot ? slot.bag : profile.bag,
      playerMaxHp: slot ? slot.playerMaxHp : profile.maxHp,
      playerHp: slot?.playerHp,
      monsterHp: slot?.monsterHp,
      bindExternalHit: (fn) => (externalHit = fn),
      getModel: () => currentModel,
      themeId: options.themeId,
      initialSessionId: options.sessionId,
      startFloor: Math.max(0, Math.floor(options.startFloor || 0)),
      getDamageMultiplier: () => getWeapon(currentModel).multiplier * ATTACK_SPEED[(currentClaude ?? profile.claude).effort].multiplier,
      // Hero stats are per-run: fresh each game, restored only from a save slot.
      stats: slot?.stats,
      statPoints: slot ? slot.statPoints : startingStatPoints(profile),
      swordLevel: slot ? slot.swordLevel : profile.swordLevel,
      onBattleEvent: (event: BattleEvent) => {
        trackHistory(event);
        if (event.type !== 'snapshot') {
          send(event);
          return;
        }
        const savedAt = Date.now();
        const data = { ...event.state, savedAt, cwd, themeId: options.themeId, difficulty: options.difficulty, model: currentModel, heroClass };
        if (event.slot === 0) {
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
          writeSlot(event.slot, data).catch(() => {}); // quiet: every floor
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
    const finished = finishRun(profile, summary, options.themeId);
    const updated = { ...finished.profile, heroClass, claude: currentClaude ?? profile.claude };
    await saveProfile(updated);
    await saving;

    const { unlocked, dailyCompleted, rewardCoins } = finished.progress;
    return { summary, profile: updated, progress: { unlocked: unlocked.map(({ done: _done, ...a }) => a), dailyCompleted, rewardCoins } };
  },
);

function insideCwd(filePath: string): string | null {
  if (!currentCwd) return null;
  const resolved = resolveInside(currentCwd, filePath);
  return resolved === currentCwd ? null : resolved;
}

// Inventory drag & drop and "new file/folder" — all confined to the project.
const noProject = { ok: false, message: '진행 중인 프로젝트가 없다' } as const;
ipcMain.handle('move-path', (_event, src: string, destDir: string) => (currentCwd ? movePath(currentCwd, src, destDir) : noProject));
ipcMain.handle('import-files', (_event, sources: string[], destDir: string) =>
  currentCwd ? importPaths(currentCwd, sources, destDir) : { imported: 0, failed: sources },
);
ipcMain.handle('create-entry', (_event, parentDir: string, name: string, kind: 'file' | 'dir') =>
  currentCwd ? createEntry(currentCwd, parentDir, name, kind) : noProject,
);

const TREE_SKIP = new Set(['node_modules', '.git', 'release', 'dist', '.superpowers', '.claude', '.DS_Store']);
const TREE_MAX_ENTRIES = 800;
const TREE_MAX_DEPTH = 6;

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
