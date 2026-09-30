import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadSlots, writeSlot, deleteSlot, SLOT_COUNT, type SaveSlot } from '../src/saves.ts';

const slot: SaveSlot = {
  savedAt: 1700000000000, cwd: '/proj', themeId: 'adventure', difficulty: 'normal', model: 'claude-sonnet-5',
  floor: 4, playerHp: 50, playerMaxHp: 110, coins: 33, bag: { potion: 1 },
  stats: { attack: 1, defense: 0, vitality: 1 }, statPoints: 2, swordLevel: 3, sessionId: 's1', monsterHp: 20,
};

test('three manual slots plus the auto slot, empty by default', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  assert.equal(SLOT_COUNT, 3);
  assert.deepEqual(await loadSlots(dir), [null, null, null, null]);
  await writeSlot(4, slot, dir);
  assert.deepEqual((await loadSlots(dir))[3], slot);
});

test('writeSlot round-trips into the right slot', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  await writeSlot(2, slot, dir);
  assert.deepEqual(await loadSlots(dir), [null, slot, null, null]);
});

test('invalid slot data loads as empty', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  await mkdir(path.join(dir, '.promptbattle'), { recursive: true });
  await writeFile(path.join(dir, '.promptbattle', 'saves.json'), JSON.stringify({ 1: { floor: 'x' }, 3: slot }));
  assert.deepEqual(await loadSlots(dir), [null, null, slot, null]);
});

test('deleteSlot empties just that slot', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  await writeSlot(1, slot, dir);
  await writeSlot(2, slot, dir);
  await deleteSlot(1, dir);
  assert.deepEqual(await loadSlots(dir), [null, slot, null, null]);
});
