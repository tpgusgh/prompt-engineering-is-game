// Save files are written beside the target and renamed over it, so a crash,
// force-quit or two overlapping saves can never leave a half-written (or
// empty) profile/save file behind — the old contents stay until the swap.
import fs from 'node:fs/promises';
import path from 'node:path';

let seq = 0;
// Writes to the same file run one after another: Windows refuses (EPERM) to
// rename onto a file that another rename is replacing at that moment.
const queues = new Map<string, Promise<void>>();

async function renameWithRetry(from: string, to: string): Promise<void> {
  // Windows can also briefly lock the target (antivirus, indexer): retry a little.
  for (let attempt = 0; ; attempt++) {
    try {
      return await fs.rename(from, to);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (attempt >= 5 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw err;
      await new Promise((r) => setTimeout(r, 20 * (attempt + 1)));
    }
  }
}

async function write(file: string, data: unknown, mode?: number): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${++seq}.tmp`;
  try {
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode });
    await renameWithRetry(tmp, file);
  } catch (err) {
    await fs.rm(tmp, { force: true });
    throw err;
  }
}

export function writeJsonAtomic(file: string, data: unknown, mode?: number): Promise<void> {
  const key = path.resolve(file);
  const next = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(() => write(file, data, mode));
  queues.set(key, next);
  void next.finally(() => {
    if (queues.get(key) === next) queues.delete(key);
  }).catch(() => {});
  return next;
}
