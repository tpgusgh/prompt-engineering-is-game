// electron/preload.cjs
// Plain CommonJS, not TypeScript: Electron's sandboxed preload scripts ignore
// package.json's "type": "module" and run without an ESM context at all
// (https://www.electronjs.org/docs/latest/tutorial/esm — preload scripts need
// .mjs for ESM, and sandboxed preload has no ESM context). This is the one
// file in the project that isn't native-TS, because the platform doesn't
// support it here, not because it was skipped.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('promptBattle', {
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  startRun: (options) => ipcRenderer.invoke('start-run', options),
  submitPrompt: (text) => ipcRenderer.send('submit-prompt', text),
  getUsage: () => ipcRenderer.invoke('get-usage'),
  listSessions: (cwd) => ipcRenderer.invoke('list-sessions', cwd),
  sessionHistory: (cwd, sessionId) => ipcRenderer.invoke('session-history', cwd, sessionId),
  listSlots: () => ipcRenderer.invoke('list-slots'),
  getFolderSession: (cwd) => ipcRenderer.invoke('get-folder-session', cwd),
  onBattleEvent: (callback) => {
    ipcRenderer.on('battle-event', (_event, data) => callback(data));
  },
  getFileIcon: (path) => ipcRenderer.invoke('get-file-icon', path),
  readFileContent: (path) => ipcRenderer.invoke('read-file-content', path),
  getSetupInfo: () => ipcRenderer.invoke('get-setup-info'),
  setModel: (model) => ipcRenderer.invoke('set-model', model),
  listTree: () => ipcRenderer.invoke('list-tree'),
  writeFile: (path, content) => ipcRenderer.invoke('write-file', path, content),
});
