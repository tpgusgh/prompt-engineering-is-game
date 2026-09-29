import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadFolderSession, saveFolderSession, appendHistory, HISTORY_LIMIT } from '../src/sessions.ts';

test('unknown folder has no session and empty history', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  assert.deepEqual(await loadFolderSession('/proj/a', dir), { history: [] });
});

test('sessions are stored per folder and round-trip', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  await saveFolderSession('/proj/a', { sessionId: 's-a', history: [{ role: 'user', text: 'hi' }] }, dir);
  await saveFolderSession('/proj/b', { sessionId: 's-b', history: [] }, dir);
  assert.deepEqual(await loadFolderSession('/proj/a', dir), { sessionId: 's-a', history: [{ role: 'user', text: 'hi' }] });
  assert.equal((await loadFolderSession('/proj/b', dir)).sessionId, 's-b');
});

test('corrupt file or bad entries fall back safely', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  await mkdir(path.join(dir, '.promptbattle'), { recursive: true });
  await writeFile(
    path.join(dir, '.promptbattle', 'sessions.json'),
    JSON.stringify({ '/proj/a': { sessionId: 5, history: [{ role: 'user', text: 'ok' }, { role: 'x', text: 'bad' }, 'junk'] } }),
  );
  assert.deepEqual(await loadFolderSession('/proj/a', dir), { history: [{ role: 'user', text: 'ok' }] });
  await writeFile(path.join(dir, '.promptbattle', 'sessions.json'), '{ nope');
  assert.deepEqual(await loadFolderSession('/proj/a', dir), { history: [] });
});

test('appendHistory keeps only the newest HISTORY_LIMIT entries', () => {
  let history: { role: 'user' | 'assistant'; text: string }[] = [];
  for (let i = 0; i < HISTORY_LIMIT + 5; i++) history = appendHistory(history, { role: 'user', text: String(i) });
  assert.equal(history.length, HISTORY_LIMIT);
  assert.equal(history[0].text, '5');
});

test('per-session run states (autosaves) round-trip; invalid ones are dropped', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  const good = {
    savedAt: 1, cwd: '/proj/a', themeId: 'adventure', difficulty: 'normal', model: 'claude-sonnet-5', heroClass: 'wizard',
    floor: 2, playerHp: 60, playerMaxHp: 110, coins: 10, bag: {}, stats: { attack: 0, defense: 0, vitality: 1 },
    statPoints: 0, swordLevel: 0, sessionId: 's-a', monsterHp: 54,
  };
  await saveFolderSession('/proj/a', { sessionId: 's-a', history: [], runStates: { 's-a': good, bad: { floor: 'x' } as never } }, dir);
  const loaded = await loadFolderSession('/proj/a', dir);
  assert.deepEqual(loaded.runStates, { 's-a': good });
});
