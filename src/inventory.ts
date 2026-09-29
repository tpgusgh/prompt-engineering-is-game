import { promises as fs } from 'node:fs';
import path from 'node:path';

// File operations behind the inventory sidebar. Every target is confined to
// the project folder (root); sources dropped in from outside are copied, never
// moved, and nothing is ever overwritten.
export type OpResult = { ok: true; path: string } | { ok: false; message: string };

export function resolveInside(root: string, p: string): string | null {
  const resolved = path.resolve(root, p);
  const rel = path.relative(root, resolved);
  return rel.startsWith('..') || path.isAbsolute(rel) ? null : resolved;
}

const exists = (p: string) => fs.stat(p).then(() => true, () => false);

async function isDir(p: string): Promise<boolean> {
  return (await fs.stat(p).catch(() => null))?.isDirectory() ?? false;
}

// "name (1).ext", "name (2).ext", ... — the first one that's free.
async function freeName(dir: string, base: string): Promise<string> {
  if (!(await exists(path.join(dir, base)))) return path.join(dir, base);
  const ext = path.extname(base);
  const stem = base.slice(0, base.length - ext.length);
  for (let i = 1; ; i++) {
    const candidate = path.join(dir, `${stem} (${i})${ext}`);
    if (!(await exists(candidate))) return candidate;
  }
}

export async function movePath(root: string, src: string, destDir: string): Promise<OpResult> {
  const from = resolveInside(root, src);
  const toDir = resolveInside(root, destDir);
  if (!from || !toDir || from === root) return { ok: false, message: '프로젝트 폴더 밖으로는 옮길 수 없다' };
  if (!(await isDir(toDir))) return { ok: false, message: '폴더 안으로만 옮길 수 있다' };
  if (toDir === from || toDir.startsWith(from + path.sep)) return { ok: false, message: '폴더를 자기 안으로 옮길 수 없다' };
  const to = path.join(toDir, path.basename(from));
  if (to === from) return { ok: true, path: to };
  if (await exists(to)) return { ok: false, message: `${path.basename(from)}이(가) 이미 있다` };
  try {
    await fs.rename(from, to);
    return { ok: true, path: to };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export async function importPaths(root: string, sources: string[], destDir: string): Promise<{ imported: number; failed: string[] }> {
  const toDir = resolveInside(root, destDir);
  if (!toDir || !(await isDir(toDir))) return { imported: 0, failed: sources };
  let imported = 0;
  const failed: string[] = [];
  for (const src of sources) {
    try {
      const target = await freeName(toDir, path.basename(src));
      await fs.cp(src, target, { recursive: true, errorOnExist: true, force: false });
      imported += 1;
    } catch {
      failed.push(src);
    }
  }
  return { imported, failed };
}

export async function createEntry(root: string, parentDir: string, name: string, kind: 'file' | 'dir'): Promise<OpResult> {
  const trimmed = name.trim();
  if (!trimmed || trimmed === '.' || trimmed === '..' || /[/\\]/.test(trimmed)) {
    return { ok: false, message: '이름에 / 나 \\ 를 쓸 수 없고 비워둘 수 없다' };
  }
  const dir = resolveInside(root, parentDir);
  if (!dir || !(await isDir(dir))) return { ok: false, message: '프로젝트 폴더 안에서만 만들 수 있다' };
  const target = path.join(dir, trimmed);
  if (await exists(target)) return { ok: false, message: `${trimmed}이(가) 이미 있다` };
  try {
    if (kind === 'dir') await fs.mkdir(target);
    else await fs.writeFile(target, '', { flag: 'wx' });
    return { ok: true, path: target };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}
