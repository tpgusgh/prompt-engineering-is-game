import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadProfile, saveProfile, levelForXp, addXp } from '../src/profile.ts';

test('loadProfile returns defaults when no file exists', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  const profile = await loadProfile(dir);
  assert.deepEqual(profile, { level: 1, xp: 0, totalWins: 0, totalBattles: 0, storyChapters: {} });
});

test('saveProfile then loadProfile round-trips', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  await saveProfile({ level: 3, xp: 250, totalWins: 5, totalBattles: 6, storyChapters: { adventure: 1 } }, dir);
  const profile = await loadProfile(dir);
  assert.deepEqual(profile, { level: 3, xp: 250, totalWins: 5, totalBattles: 6, storyChapters: { adventure: 1 } });
});

test('loadProfile falls back to defaults on corrupted JSON', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  await mkdir(path.join(dir, '.promptbattle'), { recursive: true });
  await writeFile(path.join(dir, '.promptbattle', 'profile.json'), '{ not valid json', 'utf-8');
  const profile = await loadProfile(dir);
  assert.deepEqual(profile, { level: 1, xp: 0, totalWins: 0, totalBattles: 0, storyChapters: {} });
});

test('loadProfile coerces a field with the wrong type back to its default instead of trusting it', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  await mkdir(path.join(dir, '.promptbattle'), { recursive: true });
  await writeFile(
    path.join(dir, '.promptbattle', 'profile.json'),
    JSON.stringify({ level: 5, xp: '50', totalWins: null, totalBattles: 12 }),
    'utf-8',
  );
  const profile = await loadProfile(dir);
  assert.deepEqual(profile, { level: 5, xp: 0, totalWins: 0, totalBattles: 12, storyChapters: {} }, 'good fields kept, bad-typed fields fall back individually');
});

test('loadProfile rejects negative, fractional, and non-finite counts, not just wrong types', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  await mkdir(path.join(dir, '.promptbattle'), { recursive: true });
  await writeFile(
    path.join(dir, '.promptbattle', 'profile.json'),
    JSON.stringify({ level: 0, xp: -5, totalWins: 2.5, totalBattles: Infinity }),
    'utf-8',
  );
  const profile = await loadProfile(dir);
  assert.deepEqual(profile, { level: 1, xp: 0, totalWins: 0, totalBattles: 0, storyChapters: {} });
});

test('storyChapters round-trips and keeps only valid non-negative integer entries', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  await mkdir(path.join(dir, '.promptbattle'), { recursive: true });
  await writeFile(
    path.join(dir, '.promptbattle', 'profile.json'),
    JSON.stringify({ level: 2, xp: 120, totalWins: 3, totalBattles: 4, storyChapters: { 'demon-king': 2, bad: -1, worse: 'x' } }),
    'utf-8',
  );
  const profile = await loadProfile(dir);
  assert.deepEqual(profile.storyChapters, { 'demon-king': 2 });
});

test('levelForXp follows a flat 100-xp-per-level curve', () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(99), 1);
  assert.equal(levelForXp(100), 2);
  assert.equal(levelForXp(349), 4);
});

test('addXp updates both xp and level', () => {
  const updated = addXp({ level: 1, xp: 80, totalWins: 0, totalBattles: 0, storyChapters: {} }, 30);
  assert.equal(updated.xp, 110);
  assert.equal(updated.level, 2);
});
