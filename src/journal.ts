// 모험 일지: what the AI did in each project folder, day by day — turns,
// floors cleared, tests passed, tokens, the files it touched and the prompts
// that were sent. Kept encrypted in ~/.promptbattle/journal.json.
import path from 'node:path';
import { readStore, writeStore } from './store.ts';
import { dataHome } from './home.ts';

export interface JournalDay {
  turns: number;
  floorsCleared: number;
  testsPassed: number;
  tokens: number;
  files: string[];
  prompts: string[];
}
// folder → local date (YYYY-MM-DD) → that day
export type Journal = Record<string, Record<string, JournalDay>>;

export const MAX_DAYS = 60; // per folder
export const MAX_FOLDERS = 30;
const MAX_FILES = 200;
const MAX_PROMPTS = 50;
const PROMPT_CHARS = 120;

const emptyDay = (): JournalDay => ({ turns: 0, floorsCleared: 0, testsPassed: 0, tokens: 0, files: [], prompts: [] });

export type JournalDelta = Partial<Omit<JournalDay, 'files' | 'prompts'>> & { files?: string[]; prompts?: string[] };

// Folds a delta into a day, keeping the newest days and folders within bounds.
export function addToJournal(journal: Journal, folder: string, date: string, delta: JournalDelta): Journal {
  const days = { ...(journal[folder] ?? {}) };
  const day = { ...(days[date] ?? emptyDay()) };
  for (const k of ['turns', 'floorsCleared', 'testsPassed', 'tokens'] as const) day[k] += Math.max(0, delta[k] ?? 0);
  day.files = [...new Set([...day.files, ...(delta.files ?? [])])].slice(-MAX_FILES);
  day.prompts = [...day.prompts, ...(delta.prompts ?? []).map((p) => p.replace(/\s+/g, ' ').trim().slice(0, PROMPT_CHARS)).filter(Boolean)].slice(-MAX_PROMPTS);
  days[date] = day;
  const keptDays = Object.fromEntries(Object.entries(days).sort(([a], [b]) => b.localeCompare(a)).slice(0, MAX_DAYS));
  // The folder just written goes last (newest); the oldest folders drop off.
  const { [folder]: _old, ...others } = journal;
  const folders = Object.entries(others).slice(-(MAX_FOLDERS - 1));
  return { ...Object.fromEntries(folders), [folder]: keptDays };
}

const file = (homeDir: string) => path.join(homeDir, '.promptbattle', 'journal.json');

export async function loadJournal(homeDir: string = dataHome()): Promise<Journal> {
  try {
    const v = (await readStore(file(homeDir), homeDir)) as Journal;
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

// Writes run one after another (each turn and the run's end both write).
let queue: Promise<unknown> = Promise.resolve();
export function recordJournal(folder: string, date: string, delta: JournalDelta, homeDir: string = dataHome()): Promise<void> {
  const next = queue.then(async () => writeStore(file(homeDir), addToJournal(await loadJournal(homeDir), folder, date, delta), homeDir));
  queue = next.catch(() => {});
  return next;
}
