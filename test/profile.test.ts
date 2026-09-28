import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadProfile, saveProfile, levelForXp, addXp } from '../src/profile.ts';

test('loadProfile returns defaults when no file exists', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  const profile = await loadProfile(dir);
  assert.deepEqual(profile, { level: 1, xp: 0, totalWins: 0, totalBattles: 0 });
});

test('saveProfile then loadProfile round-trips', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  await saveProfile({ level: 3, xp: 250, totalWins: 5, totalBattles: 6 }, dir);
  const profile = await loadProfile(dir);
  assert.deepEqual(profile, { level: 3, xp: 250, totalWins: 5, totalBattles: 6 });
});

test('loadProfile falls back to defaults on corrupted JSON', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  await mkdir(path.join(dir, '.promptbattle'), { recursive: true });
  await writeFile(path.join(dir, '.promptbattle', 'profile.json'), '{ not valid json', 'utf-8');
  const profile = await loadProfile(dir);
  assert.deepEqual(profile, { level: 1, xp: 0, totalWins: 0, totalBattles: 0 });
});

test('levelForXp follows a flat 100-xp-per-level curve', () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(99), 1);
  assert.equal(levelForXp(100), 2);
  assert.equal(levelForXp(349), 4);
});

test('addXp updates both xp and level', () => {
  const updated = addXp({ level: 1, xp: 80, totalWins: 0, totalBattles: 0 }, 30);
  assert.equal(updated.xp, 110);
  assert.equal(updated.level, 2);
});
