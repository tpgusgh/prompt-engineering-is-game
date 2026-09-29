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

ipcMain.handle('start-run', async (_event, options: { cwd: string; difficulty: Difficulty }) => {
  const profile = await loadProfile();

  const summary = await runDungeon({
    runTurn: runAgentTurn,
    cwd: options.cwd,
    difficulty: options.difficulty,
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
  await saveProfile(updated);

  return { summary, profile: updated };
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
