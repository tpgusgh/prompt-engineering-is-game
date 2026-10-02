// 안전 모드 (settings, off by default): Claude runs every tool without asking
// (bypassPermissions); with this on, a shell command that can destroy work
// waits for the player's OK first (a PreToolUse hook — the one thing that
// still runs before a bypassed tool).

// ponytail: a pattern list, not a shell parser; quoted text is stripped so
// `echo "rm -rf"` passes. Add patterns as they come up.
const DANGERS: [RegExp, string][] = [
  [/\brm\s+(-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)\b/, '파일·폴더를 통째로 지운다'],
  [/\bgit\s+push\b.*(\s--force\b|\s-f\b|\s--force-with-lease\b)/, '원격 저장소 기록을 덮어쓴다'],
  [/\bgit\s+reset\s+--hard\b/, '커밋하지 않은 변경을 모두 버린다'],
  [/\bgit\s+clean\s+-[a-zA-Z]*f/, '추적하지 않는 파일을 지운다'],
  [/\bgit\s+branch\s+-D\b/, '브랜치를 강제로 지운다'],
  [/\bgit\s+(checkout|restore)\s+(--\s+)?\.(\s|$)/, '작업 중인 변경을 되돌린다'],
  [/\b(drop\s+(table|database|schema)|truncate\s+table)\b/i, '데이터베이스를 지운다'],
  [/\bchmod\s+-R\s+777\b/, '권한을 전부 연다'],
  [/\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba|z)?sh\b/, '인터넷에서 받은 스크립트를 바로 실행한다'],
  [/\b(npm|pnpm|yarn)\s+publish\b/, '패키지를 공개 배포한다'],
  [/\bmkfs(\.\w+)?\b|\bdd\s+if=.*\bof=\/dev\//, '디스크를 덮어쓴다'],
  [/\bsudo\b/, '관리자 권한으로 실행한다'],
];

export function dangerOf(command: string): string | null {
  const bare = command.replace(/"[^"]*"|'[^']*'/g, '""');
  return DANGERS.find(([re]) => re.test(bare))?.[1] ?? null;
}

// Resolves true = run it.
export type Guard = (command: string, danger: string) => Promise<boolean>;

export function guardHookFor(guard: Guard) {
  return async (input: { tool_name?: string; tool_input?: unknown }, _id: string | undefined, _opts: { signal: AbortSignal }) => {
    const command = (input.tool_input as { command?: unknown } | undefined)?.command;
    if (input.tool_name !== 'Bash' || typeof command !== 'string') return {};
    const danger = dangerOf(command);
    if (!danger || (await guard(command, danger))) return {};
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse' as const,
        permissionDecision: 'deny' as const,
        permissionDecisionReason: 'The player refused this command (safe mode). Do not retry it; find a safer way or ask.',
      },
    };
  };
}
