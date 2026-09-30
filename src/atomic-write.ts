// Save files are written beside the target and renamed over it, so a crash,
// force-quit or two overlapping saves can never leave a half-written (or
// empty) profile/save file behind — the old contents stay until the swap.
import fs from 'node:fs/promises';
import path from 'node:path';

let seq = 0;

export async function writeJsonAtomic(file: string, data: unknown, mode?: number): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${++seq}.tmp`;
  try {
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode });
    await fs.rename(tmp, file);
  } catch (err) {
    await fs.rm(tmp, { force: true });
    throw err;
  }
}
