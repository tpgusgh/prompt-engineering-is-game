// 🖥 서버: servers the AI started for the project (dev servers, APIs...) —
// any process listening on a TCP port whose working directory is inside the
// project folder (Windows: whose command line points into it). The player
// can open one in the browser or force it off.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export interface Listening {
  pid: number;
  name: string;
  ports: number[];
}
export interface Server extends Listening {
  command: string;
}

// `lsof -nP -iTCP -sTCP:LISTEN -Fpcn`: p<pid> / c<command> / n<host:port> lines.
export function parseLsofListen(out: string): Listening[] {
  const byPid = new Map<number, Listening>();
  let cur: Listening | undefined;
  for (const line of out.split('\n')) {
    const v = line.slice(1);
    if (line[0] === 'p') {
      const pid = Number(v);
      cur = byPid.get(pid) ?? { pid, name: '', ports: [] };
      byPid.set(pid, cur);
    } else if (line[0] === 'c' && cur) cur.name = v;
    else if (line[0] === 'n' && cur) {
      const port = Number(v.slice(v.lastIndexOf(':') + 1));
      if (Number.isInteger(port) && port > 0 && !cur.ports.includes(port)) cur.ports.push(port);
    }
  }
  return [...byPid.values()].map((l) => ({ ...l, ports: l.ports.sort((a, b) => a - b) })).filter((l) => l.ports.length);
}

// `lsof -a -d cwd -p <pids> -Fpn`: p<pid> / fcwd / n<path>.
export function parseLsofCwd(out: string): Map<number, string> {
  const cwd = new Map<number, string>();
  let pid = 0;
  for (const line of out.split('\n')) {
    if (line[0] === 'p') pid = Number(line.slice(1));
    else if (line[0] === 'n' && pid) cwd.set(pid, line.slice(1));
  }
  return cwd;
}

const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
export function insideFolder(path: string, folder: string): boolean {
  const p = norm(path);
  const f = norm(folder);
  return p === f || p.startsWith(`${f}/`);
}

export const serversIn = (listening: Listening[], cwd: Map<number, string>, folder: string) =>
  listening.filter((l) => cwd.has(l.pid) && insideFolder(cwd.get(l.pid)!, folder));

// ponytail: Windows has no per-process cwd to read; a server whose command
// line mentions the folder (node_modules/.bin/vite, python path...) counts.
export function parseWindowsListen(json: string, folder: string): Server[] {
  let data: { conns?: unknown; procs?: unknown };
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  const list = <T>(v: unknown): T[] => (Array.isArray(v) ? v : v ? [v] : []) as T[];
  const procs = list<{ ProcessId: number; Name: string; CommandLine?: string }>(data.procs);
  const f = norm(folder);
  const servers: Server[] = [];
  for (const p of procs) {
    const command = p.CommandLine ?? '';
    if (!norm(command).includes(f)) continue;
    const ports = [...new Set(list<{ LocalPort: number; OwningProcess: number }>(data.conns).filter((c) => c.OwningProcess === p.ProcessId).map((c) => c.LocalPort))].sort((a, b) => a - b);
    if (ports.length) servers.push({ pid: p.ProcessId, name: p.Name, ports, command });
  }
  return servers;
}

const WIN_SCRIPT =
  '$c = @(Get-NetTCPConnection -State Listen | Select-Object LocalPort,OwningProcess); $ids = $c.OwningProcess | Sort-Object -Unique; ' +
  '$p = @(Get-CimInstance Win32_Process | Where-Object { $ids -contains $_.ProcessId } | Select-Object ProcessId,Name,CommandLine); ' +
  '@{ conns = $c; procs = $p } | ConvertTo-Json -Depth 3 -Compress';

export async function listServers(folder: string): Promise<Server[] | { error: string }> {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await run('powershell.exe', ['-NoProfile', '-Command', WIN_SCRIPT], { windowsHide: true, maxBuffer: 8 << 20 });
      return parseWindowsListen(stdout, folder);
    }
    // lsof exits 1 when it finds nothing; its output is still what we want.
    const out = async (args: string[]) => (await run('lsof', args, { maxBuffer: 8 << 20 }).catch((e) => { if (e.code === 'ENOENT') throw e; return { stdout: String(e.stdout ?? '') }; })).stdout;
    const listen = parseLsofListen(await out(['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpcn']));
    if (!listen.length) return [];
    const cwd = parseLsofCwd(await out(['-a', '-d', 'cwd', '-p', listen.map((l) => l.pid).join(','), '-Fpn']));
    const mine = serversIn(listen, cwd, folder);
    if (!mine.length) return [];
    const { stdout } = await run('ps', ['-o', 'pid=,command=', '-p', mine.map((s) => s.pid).join(',')]).catch((e) => ({ stdout: String(e.stdout ?? '') }));
    const cmd = new Map(stdout.split('\n').map((l) => l.trim().match(/^(\d+)\s+(.*)$/)).filter((m): m is RegExpMatchArray => !!m).map((m) => [Number(m[1]), m[2]]));
    return mine.map((s) => ({ ...s, command: cmd.get(s.pid) ?? s.name }));
  } catch (err) {
    const missing = (err as NodeJS.ErrnoException).code === 'ENOENT';
    return { error: missing ? '이 컴퓨터에서는 서버 목록을 읽을 수 없다 (lsof 없음)' : `서버 목록을 읽지 못했다: ${err instanceof Error ? err.message : err}` };
  }
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

// Ask nicely (SIGTERM), then force (SIGKILL) if it's still up after 2s.
export async function killServer(pid: number): Promise<boolean> {
  if (process.platform === 'win32') {
    await run('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }).catch(() => {});
    return !alive(pid);
  }
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    return !alive(pid);
  }
  for (let i = 0; i < 20 && alive(pid); i++) await new Promise((r) => setTimeout(r, 100));
  if (alive(pid)) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  return !alive(pid);
}
