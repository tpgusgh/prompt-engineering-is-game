import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { addToJournal, loadJournal, recordJournal, MAX_DAYS, MAX_FOLDERS } from '../src/journal.ts';

test('journal: deltas add up per folder and day; files are unique, prompts trimmed', () => {
  let j = addToJournal({}, '/p', '2026-10-01', { turns: 1, files: ['a.ts'], prompts: ['  fix   the bug  '] });
  j = addToJournal(j, '/p', '2026-10-01', { turns: 2, testsPassed: 3, tokens: 500, floorsCleared: 1, files: ['a.ts', 'b.ts'] });
  assert.deepEqual(j['/p']['2026-10-01'], { turns: 3, floorsCleared: 1, testsPassed: 3, tokens: 500, files: ['a.ts', 'b.ts'], prompts: ['fix the bug'] });
});

test('journal: keeps the newest days per folder and the newest folders', () => {
  let j = {};
  for (let d = 1; d <= MAX_DAYS + 5; d++) j = addToJournal(j, '/p', `2026-${String(Math.ceil(d / 28)).padStart(2, '0')}-${String(((d - 1) % 28) + 1).padStart(2, '0')}`, { turns: 1 });
  assert.equal(Object.keys(j['/p']).length, MAX_DAYS);
  for (let f = 0; f < MAX_FOLDERS + 3; f++) j = addToJournal(j, `/f${f}`, '2026-10-01', { turns: 1 });
  assert.equal(Object.keys(j).length, MAX_FOLDERS);
  assert.ok(j[`/f${MAX_FOLDERS + 2}`] && !j['/p']);
});

test('journal: recorded to disk, writes one after another', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'pb-journal-'));
  await Promise.all([recordJournal('/p', '2026-10-01', { turns: 1 }, home), recordJournal('/p', '2026-10-01', { turns: 1 }, home)]);
  assert.equal((await loadJournal(home))['/p']['2026-10-01'].turns, 2);
});
