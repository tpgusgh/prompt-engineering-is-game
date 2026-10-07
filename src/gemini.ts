// Gemini CLI (Google) as a fourth AI. Like Grok, there's no agent SDK to
// embed (and a packaged app can't run a Node CLI itself), so a turn runs the
// player's own `gemini` headless: the prompt on stdin, `--output-format
// stream-json` events out, mapped onto the same AgentEvent / TurnResult.
//
// The four weapon tiers are the CLI's model aliases — it resolves each to the
// newest model, so there are no version numbers here to go stale.
import fs from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import type { AgentEvent, TurnResult } from './agent.ts';
import { findBin, runJsonLines } from './cli-proc.ts';
import { dangerOf, type Guard } from './safety.ts';

export const GEMINI_TUNE: Record<string, string> = {
  'gemini:flash-lite': 'flash-lite',
  'gemini:flash': 'flash',
  'gemini:auto': 'auto', // Pro or Flash, as the task needs
  'gemini:pro': 'pro',
};

export function geminiBin(): string | undefined {
  const fromEnv = process.env.PROMPTBATTLE_GEMINI_EXECUTABLE;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  // npm's global bin is not always on a GUI app's PATH (macOS).
  const extra = process.platform === 'win32' ? [path.join(process.env.APPDATA ?? '', 'npm')] : ['/opt/homebrew/bin', '/usr/local/bin', path.join(os.homedir(), '.npm-global', 'bin')];
  return findBin('gemini', extra);
}

// Signed in = a Google login the CLI saved, or an API key in the environment.
export async function geminiLoginStatus(): Promise<{ installed: boolean; loggedIn: boolean; detail: string }> {
  if (!geminiBin()) return { installed: false, loggedIn: false, detail: 'Gemini CLI(gemini)가 설치되어 있지 않다' };
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return { installed: true, loggedIn: true, detail: 'API 키' };
  if (fs.existsSync(path.join(os.homedir(), '.gemini', 'oauth_creds.json'))) return { installed: true, loggedIn: true, detail: '로그인됨' };
  return { installed: true, loggedIn: false, detail: '터미널에서 gemini를 한 번 실행해 Google로 로그인해 줘' };
}

export interface GeminiTurnState {
  sessionId?: string;
  // The whole reply; `last` is what came after the last tool call (the summary).
  text: string;
  last?: string;
  ended?: boolean; // a `result` event came
  files: Set<string>;
  commands: string[];
  tokens: number;
  error?: string;
  pending: Map<string, { kind: 'command' | 'file'; value: string }>;
}

const FILE_TOOLS = new Set(['write_file', 'replace']);
// "[API Error: {"error":{"message":"{\n \"error\": {... \"message\": \"API key not valid...\"": the
// innermost message is the one a person can read.
export function readableError(message: string): string {
  const inner = [...message.matchAll(/\\*"message\\*"\s*:\s*\\*"([^"\\]{3,})/g)].map((m) => m[1]);
  return (inner.at(-1) ?? message).trim().slice(0, 300);
}
const MAX_TOOL_OUTPUT = 4000;

// One stream-json event (@google/gemini-cli-core output/types.ts).
export function mapGeminiEvent(event: unknown, state: GeminiTurnState, emit: (e: AgentEvent) => void): void {
  if (!event || typeof event !== 'object') return;
  const row = event as Record<string, any>;
  if (row.type === 'init' && typeof row.session_id === 'string') state.sessionId = row.session_id;
  else if (row.type === 'message' && row.role === 'assistant' && typeof row.content === 'string') {
    state.text += row.content;
    state.last = (state.last ?? '') + row.content;
    emit({ type: 'text', value: row.content });
  } else if (row.type === 'tool_use' && typeof row.tool_id === 'string') {
    state.last = '';
    const p = (row.parameters ?? {}) as Record<string, unknown>;
    const hit =
      row.tool_name === 'run_shell_command' && typeof p.command === 'string'
        ? { kind: 'command' as const, value: p.command }
        : FILE_TOOLS.has(row.tool_name) && typeof p.file_path === 'string'
          ? { kind: 'file' as const, value: p.file_path }
          : undefined;
    if (!hit) return;
    state.pending.set(row.tool_id, hit);
    emit({ type: hit.kind, value: hit.value, toolId: row.tool_id });
  } else if (row.type === 'tool_result' && typeof row.tool_id === 'string') {
    const hit = state.pending.get(row.tool_id);
    if (!hit) return;
    state.pending.delete(row.tool_id);
    if (hit.kind === 'command') state.commands.push(hit.value);
    else state.files.add(hit.value);
    const raw = typeof row.output === 'string' ? row.output : typeof row.error?.message === 'string' ? row.error.message : '';
    emit({ type: 'toolResult', toolId: row.tool_id, output: raw.length > MAX_TOOL_OUTPUT ? `${raw.slice(0, MAX_TOOL_OUTPUT)}\n…` : raw, isError: row.status === 'error' });
  } else if (row.type === 'error' && row.severity === 'error' && typeof row.message === 'string') {
    state.error = row.message;
  } else if (row.type === 'result') {
    state.ended = true;
    if (typeof row.stats?.total_tokens === 'number') state.tokens += row.stats.total_tokens;
    if (row.status === 'error') state.error = typeof row.error?.message === 'string' ? readableError(row.error.message) : state.error ?? 'Gemini가 오류로 끝났다';
  }
}

export async function runGeminiTurn(
  prompt: string,
  cwd: string,
  sessionId: string | undefined,
  onEvent: ((e: AgentEvent) => void) | undefined,
  { model, signal, guard }: { model: string; signal?: AbortSignal; guard?: Guard },
): Promise<TurnResult> {
  const alias = GEMINI_TUNE[model];
  const bin = geminiBin();
  if (!alias) return { summary: '', filesChanged: [], commandsRun: [], error: `알 수 없는 Gemini 무기: ${model}` };
  if (!bin) return { summary: '', filesChanged: [], commandsRun: [], error: 'Gemini CLI(gemini)가 설치되어 있지 않다' };
  const state: GeminiTurnState = { text: '', files: new Set(), commands: [], tokens: 0, pending: new Map() };
  // stdin, not -p: no command-line length limit or quoting to get wrong (Windows .cmd).
  const args = ['--output-format', 'stream-json', '--approval-mode', 'yolo', '--skip-trust', '-m', alias, ...(sessionId ? ['--resume', sessionId] : [])];
  const safe = guard ? await safeModeHook(guard) : undefined;
  let run;
  try {
    run = await runJsonLines(bin, args, { cwd, stdin: prompt, signal, env: safe?.env, onEvent: (event) => mapGeminiEvent(event, state, (e) => onEvent?.(e)) });
  } finally {
    await safe?.close();
  }
  const { code, stderr, spawnError } = run;
  const summary = (state.last ?? state.text).trim();
  if (signal?.aborted) {
    return { summary, filesChanged: [...state.files], commandsRun: state.commands, interrupted: true, ...(state.ended && state.sessionId ? { sessionId: state.sessionId } : {}) };
  }
  const lastErr = stderr.trim().split('\n').filter(Boolean).slice(-1)[0];
  if (spawnError) state.error = spawnError.code === 'ENOENT' ? 'Gemini CLI(gemini)가 설치되어 있지 않다' : `gemini를 실행하지 못했다: ${spawnError.message}`;
  else if (!state.ended && !state.error) state.error = lastErr ? `Gemini가 응답을 끝내지 못했다: ${lastErr}` : `Gemini가 응답을 끝내지 못했다 (코드 ${code})`;
  // A turn that never finished doesn't hand back its session (a bad resume
  // id would otherwise fail every turn after it).
  return {
    summary,
    filesChanged: [...state.files],
    commandsRun: state.commands,
    ...(state.error ? { error: state.error } : {}),
    ...(state.ended && state.sessionId ? { sessionId: state.sessionId } : {}),
    tokensUsed: state.tokens,
  };
}

// 안전 모드: Gemini CLI runs a BeforeTool hook before each shell command, and
// the hook asks this turn's local endpoint, which asks the player only about
// risky commands (src/safety.ts). Gemini needs Node, so the hook is a node
// script. Anything going wrong blocks the command (fail closed).
//
// Gemini CLI only takes hooks from the player's own settings (a system
// settings file's hooks are ignored), and those must not be edited. So the
// turn gets a stand-in ~/.gemini (GEMINI_CLI_HOME — the process's HOME, and so
// the commands Gemini runs, stay the player's): every entry links to the real
// one (login, sessions, history), only settings.json is a copy with our hook added.
const hookScript = (url: string, token: string) => `const http = require('node:http');
const deny = (reason) => { process.stdout.write(JSON.stringify({ decision: 'deny', reason })); process.exit(0); };
try {
  let input = '';
  process.stdin.on('data', (d) => (input += d));
  process.stdin.on('end', () => {
    try {
      let command = '';
      try { command = JSON.parse(input).tool_input?.command ?? ''; } catch {}
      const req = http.request(${JSON.stringify(url)}, { method: 'POST', headers: { 'content-type': 'application/json', 'x-token': ${JSON.stringify(token)} } }, (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          try {
            const r = JSON.parse(body);
            if (r.allow === true) { process.stdout.write(JSON.stringify({ decision: 'allow' })); process.exit(0); }
            deny(r.reason || 'Refused (safe mode).');
          } catch { deny('The game could not be asked (safe mode).'); }
        });
      });
      req.on('error', () => deny('The game could not be asked (safe mode).'));
      req.end(JSON.stringify({ command }));
    } catch { deny('The game could not be asked (safe mode).'); }
  });
} catch { deny('The game could not be asked (safe mode).'); }
`;

async function standInHome(hookCommand: string): Promise<{ home: string; close: () => Promise<void> }> {
  const home = await mkdtemp(path.join(os.tmpdir(), 'promptbattle-gemini-'));
  const real = path.join(os.homedir(), '.gemini');
  const dir = path.join(home, '.gemini');
  fs.mkdirSync(dir);
  const links: string[] = [];
  for (const name of fs.existsSync(real) ? fs.readdirSync(real) : []) {
    if (name === 'settings.json') continue;
    const from = path.join(real, name);
    const to = path.join(dir, name);
    if (fs.statSync(from).isDirectory()) fs.symlinkSync(from, to, 'junction');
    else if (process.platform === 'win32') fs.copyFileSync(from, to); // file symlinks need admin on Windows
    else fs.symlinkSync(from, to);
    links.push(to);
  }
  // Sessions go to the real folder even if it didn't exist yet.
  if (!links.some((l) => path.basename(l) === 'tmp')) {
    fs.mkdirSync(path.join(real, 'tmp'), { recursive: true });
    fs.symlinkSync(path.join(real, 'tmp'), path.join(dir, 'tmp'), 'junction');
    links.push(path.join(dir, 'tmp'));
  }
  let settings: Record<string, any> = {};
  try {
    settings = JSON.parse(fs.readFileSync(path.join(real, 'settings.json'), 'utf8'));
  } catch {
    // none, or with comments: ours alone (the login still comes from the linked files)
  }
  const hooks = { ...(settings.hooks ?? {}) };
  hooks.BeforeTool = [...(Array.isArray(hooks.BeforeTool) ? hooks.BeforeTool : []), { matcher: 'run_shell_command', hooks: [{ name: 'promptbattle-safe-mode', type: 'command', command: hookCommand, timeout: 3_600_000 }] }];
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ ...settings, hooksConfig: { ...(settings.hooksConfig ?? {}), enabled: true }, hooks }));
  return {
    home,
    // Unlink the links one by one first: removing recursively must never reach the real files.
    close: async () => {
      for (const l of links) {
        try {
          fs.unlinkSync(l);
        } catch {
          try {
            fs.rmdirSync(l); // a Windows junction
          } catch {}
        }
      }
      await rm(home, { recursive: true, force: true });
    },
  };
}

async function safeModeHook(guard: Guard): Promise<{ env: Record<string, string>; close: () => Promise<void> }> {
  const scratch = await mkdtemp(path.join(os.tmpdir(), 'promptbattle-guard-'));
  const token = randomBytes(16).toString('hex');
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', async () => {
      let allow = false;
      if (req.headers['x-token'] === token) {
        let command = '';
        try {
          command = String(JSON.parse(body).command ?? '');
        } catch {}
        const danger = dangerOf(command);
        allow = !danger || (await guard(command, danger).catch(() => false));
      }
      res.end(JSON.stringify(allow ? { allow: true } : { allow: false, reason: 'The player refused this command (safe mode). Do not retry it; find a safer way or ask.' }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  const hookFile = path.join(scratch, 'safe-mode-hook.cjs');
  await writeFile(hookFile, hookScript(`http://127.0.0.1:${port}/`, token));
  const stand = await standInHome(`node "${hookFile}"`);
  return {
    env: { GEMINI_CLI_HOME: stand.home },
    close: async () => {
      server.close();
      await stand.close();
      await rm(scratch, { recursive: true, force: true });
    },
  };
}
