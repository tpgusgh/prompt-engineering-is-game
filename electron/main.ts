// electron/main.ts
import electron from 'electron';
const { app, BrowserWindow, ipcMain, dialog } = electron;
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
