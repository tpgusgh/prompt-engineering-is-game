// electron/main.ts
import electron from 'electron';
const { app, BrowserWindow, ipcMain, dialog } = electron;
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { runDungeon, type BattleEvent } from '../src/battle.ts';
import { runAgentTurn } from '../src/agent.ts';
import { loadProfile, saveProfile, addXp } from '../src/profile.ts';
import type { Difficulty } from '../src/monsters.ts';
import { WEAPONS, DEFAULT_WEAPON_ID, getWeapon } from '../src/weapons.ts';

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

ipcMain.handle('get-setup-info', async () => ({ profile: await loadProfile(), weapons: WEAPONS }));

ipcMain.handle('set-model', (_event, model: string) => {
  const weapon = getWeapon(model);
  currentModel = weapon.model;
  return weapon;
});

ipcMain.handle(
  'start-run',
  async (_event, options: { cwd: string; difficulty: Difficulty; model: string; themeId: string; startFloor: number }) => {
    const profile = await loadProfile();
    currentCwd = path.resolve(options.cwd);
    currentModel = getWeapon(options.model).model;

    const summary = await runDungeon({
      runTurn: (prompt, cwd, sessionId, onEvent) => runAgentTurn(prompt, cwd, sessionId, onEvent, currentModel),
      cwd: currentCwd,
      difficulty: options.difficulty,
      startFloor: Math.max(0, Math.floor(options.startFloor || 0)),
      getDamageMultiplier: () => getWeapon(currentModel).multiplier,
      onBattleEvent: (event: BattleEvent) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('battle-event', event);
      },
      readInput: () =>
        new Promise<string | null>((resolve) => {
          pendingInputResolve = resolve;
        }),
    });

    const updated = addXp(profile, summary.xpGained);
    updated.totalWins += summary.floorsCleared;
    updated.totalBattles += summary.floorsEngaged;
    updated.storyChapters = {
      ...updated.storyChapters,
      [options.themeId]: Math.max(updated.storyChapters[options.themeId] ?? 0, summary.chaptersCleared),
    };
    await saveProfile(updated);

    return { summary, profile: updated };
  },
);

function insideCwd(filePath: string): string | null {
  if (!currentCwd) return null;
  const resolved = path.resolve(currentCwd, filePath);
  const rel = path.relative(currentCwd, resolved);
  return rel === '' || rel.startsWith('..') || path.isAbsolute(rel) ? null : resolved;
}

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
  }
});

ipcMain.on('flee', () => {
  if (pendingInputResolve) {
    const resolve = pendingInputResolve;
    pendingInputResolve = null;
    resolve('/flee');
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
