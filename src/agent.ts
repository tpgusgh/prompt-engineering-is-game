import { query, listSessions, getSessionMessages } from '@anthropic-ai/claude-agent-sdk';
import { agentsFor, systemPromptFor } from './party.ts';
import { relabelForListing } from './transcripts.ts';
import { toQueryOptions, createTurnCloser, type ClaudeSettings } from './claude-settings.ts';

export interface TurnResult {
  summary: string;
  filesChanged: string[];
  commandsRun: string[];
  error?: string;
  // The player stopped the turn (⏹ 멈추기).
  interrupted?: boolean;
  sessionId?: string;
  contextTokens?: number;
  contextWindow?: number;
  // Tokens this turn processed (input + output + cache), from the result usage.
  tokensUsed?: number;
}

// Live events from a turn. command/file land hits; agentId marks ones done
// by a party subagent (the id of the Agent tool call that started it).
export type AgentEvent =
  | { type: 'command' | 'file'; value: string; agentId?: string; toolId?: string; detail?: string }
  | { type: 'toolResult'; toolId: string; output: string; isError: boolean }
  | { type: 'agentStart'; id: string; agentType: string; description: string }
  // report: the subagent's final answer (its Agent tool result / task summary).
  | { type: 'agentEnd'; id: string; report?: string }
  | { type: 'text'; value: string }
  // Background tasks (e.g. Bash run_in_background) still running this turn.
  | { type: 'background'; running: number };

export interface ExtractedInfo {
  filesChanged: string[];
  commandsRun: string[];
  text: string;
  finalResult?: string;
  error?: string;
  sessionId?: string;
  contextTokens?: number;
  contextWindow?: number;
  agentStarts: { id: string; agentType: string; description: string }[];
  // Read-only tool uses, e.g. "Read src/a.ts" — hits only when a subagent does them.
  readsRun: string[];
  // Every tool call in order, with its id, so results can be matched (IN/OUT cards).
  toolCalls: { id: string; kind: 'command' | 'file' | 'read'; value: string; detail?: string }[];
  toolOutputs: { id: string; output: string; isError: boolean }[];
  toolResultIds: string[];
  // Streamed text from the main agent (stream_event text_delta).
  textDelta?: string;
  // A new main-thread assistant message began (separate paragraph).
  messageStart: boolean;
  // Background task lifecycle, keyed by the tool call that launched it.
  tasksStarted: string[];
  tasksFinished: string[];
  taskReports: Record<string, string>;
  // Set on messages produced inside a subagent.
  parentToolUseId?: string;
}

// Shape confirmed against node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts
// (SDKAssistantMessage, SDKResultSuccess, SDKResultError) and
// node_modules/@anthropic-ai/sdk/resources/beta/messages/messages.d.ts
// (BetaTextBlock, BetaToolUseBlock).
//
// SDKResultMessage = SDKResultSuccess | SDKResultError (sdk.d.ts:5669).
// SDKResultSuccess (5671-5735): subtype 'success', is_error: boolean (5699),
// result: string (5703) — per the doc comment on 5667, subtype 'success' with
// is_error true carries the ERROR text in `result` (an API error ending the
// turn), not a real success.
// SDKResultError (5610-5664): subtype is one of
// 'error_during_execution' | 'error_max_turns' | 'error_max_budget_usd' |
// 'error_max_structured_output_retries' (5612), no `result` field, has
// `errors: string[]` instead (5636).
export function extractToolInfo(message: unknown): ExtractedInfo {
  const filesChanged: string[] = [];
  const commandsRun: string[] = [];
  let text = '';
  let finalResult: string | undefined;
  let error: string | undefined;

  const m = message as any;
  const parentToolUseId = typeof m?.parent_tool_use_id === 'string' ? m.parent_tool_use_id : undefined;
  const agentStarts: ExtractedInfo['agentStarts'] = [];
  const readsRun: string[] = [];
  const toolResultIds: string[] = [];
  const toolCalls: ExtractedInfo['toolCalls'] = [];
  const toolOutputs: ExtractedInfo['toolOutputs'] = [];

  if (m?.type === 'user' && Array.isArray(m.message?.content)) {
    for (const block of m.message.content) {
      if (block?.type === 'tool_result' && typeof block.tool_use_id === 'string') {
        toolResultIds.push(block.tool_use_id);
        const raw = typeof block.content === 'string' ? block.content : textOf(block.content);
        const output = raw.length > MAX_TOOL_OUTPUT ? `${raw.slice(0, MAX_TOOL_OUTPUT)}\n… (${raw.length - MAX_TOOL_OUTPUT}자 생략)` : raw;
        toolOutputs.push({ id: block.tool_use_id, output, isError: block.is_error === true });
      }
    }
  }

  const messageStart = m?.type === 'stream_event' && !parentToolUseId && m.event?.type === 'message_start';
  const tasksStarted: string[] = [];
  const tasksFinished: string[] = [];
  const taskReports: Record<string, string> = {};
  if (m?.type === 'system' && typeof m.tool_use_id === 'string') {
    if (m.subtype === 'task_started') tasksStarted.push(m.tool_use_id);
    if (m.subtype === 'task_notification') {
      tasksFinished.push(m.tool_use_id);
      if (typeof m.summary === 'string') taskReports[m.tool_use_id] = m.summary;
    }
  }

  let textDelta: string | undefined;
  if (m?.type === 'stream_event' && !parentToolUseId) {
    const d = m.event?.type === 'content_block_delta' ? m.event.delta : undefined;
    if (d?.type === 'text_delta' && typeof d.text === 'string') textDelta = d.text;
  }

  if (m?.type === 'assistant' && Array.isArray(m.message?.content)) {
    for (const block of m.message.content) {
      if (block?.type === 'tool_use') {
        if ((block.name === 'Agent' || block.name === 'Task') && typeof block.id === 'string') {
          agentStarts.push({
            id: block.id,
            agentType: typeof block.input?.subagent_type === 'string' ? block.input.subagent_type : 'general-purpose',
            description: typeof block.input?.description === 'string' ? block.input.description : '',
          });
        }
        const id = typeof block.id === 'string' ? block.id : '';
        if (block.name === 'Read' && typeof block.input?.file_path === 'string') {
          readsRun.push(`Read ${block.input.file_path}`);
          toolCalls.push({ id, kind: 'read', value: `Read ${block.input.file_path}` });
        }
        if ((block.name === 'Grep' || block.name === 'Glob') && typeof block.input?.pattern === 'string') {
          readsRun.push(`${block.name} ${block.input.pattern}`);
          toolCalls.push({ id, kind: 'read', value: `${block.name} ${block.input.pattern}` });
        }
        if (block.name === 'Bash' && typeof block.input?.command === 'string') {
          commandsRun.push(block.input.command);
          toolCalls.push({
            id, kind: 'command', value: block.input.command,
            ...(typeof block.input.description === 'string' ? { detail: block.input.description } : {}),
          });
        }
        if ((block.name === 'Write' || block.name === 'Edit') && typeof block.input?.file_path === 'string') {
          filesChanged.push(block.input.file_path);
          toolCalls.push({ id, kind: 'file', value: block.input.file_path });
        }
        // sdk-tools.d.ts NotebookEditInput uses `notebook_path`, not `file_path`.
        if (block.name === 'NotebookEdit' && typeof block.input?.notebook_path === 'string') {
          filesChanged.push(block.input.notebook_path);
          toolCalls.push({ id, kind: 'file', value: block.input.notebook_path });
        }
      }
      // A subagent's own narration isn't the reply to the player.
      if (block?.type === 'text' && typeof block.text === 'string' && !parentToolUseId) {
        text += block.text;
      }
    }
  }

  if (m?.type === 'result') {
    if (m.subtype === 'success') {
      if (m.is_error === true) {
        error = typeof m.result === 'string' ? m.result : 'agent turn ended with an error';
      } else if (typeof m.result === 'string') {
        finalResult = m.result;
      }
    } else if (typeof m.subtype === 'string') {
      const errs = Array.isArray(m.errors) ? m.errors.filter((e: unknown) => typeof e === 'string') : [];
      error = errs.length > 0 ? errs.join('; ') : `agent turn ended: ${m.subtype}`;
    }
  }

  // Every SDKMessage variant carries session_id (sdk.d.ts) — capture it so the
  // caller can pass it back in as `resume` on the next turn.
  const sessionId = typeof m?.session_id === 'string' ? m.session_id : undefined;

  // Each assistant message is one API call; its input side (fresh + both
  // cache buckets) is how full the context was at that call. The result's
  // modelUsage carries the window size (sdk.d.ts ModelUsage.contextWindow).
  let contextTokens: number | undefined;
  const usage = m?.type === 'assistant' ? m.message?.usage : undefined;
  if (usage && typeof usage.input_tokens === 'number') {
    contextTokens =
      usage.input_tokens + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
  }
  let tokensUsed: number | undefined;
  if (m?.type === 'result' && m.usage && typeof m.usage === 'object') {
    const u = m.usage;
    tokensUsed = [u.input_tokens, u.output_tokens, u.cache_creation_input_tokens, u.cache_read_input_tokens]
      .reduce((sum: number, n: unknown) => sum + (typeof n === 'number' && n > 0 ? n : 0), 0);
  }
  let contextWindow: number | undefined;
  if (m?.type === 'result' && m.modelUsage && typeof m.modelUsage === 'object') {
    const windows = Object.values(m.modelUsage as Record<string, any>)
      .map((u) => u?.contextWindow)
      .filter((w): w is number => typeof w === 'number' && w > 0);
    if (windows.length > 0) contextWindow = Math.max(...windows);
  }

  return {
    filesChanged, commandsRun, text, finalResult, error, sessionId, contextTokens, contextWindow, tokensUsed,
    agentStarts, readsRun, toolCalls, toolOutputs, toolResultIds, textDelta, parentToolUseId,
    messageStart, tasksStarted, tasksFinished, taskReports,
  };
}

// The Electron app runs the SDK's native `claude` binary from inside a packaged
// .app, where node_modules is unpacked from the asar (electron-builder's
// `asarUnpack`) to a real path on disk — required because an OS can't exec a
// binary that lives inside a virtual archive. The SDK's own default binary
// lookup doesn't know about that unpacking, so electron/main.ts sets this env
// var to the real unpacked path before starting a run; it's unset (and this
// returns {}) everywhere else, including the plain CLI, which never runs
// from inside an asar.
export function executableOverrideOptions(): { pathToClaudeCodeExecutable?: string } {
  const override = process.env.PROMPTBATTLE_CLAUDE_EXECUTABLE;
  return override ? { pathToClaudeCodeExecutable: override } : {};
}

export interface UsageWindow {
  usedPercent: number;
  resetsAt: string | null;
}

// Claude plan limits: the 5-hour "session" window and the 7-day weekly one.
export interface PlanUsage {
  session: UsageWindow | null;
  weekly: UsageWindow | null;
}

function toWindow(w: any): UsageWindow | null {
  return w && typeof w.utilization === 'number' ? { usedPercent: w.utilization, resetsAt: w.resets_at ?? null } : null;
}

// Maps the SDK's /usage response (sdk.d.ts SDKControlGetUsageResponse).
// Null when plan limits don't apply (API key, Bedrock, Vertex...).
export function toPlanUsage(response: unknown): PlanUsage | null {
  const r = response as any;
  if (!r?.rate_limits_available || !r.rate_limits) return null;
  return { session: toWindow(r.rate_limits.five_hour), weekly: toWindow(r.rate_limits.seven_day) };
}

// ponytail: uses the SDK's EXPERIMENTAL usage call (name says it may change);
// any failure just hides the usage bar instead of breaking the game.
// Spawns an idle `claude` process that never sends a prompt, so it costs no
// model tokens.
// Runs `ask` against an idle `claude` process that never receives a prompt
// (no model tokens), for control-channel queries. Null on failure/timeout.
async function withIdleQuery<T>(
  cwd: string,
  ask: (q: ReturnType<typeof query>) => Promise<T>,
  env?: Record<string, string | undefined>,
): Promise<T | null> {
  let release = () => {};
  const idle = (async function* () {
    await new Promise<void>((r) => (release = r));
  })() as AsyncIterable<never>;
  const q = query({ prompt: idle, options: { cwd, ...(env ? { env } : {}), ...executableOverrideOptions() } });
  try {
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), 15000));
    return await Promise.race([ask(q), timeout]);
  } catch {
    return null;
  } finally {
    release();
    q.close();
  }
}

export async function fetchPlanUsage(cwd: string, env?: Record<string, string | undefined>): Promise<PlanUsage | null> {
  return toPlanUsage(await withIdleQuery(cwd, (q) => q.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET({ skipBehaviors: true }), env));
}

// Who the game's Claude sessions run as (for the settings tab's check).
export async function fetchAccount(cwd: string, env?: Record<string, string | undefined>) {
  return withIdleQuery(cwd, async (q) => (await q.initializationResult()).account, env);
}

export interface ClaudeCapabilities {
  // User/project/plugin skills and commands (Claude Code's builtins excluded).
  skills: { name: string; description: string }[];
  mcpServers: { name: string; status: string }[];
}

// What the settings tab can toggle for this folder.
export async function fetchClaudeCapabilities(cwd: string, env?: Record<string, string | undefined>): Promise<ClaudeCapabilities | null> {
  return withIdleQuery(cwd, async (q) => {
    const init = await q.initializationResult();
    const mcp = await q.mcpServerStatus();
    const seen = new Set<string>();
    const skills = init.commands
      .filter((c) => !c.builtin && !seen.has(c.name) && seen.add(c.name))
      .map((c) => ({ name: c.name, description: c.description }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { skills, mcpServers: mcp.map((s) => ({ name: s.name, status: s.status })) };
  }, env);
}

const MAX_TOOL_OUTPUT = 4000;

export interface SessionSummary {
  sessionId: string;
  title: string;
  lastModified: number;
}

// Claude Code sessions for a project folder — the game's own and any started
// in the terminal `claude` CLI there — newest first.
export async function listFolderSessions(cwd: string): Promise<SessionSummary[]> {
  try {
    const sessions = await listSessions({ dir: cwd, limit: 30 });
    return sessions
      .map((s) => ({ sessionId: s.sessionId, title: (s.customTitle || s.summary || s.firstPrompt || '(제목 없음)').slice(0, 80), lastModified: s.lastModified }))
      .sort((a, b) => b.lastModified - a.lastModified);
  } catch {
    return [];
  }
}

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
    .map((b: any) => b.text)
    .join('\n');
}

// A transcript as chat entries: real user prompts and assistant text only
// (tool calls and tool results are skipped); consecutive assistant chunks
// of one reply are merged.
export function toChatEntries(messages: { type: string; message: unknown }[]): { role: 'user' | 'assistant'; text: string }[] {
  const out: { role: 'user' | 'assistant'; text: string }[] = [];
  for (const m of messages) {
    if (m.type !== 'user' && m.type !== 'assistant') continue;
    const text = textOf((m.message as any)?.content).trim();
    if (!text) continue;
    const last = out[out.length - 1];
    if (m.type === 'assistant' && last?.role === 'assistant') last.text += `\n\n${text}`;
    else out.push({ role: m.type, text });
  }
  return out;
}

export async function loadSessionHistory(sessionId: string, cwd: string) {
  try {
    return toChatEntries(await getSessionMessages(sessionId, { dir: cwd }));
  } catch {
    return [];
  }
}

export async function runAgentTurn(
  prompt: string,
  cwd: string,
  sessionId?: string,
  onEvent?: (event: AgentEvent) => void,
  {
    model,
    party = false,
    claude,
    env,
    signal,
  }: {
    model?: string;
    // Let the main agent send out the wizard/swordsman/archer subagents
    // (the courier for long-running work is always available).
    party?: boolean;
    // Effort, skills filter and blocked MCP servers from the settings tab.
    claude?: ClaudeSettings;
    // Process environment (auth: CLI login vs API key), see authEnv.
    env?: Record<string, string | undefined>;
    // Aborting it stops the turn (⏹ 멈추기): the result is `interrupted`.
    signal?: AbortSignal;
  } = {},
): Promise<TurnResult> {
  const filesChanged = new Set<string>();
  const commandsRun: string[] = [];
  let text = '';
  let finalResult: string | undefined;
  let error: string | undefined;
  let latestSessionId: string | undefined;
  let contextTokens: number | undefined;
  let contextWindow: number | undefined;
  let tokensUsed = 0;
  const runningAgents = new Set<string>();
  const backgroundAgents = new Set<string>();
  const agentReports = new Map<string, string>();
  let textSent = false;
  // Tool calls shown to the player, awaiting their result (OUT).
  const shownTools = new Set<string>();
  // The prompt goes in as a stream kept open until the turn is really over,
  // so background tasks aren't killed at the first result and Claude's
  // follow-up answer (when they finish) still arrives this turn.
  let closeInput = () => {};
  const inputClosed = new Promise<void>((r) => (closeInput = r));
  const input = (async function* () {
    yield { type: 'user' as const, message: { role: 'user' as const, content: prompt }, parent_tool_use_id: null };
    await inputClosed;
  })();
  let interrupted = false;
  const abortController = new AbortController();
  // No time limit: a turn waits as long as its background work takes.
  const closer = createTurnCloser();
  const settings = claude ? toQueryOptions(claude) : undefined;

  try {
    const q = query({
      prompt: input,
      options: {
        cwd,
        abortController,
        ...(model ? { model } : {}),
        permissionMode: 'bypassPermissions',
        // Required by the installed SDK alongside permissionMode: 'bypassPermissions'
        // (sdk.d.ts: "Must be set to true when using permissionMode: 'bypassPermissions'").
        allowDangerouslySkipPermissions: true,
        // `tools` restricts the actual available set (sdk.d.ts: "Specify the base
        // set of available built-in tools") — `allowedTools` only auto-approves,
        // it doesn't restrict, and under bypassPermissions nothing prompts anyway.
        tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'Agent'],
        agents: agentsFor(party),
        systemPrompt: { type: 'preset' as const, preset: 'claude_code' as const, append: systemPromptFor(party) },
        ...(env ? { env } : {}),
        ...(settings ? { effort: settings.effort, disallowedTools: settings.disallowedTools } : {}),
        ...(settings?.skills ? { skills: settings.skills } : {}),
        // Stream text as it's written so the UI can type it out live.
        includePartialMessages: true,
        ...(sessionId ? { resume: sessionId } : {}),
        ...executableOverrideOptions(),
      },
    });
    // Stop: ask Claude Code to interrupt gracefully (like Esc) so the session
    // stays consistent; force-abort if it hasn't ended a few seconds later.
    const onStop = () => {
      interrupted = true;
      closeInput();
      q.interrupt().catch(() => {});
      setTimeout(() => abortController.abort(), 5000).unref?.();
    };
    if (signal?.aborted) onStop();
    else signal?.addEventListener('abort', onStop, { once: true });
    for await (const message of q) {
      const info = extractToolInfo(message);
      const agentId = info.parentToolUseId && runningAgents.has(info.parentToolUseId) ? info.parentToolUseId : undefined;
      // A reply that resumes after tools/background work starts a new paragraph.
      if (info.messageStart && textSent) onEvent?.({ type: 'text', value: '\n\n' });
      if (info.textDelta) {
        textSent = true;
        onEvent?.({ type: 'text', value: info.textDelta });
      }
      // A backgrounded subagent's Agent call returns at once; it is still
      // running until its task notification arrives.
      for (const id of info.tasksStarted) if (runningAgents.has(id)) backgroundAgents.add(id);
      for (const id of info.tasksFinished) {
        if (backgroundAgents.delete(id) && runningAgents.delete(id)) {
          const report = info.taskReports[id];
          onEvent?.({ type: 'agentEnd', id, ...(report ? { report } : {}) });
        }
      }
      for (const a of info.agentStarts) {
        runningAgents.add(a.id);
        onEvent?.({ type: 'agentStart', ...a });
      }
      for (const c of info.commandsRun) commandsRun.push(c);
      for (const call of info.toolCalls) {
        const tag = { ...(agentId ? { agentId } : {}), ...(call.id ? { toolId: call.id } : {}), ...(call.detail ? { detail: call.detail } : {}) };
        if (call.kind === 'file') {
          filesChanged.add(call.value);
          onEvent?.({ type: 'file', value: call.value, ...tag });
        } else if (call.kind === 'command' || agentId) {
          // The main agent's reads stay quiet; a subagent's reads are its
          // whole job (the wizard), so they count as actions.
          onEvent?.({ type: 'command', value: call.value, ...tag });
        } else continue;
        if (call.id) shownTools.add(call.id);
      }
      for (const out of info.toolOutputs) {
        if (shownTools.delete(out.id)) onEvent?.({ type: 'toolResult', toolId: out.id, output: out.output, isError: out.isError });
        // A foreground subagent's Agent call result is its final report.
        if (runningAgents.has(out.id) && !backgroundAgents.has(out.id)) agentReports.set(out.id, out.output);
      }
      for (const id of info.toolResultIds) {
        if (backgroundAgents.has(id)) continue;
        if (runningAgents.delete(id)) {
          const report = agentReports.get(id);
          onEvent?.({ type: 'agentEnd', id, ...(report ? { report } : {}) });
        }
      }
      text += info.text;
      if (info.finalResult) finalResult = info.finalResult;
      if (info.error) error = info.error;
      const m = message as any;
      if (m?.type === 'system' && m.subtype === 'background_tasks_changed' && Array.isArray(m.tasks)) {
        closer.onBackgroundTasks(m.tasks.length);
        onEvent?.({ type: 'background', running: m.tasks.length });
      }
      if (m?.type === 'result' && closer.onResult(Boolean(info.error))) closeInput();
      if (info.sessionId) latestSessionId = info.sessionId;
      if (info.contextTokens !== undefined) contextTokens = info.contextTokens;
      if (info.contextWindow !== undefined) contextWindow = info.contextWindow;
      tokensUsed += info.tokensUsed ?? 0;
    }
    closeInput();
    for (const id of runningAgents) onEvent?.({ type: 'agentEnd', id });
    // List the session in VS Code / `claude --resume` (see transcripts.ts).
    if (latestSessionId) await relabelForListing(latestSessionId).catch(() => false);
    return {
      summary: (finalResult ?? text).trim(),
      filesChanged: [...filesChanged],
      commandsRun,
      // A stop ends the turn with an error-ish result; it isn't a failure.
      ...(interrupted ? { interrupted: true } : { error }),
      sessionId: latestSessionId,
      contextTokens,
      contextWindow,
      tokensUsed,
    };
  } catch (err) {
    closeInput();
    for (const id of runningAgents) onEvent?.({ type: 'agentEnd', id });
    if (interrupted) {
      if (latestSessionId) await relabelForListing(latestSessionId).catch(() => false);
      return { summary: text.trim(), filesChanged: [...filesChanged], commandsRun, interrupted: true, sessionId: latestSessionId };
    }
    return {
      summary: '',
      filesChanged: [...filesChanged],
      commandsRun,
      error: err instanceof Error ? err.message : String(err),
      sessionId: latestSessionId,
    };
  }
}
