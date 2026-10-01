// Codex (OpenAI) as the other AI the hero can fight with. Its turns come in as
// Codex SDK thread events and leave as the same AgentEvent / TurnResult the
// battle already understands, so everything else (hits, chests, logs) is shared.
//
// Models: Codex's catalog has four families, matching Claude's four weapons —
// luna (fast) · terra (balanced) · sol (workhorse) · astra (frontier). No
// version numbers here: the newest listed model of each family is used.
import { execFile } from 'node:child_process';
import path from 'node:path';
import { Codex, type ThreadEvent, type ThreadOptions } from '@openai/codex-sdk';
import type { AgentEvent, TurnResult } from './agent.ts';
import type { EffortLevel } from './claude-settings.ts';

export const CODEX_FAMILIES = ['luna', 'terra', 'sol', 'astra'] as const;
export type CodexFamily = (typeof CODEX_FAMILIES)[number];

// From `codex debug models`: the newest (lowest priority number) listed model per family.
export function pickFamilies(models: { slug: string; visibility?: string; priority?: number }[]): Partial<Record<CodexFamily, string>> {
  const out: Partial<Record<CodexFamily, { slug: string; priority: number }>> = {};
  for (const m of models) {
    if (m.visibility && m.visibility !== 'list') continue;
    const family = CODEX_FAMILIES.find((f) => m.slug.endsWith(`-${f}`));
    if (!family) continue;
    const priority = m.priority ?? 999;
    if (!out[family] || priority < out[family]!.priority) out[family] = { slug: m.slug, priority };
  }
  return Object.fromEntries(Object.entries(out).map(([f, v]) => [f, v!.slug]));
}

// The bundled binary: the SDK finds it in development; a packaged app points
// it at the asarUnpack'd copy (see electron/main.ts).
export const codexPath = () => process.env.PROMPTBATTLE_CODEX_EXECUTABLE;

function runCli(args: string[], env?: Record<string, string | undefined>, timeout = 15000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const bin = codexPath() ?? codexBinFromSdk();
    if (!bin) return resolve({ code: -1, stdout: '', stderr: 'codex binary not found' });
    execFile(bin, args, { env: { ...process.env, ...env } as NodeJS.ProcessEnv, timeout, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) =>
      resolve({ code: err ? ((err as { code?: number }).code ?? 1) : 0, stdout: String(stdout), stderr: String(stderr) }),
    );
  });
}
// Same lookup the SDK does, for the CLI subcommands it doesn't wrap (login, models).
function codexBinFromSdk(): string | undefined {
  const triple = { 'darwin-arm64': 'aarch64-apple-darwin', 'darwin-x64': 'x86_64-apple-darwin', 'linux-x64': 'x86_64-unknown-linux-musl', 'linux-arm64': 'aarch64-unknown-linux-musl', 'win32-x64': 'x86_64-pc-windows-msvc', 'win32-arm64': 'aarch64-pc-windows-msvc' }[`${process.platform}-${process.arch}`];
  if (!triple) return undefined;
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'node_modules', '@openai', `codex-${process.platform}-${process.arch}`);
  return path.join(root, 'vendor', triple, 'bin', process.platform === 'win32' ? 'codex.exe' : 'codex');
}

let familyCache: Partial<Record<CodexFamily, string>> | null = null;
export async function codexModels(refresh = false): Promise<Partial<Record<CodexFamily, string>>> {
  if (familyCache && !refresh) return familyCache;
  for (const args of [['debug', 'models'], ['debug', 'models', '--bundled']]) {
    const r = await runCli(args);
    try {
      const picked = pickFamilies(JSON.parse(r.stdout).models ?? []);
      if (Object.keys(picked).length) return (familyCache = picked);
    } catch {}
  }
  return {};
}

export async function codexLoginStatus(): Promise<{ loggedIn: boolean; detail: string }> {
  const r = await runCli(['login', 'status']);
  return { loggedIn: r.code === 0, detail: (r.stdout || r.stderr).trim().split('\n')[0] ?? '' };
}
// ChatGPT sign-in: the CLI opens the browser and waits for the callback.
export async function codexLogin(): Promise<{ ok: boolean; detail: string }> {
  const r = await runCli(['login'], undefined, 5 * 60_000);
  return { ok: r.code === 0, detail: (r.stdout || r.stderr).trim().split('\n').slice(-1)[0] ?? '' };
}

// Game skill levels map straight onto Codex reasoning effort.
const EFFORT: Record<EffortLevel, ThreadOptions['modelReasoningEffort']> = { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' };

// One Codex thread event → the battle's events, keeping the bookkeeping a turn needs.
export interface CodexTurnState {
  threadId?: string;
  text: string; // the latest agent message
  files: Set<string>;
  commands: string[];
  tokens: number;
  error?: string;
}
export function mapCodexEvent(event: ThreadEvent, state: CodexTurnState, emit: (e: AgentEvent) => void): void {
  if (event.type === 'thread.started') state.threadId = event.thread_id;
  else if (event.type === 'turn.completed') state.tokens += event.usage.input_tokens + event.usage.output_tokens + event.usage.reasoning_output_tokens;
  else if (event.type === 'turn.failed') state.error = event.error.message;
  else if (event.type === 'error') state.error = event.message;
  else if (event.type === 'item.started' && event.item.type === 'command_execution') {
    emit({ type: 'command', value: event.item.command, toolId: event.item.id });
  } else if (event.type === 'item.completed') {
    const item = event.item;
    if (item.type === 'command_execution') {
      state.commands.push(item.command);
      emit({ type: 'toolResult', toolId: item.id, output: item.aggregated_output ?? '', isError: item.status === 'failed' || (item.exit_code ?? 0) !== 0 });
    } else if (item.type === 'file_change') {
      item.changes.forEach((c, i) => {
        const toolId = `${item.id}:${i}`;
        state.files.add(c.path);
        emit({ type: 'file', value: c.path, toolId, detail: c.kind });
        emit({ type: 'toolResult', toolId, output: c.kind, isError: item.status === 'failed' });
      });
    } else if (item.type === 'agent_message') {
      state.text = item.text;
      emit({ type: 'text', value: item.text });
    } else if (item.type === 'error') state.error = item.message;
  }
}

export async function runCodexTurn(
  prompt: string,
  cwd: string,
  threadId: string | undefined,
  onEvent: ((e: AgentEvent) => void) | undefined,
  { model, effort, signal }: { model?: string; effort?: EffortLevel; signal?: AbortSignal } = {},
): Promise<TurnResult> {
  const state: CodexTurnState = { threadId, text: '', files: new Set(), commands: [], tokens: 0 };
  const codex = new Codex({ ...(codexPath() ? { codexPathOverride: codexPath() } : {}) });
  const options: ThreadOptions = {
    workingDirectory: cwd,
    skipGitRepoCheck: true,
    sandboxMode: 'workspace-write',
    approvalPolicy: 'never',
    ...(model ? { model } : {}),
    ...(effort ? { modelReasoningEffort: EFFORT[effort] } : {}),
  };
  const thread = threadId ? codex.resumeThread(threadId, options) : codex.startThread(options);
  try {
    const { events } = await thread.runStreamed(prompt, { signal });
    for await (const event of events) mapCodexEvent(event, state, (e) => onEvent?.(e));
  } catch (err) {
    if (signal?.aborted) return { summary: state.text, filesChanged: [...state.files], commandsRun: state.commands, interrupted: true, sessionId: state.threadId ?? thread.id ?? undefined };
    state.error ??= err instanceof Error ? err.message : String(err);
  }
  const sessionId = state.threadId ?? thread.id ?? undefined;
  return {
    summary: state.text.trim(),
    filesChanged: [...state.files],
    commandsRun: state.commands,
    ...(state.error ? { error: state.error } : {}),
    ...(sessionId ? { sessionId } : {}),
    tokensUsed: state.tokens,
  };
}
