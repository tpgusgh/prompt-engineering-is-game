// Save files (profile, save slots, sessions) are stored encrypted with
// AES-256-GCM: unreadable on disk, and any edit fails the auth tag, so level,
// coins or sword level can't be bumped by hand-editing JSON.
//
// ponytail: the key lives in ~/.promptbattle/.key on the same machine — this
// stops casual editing, not someone who reads this code and re-encrypts with
// that key (nothing local can; that needs a server). Upgrade path: keep the
// key in the OS keychain (Electron safeStorage) once the CLI doesn't share
// these files.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { writeTextAtomic } from './atomic-write.ts';

const MAGIC = 'PBS1:';
// The stores that existed as plain JSON before encryption: migrated once.
const LEGACY_STORES = ['profile.json', 'saves.json', 'sessions.json'];

export class StoreTamperedError extends Error {
  constructor(file: string) {
    super(`${path.basename(file)} was modified outside the game`);
  }
}

interface KeyFile {
  k: string;
  // Set while plain files are being encrypted, so a crash mid-way can finish.
  migrating?: boolean;
}

const keyPath = (homeDir: string) => path.join(homeDir, '.promptbattle', '.key');
const keys = new Map<string, Promise<Buffer>>();

function encrypt(key: Buffer, text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(text, 'utf-8'), cipher.final()]);
  return MAGIC + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}

function decrypt(key: Buffer, text: string, file: string): string {
  try {
    const raw = Buffer.from(text.slice(MAGIC.length), 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf-8');
  } catch {
    throw new StoreTamperedError(file);
  }
}

async function readKeyFile(homeDir: string): Promise<KeyFile | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(keyPath(homeDir), 'utf-8'));
    return typeof parsed?.k === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

// First use: make the key and encrypt any plain-JSON stores in place.
async function setupKey(homeDir: string): Promise<Buffer> {
  let file = await readKeyFile(homeDir);
  if (!file) {
    file = { k: crypto.randomBytes(32).toString('base64'), migrating: true };
    await writeTextAtomic(keyPath(homeDir), JSON.stringify(file), 0o600);
  }
  const key = Buffer.from(file.k, 'base64');
  if (file.migrating) {
    for (const name of LEGACY_STORES) {
      const store = path.join(homeDir, '.promptbattle', name);
      const text = await fs.readFile(store, 'utf-8').catch(() => null);
      if (text === null || text.startsWith(MAGIC)) continue;
      try {
        JSON.parse(text);
      } catch {
        continue; // not JSON at all: leave it, reading it fails as before
      }
      await writeTextAtomic(store, encrypt(key, text));
    }
    await writeTextAtomic(keyPath(homeDir), JSON.stringify({ k: file.k }), 0o600);
  }
  return key;
}

function keyFor(homeDir: string): Promise<Buffer> {
  const dir = path.resolve(homeDir);
  let key = keys.get(dir);
  if (!key) {
    key = setupKey(dir).catch((err) => {
      keys.delete(dir);
      throw err;
    });
    keys.set(dir, key);
  }
  return key;
}

// Throws ENOENT when missing, StoreTamperedError when edited or replaced.
export async function readStore(file: string, homeDir: string): Promise<unknown> {
  const key = await keyFor(homeDir);
  const text = await fs.readFile(file, 'utf-8');
  if (!text.startsWith(MAGIC)) throw new StoreTamperedError(file);
  return JSON.parse(decrypt(key, text, file));
}

export async function writeStore(file: string, data: unknown, homeDir: string): Promise<void> {
  const key = await keyFor(homeDir);
  await writeTextAtomic(file, encrypt(key, JSON.stringify(data)));
}
