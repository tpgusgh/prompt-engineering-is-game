import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Per project folder: the Claude session to resume and the chat log shown
// when the folder is opened again.
export interface ChatEntry {
  role: 'user' | 'assistant';
  text: string;
}

export interface FolderSession {
  sessionId?: string;
  history: ChatEntry[];
}

export const HISTORY_LIMIT = 200;

function storePath(homeDir: string): string {
  return path.join(homeDir, '.promptbattle', 'sessions.json');
}

async function loadAll(homeDir: string): Promise<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(await fs.readFile(storePath(homeDir), 'utf-8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function coerce(value: unknown): FolderSession {
  const v = value as { sessionId?: unknown; history?: unknown } | null | undefined;
  const history = Array.isArray(v?.history)
    ? v.history.filter(
        (e): e is ChatEntry => !!e && (e.role === 'user' || e.role === 'assistant') && typeof e.text === 'string',
      )
    : [];
  return typeof v?.sessionId === 'string' ? { sessionId: v.sessionId, history } : { history };
}

export async function loadFolderSession(cwd: string, homeDir: string = os.homedir()): Promise<FolderSession> {
  return coerce((await loadAll(homeDir))[cwd]);
}

// ponytail: read-modify-write of one JSON file; callers in one process must
// serialize saves (main.ts chains them). Fine for one app window.
export async function saveFolderSession(cwd: string, session: FolderSession, homeDir: string = os.homedir()): Promise<void> {
  const all = await loadAll(homeDir);
  all[cwd] = session;
  const file = storePath(homeDir);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(all, null, 2), 'utf-8');
}

export function appendHistory(history: ChatEntry[], entry: ChatEntry): ChatEntry[] {
  return [...history, entry].slice(-HISTORY_LIMIT);
}
