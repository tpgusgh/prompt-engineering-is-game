// Game-side Claude controls: effort (shown as attack speed), which skills the
// model sees, and which MCP servers it may use. These only shape the game's
// own sessions (query options); the user's Claude Code settings are untouched.
export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export const EFFORT_LEVELS: EffortLevel[] = ['low', 'medium', 'high', 'xhigh', 'max'];

// Effort = thinking depth: slower to act, but each attack lands harder.
export const ATTACK_SPEED: Record<EffortLevel, { label: string; multiplier: number }> = {
  low: { label: '매우 빠름', multiplier: 0.85 },
  medium: { label: '빠름', multiplier: 0.95 },
  high: { label: '보통', multiplier: 1 },
  xhigh: { label: '느림', multiplier: 1.1 },
  max: { label: '매우 느림', multiplier: 1.2 },
};

export interface ClaudeSettings {
  effort: EffortLevel;
  // all = whatever Claude Code enables by default; none = no skills;
  // custom = only enabledSkills.
  skillsMode: 'all' | 'none' | 'custom';
  enabledSkills: string[];
  // MCP server names (as mcpServerStatus reports them) to keep out of the game.
  disabledMcp: string[];
}

export const DEFAULT_CLAUDE_SETTINGS: ClaudeSettings = { effort: 'high', skillsMode: 'all', enabledSkills: [], disabledMcp: [] };

// Claude Code names MCP tools mcp__<server>__<tool>, with the server name's
// characters outside [A-Za-z0-9_-] turned into "_". Disallowing the bare
// prefix removes every tool of that server.
export function mcpToolPrefix(serverName: string): string {
  return `mcp__${serverName.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

export function toQueryOptions(s: ClaudeSettings): { effort: EffortLevel; skills?: string[]; disallowedTools: string[] } {
  return {
    effort: s.effort,
    ...(s.skillsMode === 'none' ? { skills: [] } : s.skillsMode === 'custom' ? { skills: [...s.enabledSkills] } : {}),
    disallowedTools: s.disabledMcp.map(mcpToolPrefix),
  };
}

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function coerceClaudeSettings(value: unknown): ClaudeSettings {
  const v = (value ?? {}) as Record<string, unknown>;
  return {
    effort: EFFORT_LEVELS.includes(v.effort as EffortLevel) ? (v.effort as EffortLevel) : DEFAULT_CLAUDE_SETTINGS.effort,
    skillsMode: v.skillsMode === 'none' || v.skillsMode === 'custom' ? v.skillsMode : 'all',
    enabledSkills: strings(v.enabledSkills),
    disabledMcp: strings(v.disabledMcp),
  };
}

// When does a turn end? Normally at the result. If Claude left background
// tasks running (e.g. Bash run_in_background), keep listening: when they
// finish Claude Code wakes it with the output and it answers again — that
// follow-up result ends the turn. An error result always ends it.
export function createTurnCloser() {
  let running = 0;
  return {
    onBackgroundTasks(count: number): boolean {
      running = count;
      return false;
    },
    onResult(isError: boolean): boolean {
      return isError || running === 0;
    },
    get running() {
      return running;
    },
  };
}
