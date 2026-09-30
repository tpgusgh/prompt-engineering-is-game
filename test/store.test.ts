import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readStore, writeStore, StoreTamperedError } from '../src/store.ts';

const tmpHome = () => fs.mkdtemp(path.join(os.tmpdir(), 'pb-store-'));
const fileIn = (home: string, name: string) => path.join(home, '.promptbattle', name);

test('a written store reads back, and the file on disk is not readable JSON', async () => {
  const home = await tmpHome();
  const file = fileIn(home, 'profile.json');
  await writeStore(file, { level: 7 }, home);
  assert.deepEqual(await readStore(file, home), { level: 7 });
  const raw = await fs.readFile(file, 'utf-8');
  assert.ok(!raw.includes('level'), 'obfuscated on disk');
});

test('editing the saved file is detected', async () => {
  const home = await tmpHome();
  const file = fileIn(home, 'profile.json');
  await writeStore(file, { level: 7 }, home);
  const raw = await fs.readFile(file, 'utf-8');
  const flipped = raw.slice(0, -6) + (raw.at(-6) === 'A' ? 'B' : 'A') + raw.slice(-5);
  await fs.writeFile(file, flipped);
  await assert.rejects(readStore(file, home), StoreTamperedError);
});

test('replacing it with hand-written JSON is rejected once the key exists', async () => {
  const home = await tmpHome();
  const file = fileIn(home, 'profile.json');
  await writeStore(file, { level: 1 }, home);
  await fs.writeFile(file, JSON.stringify({ level: 999 }));
  await assert.rejects(readStore(file, home), StoreTamperedError);
});

test('old plain-JSON saves are migrated once on first use', async () => {
  const home = await tmpHome();
  await fs.mkdir(path.join(home, '.promptbattle'), { recursive: true });
  await fs.writeFile(fileIn(home, 'profile.json'), JSON.stringify({ level: 3 }));
  await fs.writeFile(fileIn(home, 'saves.json'), JSON.stringify({ 1: { floor: 2 } }));
  assert.deepEqual(await readStore(fileIn(home, 'saves.json'), home), { 1: { floor: 2 } });
  assert.deepEqual(await readStore(fileIn(home, 'profile.json'), home), { level: 3 });
  assert.ok(!(await fs.readFile(fileIn(home, 'profile.json'), 'utf-8')).includes('level'), 'rewritten encrypted');
});

test('a missing store is a plain ENOENT, not tampering', async () => {
  const home = await tmpHome();
  await assert.rejects(readStore(fileIn(home, 'sessions.json'), home), (err: any) => err.code === 'ENOENT');
});
