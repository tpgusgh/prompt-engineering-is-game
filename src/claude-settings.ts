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
  // cli = the Claude Code login on this machine; api = an Anthropic API key
  // (stored encrypted by the app, never in this settings object).
  auth: 'cli' | 'api';
  // MCP servers added in the game (⚙️ → Claude → 🔌 MCP 연결하러 가기),
  // passed to every Claude query on top of Claude Code's own config.
  mcpServers?: Record<string, GameMcpServer>;
}

export type GameMcpServer = { type: 'stdio'; command: string; args: string[] } | { type: 'http'; url: string };
const MCP_NAME = /^[A-Za-z0-9_-]{1,64}$/;

// A server from the form: a command line (stdio) or an http(s) URL.
// ponytail: the command is split on spaces, no shell quoting; add a real
// parser if someone needs args with spaces.
export function parseMcpEntry(name: string, kind: 'command' | 'url', value: string): { server: GameMcpServer } | { error: string } {
  if (!MCP_NAME.test(name.trim())) return { error: '이름은 영어·숫자·_·- 만, 64자까지' };
  const v = value.trim();
  if (kind === 'url') {
    if (!/^https?:\/\/\S+$/.test(v)) return { error: 'http:// 또는 https:// 로 시작하는 주소를 넣어 줘' };
    return { server: { type: 'http', url: v } };
  }
  const [command, ...args] = v.split(/\s+/).filter(Boolean);
  if (!command) return { error: '실행할 명령을 넣어 줘 (예: npx -y @modelcontextprotocol/server-filesystem .)' };
  return { server: { type: 'stdio', command, args } };
}

function coerceMcpServers(v: unknown): Record<string, GameMcpServer> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, GameMcpServer> = {};
  for (const [name, s] of Object.entries(v as Record<string, any>)) {
    if (!MCP_NAME.test(name)) continue;
    if (s?.type === 'http' && typeof s.url === 'string' && /^https?:\/\//.test(s.url)) out[name] = { type: 'http', url: s.url };
    else if (s?.type === 'stdio' && typeof s.command === 'string' && s.command && Array.isArray(s.args) && s.args.every((a: unknown) => typeof a === 'string')) {
      out[name] = { type: 'stdio', command: s.command, args: [...s.args] };
    }
  }
  return out;
}

export const DEFAULT_CLAUDE_SETTINGS: ClaudeSettings = { effort: 'high', skillsMode: 'all', enabledSkills: [], disabledMcp: [], auth: 'cli' };

// Claude Code names MCP tools mcp__<server>__<tool>, with the server name's
// characters outside [A-Za-z0-9_-] turned into "_". Disallowing the bare
// prefix removes every tool of that server.
export function mcpToolPrefix(serverName: string): string {
  return `mcp__${serverName.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

export function toQueryOptions(s: ClaudeSettings): { effort: EffortLevel; skills?: string[]; disallowedTools: string[]; mcpServers?: Record<string, GameMcpServer> } {
  return {
    effort: s.effort,
    ...(s.skillsMode === 'none' ? { skills: [] } : s.skillsMode === 'custom' ? { skills: [...s.enabledSkills] } : {}),
    disallowedTools: s.disabledMcp.map(mcpToolPrefix),
    ...(s.mcpServers && Object.keys(s.mcpServers).length ? { mcpServers: { ...s.mcpServers } } : {}),
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
    auth: v.auth === 'api' ? 'api' : 'cli',
    ...(Object.keys(coerceMcpServers(v.mcpServers)).length ? { mcpServers: coerceMcpServers(v.mcpServers) } : {}),
  };
}

// Environment for the claude process: in api mode the key is injected; in
// cli mode any inherited ANTHROPIC_API_KEY is removed so the login is used.
export function authEnv(base: Record<string, string | undefined>, auth: 'cli' | 'api', apiKey: string | undefined) {
  const env = { ...base };
  delete env.ANTHROPIC_API_KEY;
  if (auth === 'api' && apiKey) env.ANTHROPIC_API_KEY = apiKey;
  return env;
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
