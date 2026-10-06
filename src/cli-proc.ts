// Running an AI's own command-line tool for one turn (Grok Build, Gemini CLI):
// find it, start it in its own process group, read its JSON lines, and stop
// it — with everything it started — when the player hits ⏹.
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

// `name` on PATH (or in `extraDirs`); on Windows also its npm .cmd shim.
export function findBin(name: string, extraDirs: string[] = []): string | undefined {
  const names = process.platform === 'win32' ? [`${name}.exe`, `${name}.cmd`, `${name}.bat`] : [name];
  const dirs = [...extraDirs, ...(process.env.PATH ?? '').split(path.delimiter).filter(Boolean)];
  return dirs.flatMap((dir) => names.map((n) => path.join(dir, n))).find((file) => fs.existsSync(file));
}

// A .cmd/.bat shim only runs through cmd.exe. The arguments are paths, model
// names and flags (prompts go through a file or stdin), and a Windows path
// can't hold a double quote, so quoting each one is enough.
function command(bin: string, args: string[]): [string, string[], { windowsVerbatimArguments?: boolean }] {
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(bin)) {
    return ['cmd.exe', ['/d', '/s', '/c', `"${[bin, ...args].map((a) => `"${a}"`).join(' ')}"`], { windowsVerbatimArguments: true }];
  }
  return [bin, args, {}];
}

// The process group on macOS/Linux (SIGTERM, or SIGKILL), the tree on Windows.
export function killTree(pid: number | undefined, hard = false) {
  if (!pid) return;
  if (process.platform === 'win32') {
    execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => {});
    return;
  }
  try {
    process.kill(-pid, hard ? 'SIGKILL' : 'SIGTERM');
  } catch {
    try {
      process.kill(pid, hard ? 'SIGKILL' : 'SIGTERM');
    } catch {}
  }
}

export interface CliRun {
  code: number;
  stderr: string; // the last 4000 characters
  spawnError?: NodeJS.ErrnoException;
}

// One run: each stdout line that parses as JSON goes to onEvent. A stop
// (signal) asks the whole group to quit and forces it after 2s; the run ends
// on 'exit' too, so a grandchild holding stdout open can't hang the turn.
export async function runJsonLines(
  bin: string,
  args: string[],
  { cwd, stdin, signal, onEvent }: { cwd: string; stdin?: string; signal?: AbortSignal; onEvent: (event: unknown) => void },
): Promise<CliRun> {
  let stderr = '';
  let spawnError: NodeJS.ErrnoException | undefined;
  const [file, argv, extra] = command(bin, args);
  const child = spawn(file, argv, {
    cwd,
    env: process.env,
    stdio: [stdin === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
    windowsHide: true,
    ...extra,
  });
  if (stdin !== undefined) {
    child.stdin?.on('error', () => {}); // it may quit before reading it all
    child.stdin?.end(stdin);
  }
  child.stderr?.on('data', (chunk) => {
    stderr = (stderr + String(chunk)).slice(-4000);
  });
  const lines = readline.createInterface({ input: child.stdout! });
  lines.on('line', (line) => {
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      return; // a non-JSON line is not an event
    }
    try {
      onEvent(event);
    } catch (err) {
      console.error('[cli-proc] event handler threw', err);
    }
  });
  let hardKill: NodeJS.Timeout | undefined;
  const stop = () => {
    killTree(child.pid);
    hardKill = setTimeout(() => killTree(child.pid, true), 2000);
  };
  if (signal?.aborted) stop();
  else signal?.addEventListener('abort', stop, { once: true });
  const code = await new Promise<number>((resolve) => {
    child.on('error', (err) => {
      spawnError = err;
      resolve(1);
    });
    child.on('exit', (status) => resolve(status ?? 1));
    child.on('close', (status) => resolve(status ?? 1));
  });
  clearTimeout(hardKill);
  signal?.removeEventListener('abort', stop);
  lines.close();
  return { code, stderr, spawnError };
}
