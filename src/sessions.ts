import path from 'node:path';
import os from 'node:os';
import { isSaveSlot, type SaveSlot } from './saves.ts';
import { readStore, writeStore } from './store.ts';

// Per project folder: the Claude session to resume and the chat log shown
// when the folder is opened again.
export interface ChatEntry {
  role: 'user' | 'assistant';
  text: string;
}

export interface FolderSession {
  sessionId?: string;
  history: ChatEntry[];
  // Autosaved game state per Claude session id: resuming a session resumes
  // its run (floor, HP, monster HP, stats...) too.
  runStates?: Record<string, SaveSlot>;
}

export const HISTORY_LIMIT = 200;

function storePath(homeDir: string): string {
  return path.join(homeDir, '.promptbattle', 'sessions.json');
}

async function loadAll(homeDir: string): Promise<Record<string, unknown>> {
  try {
    const parsed = (await readStore(storePath(homeDir), homeDir)) as any;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function coerce(value: unknown): FolderSession {
  const v = value as { sessionId?: unknown; history?: unknown; runStates?: unknown } | null | undefined;
  const history = Array.isArray(v?.history)
    ? v.history.filter(
        (e): e is ChatEntry => !!e && (e.role === 'user' || e.role === 'assistant') && typeof e.text === 'string',
      )
    : [];
  const runStates: Record<string, SaveSlot> = {};
  if (v?.runStates && typeof v.runStates === 'object') {
    for (const [id, state] of Object.entries(v.runStates)) if (isSaveSlot(state)) runStates[id] = state;
  }
  return {
    ...(typeof v?.sessionId === 'string' ? { sessionId: v.sessionId } : {}),
    history,
    ...(Object.keys(runStates).length ? { runStates } : {}),
  };
}

export async function loadFolderSession(cwd: string, homeDir: string = os.homedir()): Promise<FolderSession> {
  return coerce((await loadAll(homeDir))[cwd]);
}

// ponytail: read-modify-write of one JSON file; callers in one process must
// serialize saves (main.ts chains them). Fine for one app window.
export async function saveFolderSession(cwd: string, session: FolderSession, homeDir: string = os.homedir()): Promise<void> {
  const all = await loadAll(homeDir);
  all[cwd] = session;
  await writeStore(storePath(homeDir), all, homeDir);
}

export function appendHistory(history: ChatEntry[], entry: ChatEntry): ChatEntry[] {
  return [...history, entry].slice(-HISTORY_LIMIT);
}
