import { query, listSessions, getSessionMessages } from '@anthropic-ai/claude-agent-sdk';
import { PARTY, PARTY_SYSTEM_PROMPT } from './party.ts';
import { relabelForListing } from './transcripts.ts';

export interface TurnResult {
  summary: string;
  filesChanged: string[];
  commandsRun: string[];
  error?: string;
  sessionId?: string;
  contextTokens?: number;
  contextWindow?: number;
}

// Live events from a turn. command/file land hits; agentId marks ones done
// by a party subagent (the id of the Agent tool call that started it).
export type AgentEvent =
  | { type: 'command' | 'file'; value: string; agentId?: string; toolId?: string; detail?: string }
  | { type: 'toolResult'; toolId: string; output: string; isError: boolean }
  | { type: 'agentStart'; id: string; agentType: string; description: string }
  | { type: 'agentEnd'; id: string }
  | { type: 'text'; value: string };

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
  let contextWindow: number | undefined;
  if (m?.type === 'result' && m.modelUsage && typeof m.modelUsage === 'object') {
    const windows = Object.values(m.modelUsage as Record<string, any>)
      .map((u) => u?.contextWindow)
      .filter((w): w is number => typeof w === 'number' && w > 0);
    if (windows.length > 0) contextWindow = Math.max(...windows);
  }

  return {
    filesChanged, commandsRun, text, finalResult, error, sessionId, contextTokens, contextWindow,
    agentStarts, readsRun, toolCalls, toolOutputs, toolResultIds, textDelta, parentToolUseId,
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
export async function fetchPlanUsage(cwd: string): Promise<PlanUsage | null> {
  let release = () => {};
  const idle = (async function* () {
    await new Promise<void>((r) => (release = r));
  })() as AsyncIterable<never>;
  const q = query({ prompt: idle, options: { cwd, ...executableOverrideOptions() } });
  try {
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), 15000));
    const response = await Promise.race([
      q.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET({ skipBehaviors: true }),
      timeout,
    ]);
    return toPlanUsage(response);
  } catch {
    return null;
  } finally {
    release();
    q.close();
  }
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
  model?: string,
  // Let the main agent send out the wizard/swordsman/archer subagents.
  party = false,
): Promise<TurnResult> {
  const filesChanged = new Set<string>();
  const commandsRun: string[] = [];
  let text = '';
  let finalResult: string | undefined;
  let error: string | undefined;
  let latestSessionId: string | undefined;
  let contextTokens: number | undefined;
  let contextWindow: number | undefined;
  const runningAgents = new Set<string>();
  // Tool calls shown to the player, awaiting their result (OUT).
  const shownTools = new Set<string>();

  try {
    for await (const message of query({
      prompt,
      options: {
        cwd,
        ...(model ? { model } : {}),
        permissionMode: 'bypassPermissions',
        // Required by the installed SDK alongside permissionMode: 'bypassPermissions'
        // (sdk.d.ts: "Must be set to true when using permissionMode: 'bypassPermissions'").
        allowDangerouslySkipPermissions: true,
        // `tools` restricts the actual available set (sdk.d.ts: "Specify the base
        // set of available built-in tools") — `allowedTools` only auto-approves,
        // it doesn't restrict, and under bypassPermissions nothing prompts anyway.
        tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', ...(party ? ['Agent'] : [])],
        ...(party ? { agents: PARTY, systemPrompt: { type: 'preset' as const, preset: 'claude_code' as const, append: PARTY_SYSTEM_PROMPT } } : {}),
        // Stream text as it's written so the UI can type it out live.
        includePartialMessages: true,
        ...(sessionId ? { resume: sessionId } : {}),
        ...executableOverrideOptions(),
      },
    })) {
      const info = extractToolInfo(message);
      const agentId = info.parentToolUseId && runningAgents.has(info.parentToolUseId) ? info.parentToolUseId : undefined;
      if (info.textDelta) onEvent?.({ type: 'text', value: info.textDelta });
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
      }
      for (const id of info.toolResultIds) {
        if (runningAgents.delete(id)) onEvent?.({ type: 'agentEnd', id });
      }
      text += info.text;
      if (info.finalResult) finalResult = info.finalResult;
      if (info.error) error = info.error;
      if (info.sessionId) latestSessionId = info.sessionId;
      if (info.contextTokens !== undefined) contextTokens = info.contextTokens;
      if (info.contextWindow !== undefined) contextWindow = info.contextWindow;
    }
    for (const id of runningAgents) onEvent?.({ type: 'agentEnd', id });
    // List the session in VS Code / `claude --resume` (see transcripts.ts).
    if (latestSessionId) await relabelForListing(latestSessionId).catch(() => false);
    return {
      summary: (finalResult ?? text).trim(),
      filesChanged: [...filesChanged],
      commandsRun,
      error,
      sessionId: latestSessionId,
      contextTokens,
      contextWindow,
    };
  } catch (err) {
    for (const id of runningAgents) onEvent?.({ type: 'agentEnd', id });
    return {
      summary: '',
      filesChanged: [...filesChanged],
      commandsRun,
      error: err instanceof Error ? err.message : String(err),
      sessionId: latestSessionId,
    };
  }
}
