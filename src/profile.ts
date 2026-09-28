import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface Profile {
  level: number;
  xp: number;
  totalWins: number;
  totalBattles: number;
}

const DEFAULT_PROFILE: Profile = { level: 1, xp: 0, totalWins: 0, totalBattles: 0 };

function profilePath(homeDir: string): string {
  return path.join(homeDir, '.promptbattle', 'profile.json');
}

export async function loadProfile(homeDir: string = os.homedir()): Promise<Profile> {
  try {
    const raw = await fs.readFile(profilePath(homeDir), 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export async function saveProfile(profile: Profile, homeDir: string = os.homedir()): Promise<void> {
  const filePath = profilePath(homeDir);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(profile, null, 2), 'utf-8');
}

export function levelForXp(xp: number): number {
  return Math.floor(xp / 100) + 1;
}

export function addXp(profile: Profile, gained: number): Profile {
  const xp = profile.xp + gained;
  return { ...profile, xp, level: levelForXp(xp) };
}
