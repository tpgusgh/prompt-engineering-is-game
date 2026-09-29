import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { relabelForListing } from '../src/transcripts.ts';

const ID = '857472b2-f59a-477e-8154-2c3e609a3f2f';

async function setup(lines: object[]) {
  const projects = await mkdtemp(path.join(tmpdir(), 'pb-projects-'));
  const dir = path.join(projects, '-Users-me-proj');
  await mkdir(dir);
  const file = path.join(dir, `${ID}.jsonl`);
  await writeFile(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return { projects, file };
}

test('relabels SDK entrypoints to cli so the session is listed, leaving everything else intact', async () => {
  const { projects, file } = await setup([
    { type: 'user', entrypoint: 'sdk-cli', message: { content: 'the word "entrypoint":"sdk-ts" inside text stays' } },
    { type: 'assistant', entrypoint: 'sdk-ts', uuid: 'u2' },
    { type: 'ai-title', title: 'x' },
  ]);
  assert.equal(await relabelForListing(ID, projects), true);
  const lines = (await readFile(file, 'utf-8')).trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines[0].entrypoint, 'cli');
  assert.equal(lines[0].message.content, 'the word "entrypoint":"sdk-ts" inside text stays');
  assert.equal(lines[1].entrypoint, 'cli');
  assert.equal(lines[1].uuid, 'u2');
  assert.deepEqual(lines[2], { type: 'ai-title', title: 'x' });
});

test('no change needed, unknown session, or bad id: returns false and writes nothing', async () => {
  const { projects } = await setup([{ type: 'user', entrypoint: 'claude-vscode' }]);
  assert.equal(await relabelForListing(ID, projects), false);
  assert.equal(await relabelForListing('00000000-0000-0000-0000-000000000000', projects), false);
  assert.equal(await relabelForListing('../../etc/passwd', projects), false);
});
