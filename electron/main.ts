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
      mainWindow?.webContents.send('battle-event', event);
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
