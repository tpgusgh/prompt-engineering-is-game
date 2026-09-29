import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { movePath, importPaths, createEntry, resolveInside } from '../src/inventory.ts';

async function project() {
  const root = await mkdtemp(path.join(tmpdir(), 'pb-inv-'));
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'a.txt'), 'A');
  return root;
}
const exists = (p: string) => stat(p).then(() => true, () => false);

test('resolveInside rejects paths that escape the project', async () => {
  const root = await project();
  assert.equal(resolveInside(root, path.join(root, 'src')), path.join(root, 'src'));
  assert.equal(resolveInside(root, path.join(root, '..', 'x')), null);
  assert.equal(resolveInside(root, root), root, 'the root itself is a valid drop target');
});

test('movePath moves a file into a folder', async () => {
  const root = await project();
  const r = await movePath(root, path.join(root, 'a.txt'), path.join(root, 'src'));
  assert.ok(r.ok);
  assert.equal(await readFile(path.join(root, 'src', 'a.txt'), 'utf-8'), 'A');
  assert.equal(await exists(path.join(root, 'a.txt')), false);
});

test('movePath refuses overwriting, moving a folder into itself, and escaping the project', async () => {
  const root = await project();
  await writeFile(path.join(root, 'src', 'a.txt'), 'other');
  assert.equal((await movePath(root, path.join(root, 'a.txt'), path.join(root, 'src'))).ok, false);
  await mkdir(path.join(root, 'src', 'deep'));
  assert.equal((await movePath(root, path.join(root, 'src'), path.join(root, 'src', 'deep'))).ok, false);
  assert.equal((await movePath(root, path.join(root, 'a.txt'), path.join(root, '..'))).ok, false);
});

test('importPaths copies outside files/folders in, never overwriting', async () => {
  const root = await project();
  const outside = await mkdtemp(path.join(tmpdir(), 'pb-out-'));
  await writeFile(path.join(outside, 'new.md'), '# hi');
  await mkdir(path.join(outside, 'assets'));
  await writeFile(path.join(outside, 'assets', 'x.png'), 'png');
  await writeFile(path.join(outside, 'a.txt'), 'clash');
  const r = await importPaths(root, [path.join(outside, 'new.md'), path.join(outside, 'assets'), path.join(outside, 'a.txt')], path.join(root, 'src'));
  assert.equal(r.imported, 3);
  assert.equal(await readFile(path.join(root, 'src', 'new.md'), 'utf-8'), '# hi');
  assert.equal(await readFile(path.join(root, 'src', 'assets', 'x.png'), 'utf-8'), 'png');
  assert.equal(await readFile(path.join(root, 'src', 'a.txt'), 'utf-8'), 'clash', 'no clash inside src/');
  const again = await importPaths(root, [path.join(outside, 'new.md')], path.join(root, 'src'));
  assert.equal(await readFile(path.join(root, 'src', 'new (1).md'), 'utf-8'), '# hi', 'a name clash gets a numbered copy');
  assert.equal(again.imported, 1);
  assert.equal(await readFile(path.join(outside, 'new.md'), 'utf-8'), '# hi', 'the original stays put');
});

test('createEntry makes a file or folder; rejects bad names and existing entries', async () => {
  const root = await project();
  assert.ok((await createEntry(root, path.join(root, 'src'), 'main.ts', 'file')).ok);
  assert.equal(await readFile(path.join(root, 'src', 'main.ts'), 'utf-8'), '');
  assert.ok((await createEntry(root, root, 'docs', 'dir')).ok);
  assert.ok((await stat(path.join(root, 'docs'))).isDirectory());
  assert.equal((await createEntry(root, root, 'a.txt', 'file')).ok, false, 'exists');
  assert.equal((await createEntry(root, root, '../evil', 'file')).ok, false);
  assert.equal((await createEntry(root, root, '', 'dir')).ok, false);
  assert.equal((await createEntry(root, root, 'x/y', 'file')).ok, false);
});
