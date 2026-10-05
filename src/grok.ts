// Grok Build (xAI) as a third AI. There is no agent SDK like Codex, so a turn
// is `grok --prompt-file` in headless mode. streaming-json events leave as the
// same AgentEvent / TurnResult the battle already understands.
//
// One account, two models. The four weapon tiers (see src/weapons.ts) are
// grok-4.6 at low/high effort, then grok-4.7 at medium/high. The weapon is
// the effort — the hero's skill picker does not stack on top.
import { execFile, spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import type { AgentEvent, TurnResult } from './agent.ts';

export const GROK_EFFORTS = ['low', 'medium', 'high'] as const;
export type GrokEffort = (typeof GROK_EFFORTS)[number];

export const GROK_TUNE: Record<string, { model: string; effort: GrokEffort }> = {
  'grok:spark': { model: 'grok-4.6', effort: 'low' },
  'grok:kindle': { model: 'grok-4.6', effort: 'high' },
  'grok:flare': { model: 'grok-4.7', effort: 'medium' },
  'grok:nova': { model: 'grok-4.7', effort: 'high' },
};

export const grokPath = () => process.env.PROMPTBATTLE_GROK_EXECUTABLE;

export function grokBin(): string | undefined {
  const fromEnv = grokPath();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const name = process.platform === 'win32' ? 'grok.exe' : 'grok';
  const candidates = [
    path.join(os.homedir(), '.grok', 'bin', name),
    ...(process.env.PATH ?? '').split(path.delimiter).filter(Boolean).map((dir) => path.join(dir, name)),
  ];
  return candidates.find((file) => fs.existsSync(file));
}

function authFile(): string {
  return path.join(os.homedir(), '.grok', 'auth.json');
}

export async function grokLoginStatus(): Promise<{ loggedIn: boolean; detail: string }> {
  if (!grokBin()) return { loggedIn: false, detail: 'Grok Build(grok)가 설치되어 있지 않다' };
  if (process.env.XAI_API_KEY) return { loggedIn: true, detail: 'API 키' };
  try {
    if (fs.statSync(authFile()).size > 2) return { loggedIn: true, detail: '로그인됨' };
  } catch {
    // no auth file yet
  }
  return { loggedIn: false, detail: 'SuperGrok 로그인이 필요하다' };
}

export async function grokLogin(): Promise<{ ok: boolean; detail: string }> {
  const bin = grokBin();
  if (!bin) return { ok: false, detail: 'Grok Build(grok)가 설치되어 있지 않다' };
  const r = await runCli(bin, ['login'], 5 * 60_000);
  return { ok: r.code === 0, detail: (r.stderr || r.stdout).trim().split('\n').slice(-1)[0] ?? '' };
}

export interface GrokTurnState {
  sessionId?: string;
  text: string;
  files: Set<string>;
  commands: string[];
  tokens: number;
  error?: string;
  pending: Map<string, { kind: 'command' | 'file'; value: string }>;
}

const COMMAND_TOOLS = new Set(['run_terminal_cmd', 'bash', 'shell', 'execute']);
const FILE_TOOLS = new Set(['search_replace', 'write_file', 'edit_file', 'apply_patch', 'write', 'edit']);

function field(input: unknown, keys: string[]): string | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const row = input as Record<string, unknown>;
  for (const key of keys) if (typeof row[key] === 'string' && row[key]) return row[key];
  return undefined;
}

function classify(event: { kind?: unknown; toolName?: unknown; rawInput?: unknown; locations?: unknown }): { kind: 'command' | 'file'; value: string } | undefined {
  const tool = typeof event.toolName === 'string' ? event.toolName : '';
  const kind = typeof event.kind === 'string' ? event.kind : '';
  const command = field(event.rawInput, ['command', 'cmd']);
  const file = field(event.rawInput, ['path', 'file_path', 'filePath', 'target_file'])
    ?? (Array.isArray(event.locations) ? field(event.locations[0], ['path']) : undefined);
  if (kind === 'execute' || COMMAND_TOOLS.has(tool)) return command ? { kind: 'command', value: command } : undefined;
  if (kind === 'edit' || kind === 'delete' || kind === 'move' || FILE_TOOLS.has(tool)) return file ? { kind: 'file', value: file } : undefined;
  return undefined;
}

function tokensOf(usage: unknown): number {
  if (!usage || typeof usage !== 'object') return 0;
  const row = usage as Record<string, unknown>;
  if (typeof row.total_tokens === 'number') return row.total_tokens;
  return ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens', 'reasoning_tokens']
    .reduce((sum, key) => sum + (typeof row[key] === 'number' ? row[key] : 0), 0);
}

const MAX_TOOL_OUTPUT = 4000;

export function mapGrokEvent(event: unknown, state: GrokTurnState, emit: (e: AgentEvent) => void): void {
  if (!event || typeof event !== 'object') return;
  const row = event as Record<string, unknown>;
  if (row.type === 'text' && typeof row.data === 'string') {
    state.text += row.data;
    emit({ type: 'text', value: row.data });
  } else if (row.type === 'tool_call' && typeof row.toolCallId === 'string') {
    const hit = classify(row);
    if (!hit) return;
    state.pending.set(row.toolCallId, hit);
    emit(hit.kind === 'command' ? { type: 'command', value: hit.value, toolId: row.toolCallId } : { type: 'file', value: hit.value, toolId: row.toolCallId });
  } else if (row.type === 'tool_call_update' && typeof row.toolCallId === 'string') {
    const hit = state.pending.get(row.toolCallId);
    if (!hit) return;
    state.pending.delete(row.toolCallId);
    if (hit.kind === 'command') state.commands.push(hit.value);
    else state.files.add(hit.value);
    const raw = row.rawOutput === undefined ? '' : typeof row.rawOutput === 'string' ? row.rawOutput : JSON.stringify(row.rawOutput);
    const output = raw.length > MAX_TOOL_OUTPUT ? `${raw.slice(0, MAX_TOOL_OUTPUT)}\n…` : raw;
    const status = typeof row.status === 'string' ? row.status : '';
    emit({ type: 'toolResult', toolId: row.toolCallId, output, isError: status === 'failed' || status === 'error' });
  } else if (row.type === 'end') {
    if (typeof row.sessionId === 'string') state.sessionId = row.sessionId;
    state.tokens += tokensOf(row.usage);
  } else if (row.type === 'error' && typeof row.message === 'string') {
    state.error = row.message;
  }
}

function runCli(bin: string, args: string[], timeout: number): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(bin, args, { env: process.env, timeout, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) =>
      resolve({ code: err ? ((err as { code?: number }).code ?? 1) : 0, stdout: String(stdout), stderr: String(stderr) }),
    );
  });
}

export async function runGrokTurn(
  prompt: string,
  cwd: string,
  sessionId: string | undefined,
  onEvent: ((e: AgentEvent) => void) | undefined,
  { model, signal }: { model: string; signal?: AbortSignal },
): Promise<TurnResult> {
  const tune = GROK_TUNE[model];
  const bin = grokBin();
  const state: GrokTurnState = { sessionId, text: '', files: new Set(), commands: [], tokens: 0, pending: new Map() };
  if (!tune) return { summary: '', filesChanged: [], commandsRun: [], error: `알 수 없는 Grok 무기: ${model}` };
  if (!bin) return { summary: '', filesChanged: [], commandsRun: [], error: 'Grok Build(grok)가 설치되어 있지 않다' };
  const dir = await mkdtemp(path.join(os.tmpdir(), 'promptbattle-grok-'));
  const promptFile = path.join(dir, 'prompt.txt');
  await writeFile(promptFile, prompt, 'utf8');
  const args = [
    '--no-auto-update', '--no-alt-screen', '--always-approve',
    '--prompt-file', promptFile, '--output-format', 'streaming-json',
    '--cwd', cwd, '-m', tune.model, '--effort', tune.effort,
    ...(sessionId ? ['-r', sessionId] : []),
  ];
  let code = 1;
  let stderr = '';
  try {
    const child = spawn(bin, args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'], signal });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    const lines = readline.createInterface({ input: child.stdout });
    lines.on('line', (line) => {
      try { mapGrokEvent(JSON.parse(line), state, (e) => onEvent?.(e)); } catch { /* a non-JSON line is not an event */ }
    });
    code = await new Promise((resolve) => {
      child.on('error', () => resolve(1));
      child.on('close', (status) => resolve(status ?? 1));
    });
    lines.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  if (signal?.aborted) {
    return { summary: state.text.trim(), filesChanged: [...state.files], commandsRun: state.commands, interrupted: true, ...(state.sessionId ? { sessionId: state.sessionId } : {}) };
  }
  if (code !== 0 && !state.error) state.error = stderr.trim().split('\n').slice(-1)[0] || `grok가 코드 ${code}로 끝났다`;
  return {
    summary: state.text.trim(),
    filesChanged: [...state.files],
    commandsRun: state.commands,
    ...(state.error ? { error: state.error } : {}),
    ...(state.sessionId ? { sessionId: state.sessionId } : {}),
    tokensUsed: state.tokens,
  };
}
