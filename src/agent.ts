import { query } from '@anthropic-ai/claude-agent-sdk';

export interface TurnResult {
  summary: string;
  filesChanged: string[];
  commandsRun: string[];
  error?: string;
}

export interface ExtractedInfo {
  filesChanged: string[];
  commandsRun: string[];
  text: string;
  finalResult?: string;
  error?: string;
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

  return { filesChanged, commandsRun, text, finalResult, error };
}

export async function runAgentTurn(prompt: string, cwd: string): Promise<TurnResult> {
  const filesChanged = new Set<string>();
  const commandsRun: string[] = [];
  let text = '';
  let finalResult: string | undefined;
  let error: string | undefined;

  try {
    for await (const message of query({
      prompt,
      options: {
        cwd,
        permissionMode: 'bypassPermissions',
        // Required by the installed SDK alongside permissionMode: 'bypassPermissions'
        // (sdk.d.ts: "Must be set to true when using permissionMode: 'bypassPermissions'").
        allowDangerouslySkipPermissions: true,
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      },
    })) {
      const info = extractToolInfo(message);
      info.filesChanged.forEach((f) => filesChanged.add(f));
      commandsRun.push(...info.commandsRun);
      text += info.text;
      if (info.finalResult) finalResult = info.finalResult;
      if (info.error) error = info.error;
    }
    return { summary: (finalResult ?? text).trim(), filesChanged: [...filesChanged], commandsRun, error };
  } catch (err) {
    return {
      summary: '',
      filesChanged: [...filesChanged],
      commandsRun,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
