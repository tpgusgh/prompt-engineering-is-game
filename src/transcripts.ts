import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Claude Code keeps every session as ~/.claude/projects/<encoded cwd>/<id>.jsonl.
// Sessions the SDK starts are tagged entrypoint "sdk-cli"/"sdk-ts"/"sdk-py",
// and the VS Code extension hides those from its session list. Relabeling
// the local transcript to "cli" lists the game's sessions there (as terminal
// sessions). Only this local label changes — usage telemetry was already
// reported as SDK when the turn ran.
const SDK_ENTRYPOINTS = new Set(['sdk-cli', 'sdk-ts', 'sdk-py']);
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findTranscript(sessionId: string, projectsDir: string): Promise<string | null> {
  const dirs = await fs.readdir(projectsDir).catch(() => [] as string[]);
  for (const dir of dirs) {
    const file = path.join(projectsDir, dir, `${sessionId}.jsonl`);
    if (await fs.stat(file).then((s) => s.isFile(), () => false)) return file;
  }
  return null;
}

// Returns true when the file was rewritten.
export async function relabelForListing(
  sessionId: string,
  projectsDir: string = path.join(os.homedir(), '.claude', 'projects'),
): Promise<boolean> {
  if (!SESSION_ID.test(sessionId)) return false;
  const file = await findTranscript(sessionId, projectsDir);
  if (!file) return false;
  const original = await fs.readFile(file, 'utf-8');
  let changed = false;
  // Parse each line so only the top-level field changes, never message text.
  const lines = original.split('\n').map((line) => {
    if (!line.includes('"entrypoint"')) return line;
    try {
      const entry = JSON.parse(line);
      if (!SDK_ENTRYPOINTS.has(entry?.entrypoint)) return line;
      entry.entrypoint = 'cli';
      changed = true;
      return JSON.stringify(entry);
    } catch {
      return line;
    }
  });
  if (!changed) return false;
  // Write beside the original, then swap it in, so a reader never sees half a file.
  const tmp = `${file}.promptbattle-tmp`;
  await fs.writeFile(tmp, lines.join('\n'), { mode: 0o600 });
  await fs.rename(tmp, file);
  return true;
}
