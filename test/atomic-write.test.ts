import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { writeJsonAtomic } from '../src/atomic-write.ts';

test('writeJsonAtomic writes the JSON, creating the folder, and leaves no temp files', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pb-atomic-'));
  const file = path.join(dir, 'nested', 'profile.json');
  await writeJsonAtomic(file, { level: 2 });
  assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf-8')), { level: 2 });
  assert.deepEqual(await fs.readdir(path.dirname(file)), ['profile.json']);
});

test('concurrent writes never leave a truncated file', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pb-atomic-'));
  const file = path.join(dir, 'profile.json');
  await Promise.all(Array.from({ length: 20 }, (_, i) => writeJsonAtomic(file, { i, pad: 'x'.repeat(5000) })));
  const parsed = JSON.parse(await fs.readFile(file, 'utf-8'));
  assert.equal(typeof parsed.i, 'number');
  assert.deepEqual(await fs.readdir(dir), ['profile.json']);
});
