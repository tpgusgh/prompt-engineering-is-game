// electron/main.ts
import electron from 'electron';
const { app, BrowserWindow, ipcMain, dialog } = electron;
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { runDungeon, type BattleEvent } from '../src/battle.ts';
import { runAgentTurn, fetchPlanUsage, listFolderSessions, loadSessionHistory } from '../src/agent.ts';
import { loadSlots, writeSlot } from '../src/saves.ts';
import { movePath, importPaths, createEntry, resolveInside } from '../src/inventory.ts';
import { loadProfile, saveProfile, applyRun } from '../src/profile.ts';
import { loadFolderSession, saveFolderSession, appendHistory, type FolderSession } from '../src/sessions.ts';
import type { Difficulty } from '../src/monsters.ts';
import { WEAPONS, DEFAULT_WEAPON_ID, getWeapon } from '../src/weapons.ts';
import { ITEMS } from '../src/items.ts';
import { STATS, STAT_MAX_LEVEL } from '../src/stats.ts';
import { SWORD_MAX_LEVEL } from '../src/forge.ts';
import { HERO_CLASSES, getHeroClass } from '../src/classes.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Only in a packaged app does the SDK's native `claude` binary need to be
// found at its asarUnpack'd path instead of the SDK's own default lookup —
// see the comment on executableOverrideOptions() in src/agent.ts. Mac
// arm64-only for v1, matching this project's only electron-builder target.
if (app.isPackaged) {
  process.env.PROMPTBATTLE_CLAUDE_EXECUTABLE = path.join(
    process.resourcesPath,
    'app.asar.unpacked',
    'node_modules',
    '@anthropic-ai/claude-agent-sdk-darwin-arm64',
    'claude',
  );
}

let mainWindow: InstanceType<typeof BrowserWindow> | null = null;

// One dungeon run at a time, one window: a single pending resolver is enough.
// A multi-window/multi-run version would need a per-session map instead.
let pendingInputResolve: ((value: string | null) => void) | null = null;
// Slash commands sent while a turn is running (the waiting mini-game's
// /bonus, a stat button...) wait here for the next readInput instead of
// being dropped. Plain prompts are never queued: the UI disables them mid-turn.
let queuedCommands: string[] = [];

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
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
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

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
}));

ipcMain.handle('get-usage', () => fetchPlanUsage(currentCwd ?? app.getPath('home')));

ipcMain.handle('set-model', (_event, model: string) => {
  const weapon = getWeapon(model);
  currentModel = weapon.model;
  return weapon;
});

ipcMain.handle('get-folder-session', (_event, cwd: string) => loadFolderSession(path.resolve(cwd)));
ipcMain.handle('list-sessions', (_event, cwd: string) => listFolderSessions(path.resolve(cwd)));
ipcMain.handle('session-history', (_event, cwd: string, sessionId: string) => loadSessionHistory(sessionId, path.resolve(cwd)));
ipcMain.handle('list-slots', () => loadSlots());

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
    const slot = requested.loadSlot ? (await loadSlots())[requested.loadSlot - 1] : null;
    if (requested.loadSlot && !slot) throw new Error(`슬롯 ${requested.loadSlot}이(가) 비어 있습니다.`);
    const options = slot
      ? { ...requested, cwd: slot.cwd, difficulty: slot.difficulty, model: slot.model, themeId: slot.themeId, startFloor: slot.floor, sessionId: slot.sessionId, heroClass: slot.heroClass ?? requested.heroClass }
      : requested;
    currentCwd = path.resolve(options.cwd);
    queuedCommands = [];
    const party = requested.party ?? true;
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
      const snapshot = { ...folder, history: [...folder.history] };
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
      runTurn: (prompt, cwd, sessionId, onEvent) => runAgentTurn(prompt, cwd, sessionId, onEvent, currentModel, party),
      cwd,
      difficulty: options.difficulty,
      coins: slot ? slot.coins : profile.coins,
      bag: slot ? slot.bag : profile.bag,
      playerMaxHp: slot ? slot.playerMaxHp : profile.maxHp,
      playerHp: slot?.playerHp,
      monsterHp: slot?.monsterHp,
      initialSessionId: options.sessionId,
      startFloor: Math.max(0, Math.floor(options.startFloor || 0)),
      getDamageMultiplier: () => getWeapon(currentModel).multiplier,
      // Hero stats are per-run: fresh each game, restored only from a save slot.
      stats: slot?.stats,
      statPoints: slot?.statPoints,
      swordLevel: slot ? slot.swordLevel : profile.swordLevel,
      onBattleEvent: (event: BattleEvent) => {
        trackHistory(event);
        send(event);
        if (event.type === 'snapshot') {
          const savedAt = Date.now();
          const data = { ...event.state, savedAt, cwd, themeId: options.themeId, difficulty: options.difficulty, model: currentModel, heroClass };
          writeSlot(event.slot, data)
            .then(() => send({ type: 'slotSaved', slot: event.slot, data }))
            .catch((err) => send({ type: 'saveFailed', reason: err instanceof Error ? err.message : String(err) }));
        }
      },
      readInput: () =>
        queuedCommands.length > 0
          ? Promise.resolve(queuedCommands.shift()!)
          : new Promise<string | null>((resolve) => {
              pendingInputResolve = resolve;
            }),
    });

    const updated = { ...applyRun(profile, summary, options.themeId), heroClass };
    await saveProfile(updated);
    await saving;

    return { summary, profile: updated };
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
