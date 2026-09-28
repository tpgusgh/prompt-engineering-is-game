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
}

// Shape confirmed against node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts
// (SDKAssistantMessage, SDKResultSuccess) and
// node_modules/@anthropic-ai/sdk/resources/beta/messages/messages.d.ts
// (BetaTextBlock, BetaToolUseBlock).
export function extractToolInfo(message: unknown): ExtractedInfo {
  const filesChanged: string[] = [];
  const commandsRun: string[] = [];
  let text = '';
  let finalResult: string | undefined;

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

  if (m?.type === 'result' && m.subtype === 'success' && typeof m.result === 'string') {
    finalResult = m.result;
  }

  return { filesChanged, commandsRun, text, finalResult };
}

export async function runAgentTurn(prompt: string, cwd: string): Promise<TurnResult> {
  const filesChanged = new Set<string>();
  const commandsRun: string[] = [];
  let text = '';
  let finalResult: string | undefined;

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
    }
    return { summary: (finalResult ?? text).trim(), filesChanged: [...filesChanged], commandsRun };
  } catch (err) {
    return {
      summary: '',
      filesChanged: [...filesChanged],
      commandsRun,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
