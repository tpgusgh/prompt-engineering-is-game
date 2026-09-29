import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SAVE_SLOTS, AUTO_SAVE_SLOT, type RunState } from './battle.ts';

export const SLOT_COUNT = SAVE_SLOTS;

// A manual save: the run's state plus what's needed to restart it.
export interface SaveSlot extends RunState {
  savedAt: number;
  cwd: string;
  themeId: string;
  difficulty: 'easy' | 'normal' | 'hard';
  model: string;
  heroClass?: string;
}

function storePath(homeDir: string): string {
  return path.join(homeDir, '.promptbattle', 'saves.json');
}

const isCount = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isCounts = (v: unknown) =>
  !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(isCount);

export function isSaveSlot(v: any): v is SaveSlot {
  return (
    !!v &&
    isCount(v.savedAt) &&
    typeof v.cwd === 'string' &&
    typeof v.themeId === 'string' &&
    ['easy', 'normal', 'hard'].includes(v.difficulty) &&
    typeof v.model === 'string' &&
    [v.floor, v.playerHp, v.playerMaxHp, v.coins, v.statPoints, v.swordLevel].every(isCount) &&
    isCounts(v.bag) &&
    isCounts(v.stats) &&
    (v.sessionId === undefined || typeof v.sessionId === 'string') &&
    (v.monsterHp === undefined || isCount(v.monsterHp))
  );
}

async function loadRaw(homeDir: string): Promise<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(await fs.readFile(storePath(homeDir), 'utf-8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// Slots 1..SLOT_COUNT plus the auto slot (last) as an array (index 0 = slot
// 1); empty or invalid = null.
export async function loadSlots(homeDir: string = os.homedir()): Promise<(SaveSlot | null)[]> {
  const raw = await loadRaw(homeDir);
  return Array.from({ length: AUTO_SAVE_SLOT }, (_, i) => {
    const v = raw[String(i + 1)];
    return isSaveSlot(v) ? v : null;
  });
}

export async function writeSlot(slot: number, data: SaveSlot, homeDir: string = os.homedir()): Promise<void> {
  const raw = await loadRaw(homeDir);
  raw[String(slot)] = data;
  const file = storePath(homeDir);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(raw, null, 2), 'utf-8');
}
