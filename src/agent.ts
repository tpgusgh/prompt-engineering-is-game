import { query } from '@anthropic-ai/claude-agent-sdk';

export interface TurnResult {
  summary: string;
  filesChanged: string[];
  commandsRun: string[];
  error?: string;
  sessionId?: string;
  contextTokens?: number;
  contextWindow?: number;
}

export interface AgentEvent {
  type: 'command' | 'file';
  value: string;
}

export interface ExtractedInfo {
  filesChanged: string[];
  commandsRun: string[];
  text: string;
  finalResult?: string;
  error?: string;
  sessionId?: string;
  contextTokens?: number;
  contextWindow?: number;
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

  if (m?.type === 'assistant' && Array.isArray(m.message?.content)) {
    for (const block of m.message.content) {
      if (block?.type === 'tool_use') {
        if (block.name === 'Bash' && typeof block.input?.command === 'string') {
          commandsRun.push(block.input.command);
        }
        if ((block.name === 'Write' || block.name === 'Edit') && typeof block.input?.file_path === 'string') {
          filesChanged.push(block.input.file_path);
        }
        // sdk-tools.d.ts NotebookEditInput uses `notebook_path`, not `file_path`.
        if (block.name === 'NotebookEdit' && typeof block.input?.notebook_path === 'string') {
          filesChanged.push(block.input.notebook_path);
        }
      }
      if (block?.type === 'text' && typeof block.text === 'string') {
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

  return { filesChanged, commandsRun, text, finalResult, error, sessionId, contextTokens, contextWindow };
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

export async function runAgentTurn(
  prompt: string,
  cwd: string,
  sessionId?: string,
  onEvent?: (event: AgentEvent) => void,
  model?: string,
): Promise<TurnResult> {
  const filesChanged = new Set<string>();
  const commandsRun: string[] = [];
  let text = '';
  let finalResult: string | undefined;
  let error: string | undefined;
  let latestSessionId: string | undefined;
  let contextTokens: number | undefined;
  let contextWindow: number | undefined;

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
        tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
        ...(sessionId ? { resume: sessionId } : {}),
        ...executableOverrideOptions(),
      },
    })) {
      const info = extractToolInfo(message);
      for (const f of info.filesChanged) {
        if (!filesChanged.has(f)) onEvent?.({ type: 'file', value: f });
        filesChanged.add(f);
      }
      for (const c of info.commandsRun) {
        commandsRun.push(c);
        onEvent?.({ type: 'command', value: c });
      }
      text += info.text;
      if (info.finalResult) finalResult = info.finalResult;
      if (info.error) error = info.error;
      if (info.sessionId) latestSessionId = info.sessionId;
      if (info.contextTokens !== undefined) contextTokens = info.contextTokens;
      if (info.contextWindow !== undefined) contextWindow = info.contextWindow;
    }
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
    return {
      summary: '',
      filesChanged: [...filesChanged],
      commandsRun,
      error: err instanceof Error ? err.message : String(err),
      sessionId: latestSessionId,
    };
  }
}
