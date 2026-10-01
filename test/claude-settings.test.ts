import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CLAUDE_SETTINGS, ATTACK_SPEED, EFFORT_LEVELS, coerceClaudeSettings, mcpToolPrefix, toQueryOptions, createTurnCloser,
} from '../src/claude-settings.ts';

test('MCP server names map to the tool prefix Claude Code uses', () => {
  assert.equal(mcpToolPrefix('plugin:context7:context7'), 'mcp__plugin_context7_context7');
  assert.equal(mcpToolPrefix('claude.ai Claude Docs'), 'mcp__claude_ai_Claude_Docs');
  assert.equal(mcpToolPrefix('plugin:ecc:chrome-devtools'), 'mcp__plugin_ecc_chrome-devtools');
});

test('settings become query options: effort, skills filter, blocked MCP servers', () => {
  assert.deepEqual(toQueryOptions(DEFAULT_CLAUDE_SETTINGS), { effort: 'medium', disallowedTools: [] }, 'all skills = CLI default (skills omitted)');
  assert.deepEqual(toQueryOptions({ ...DEFAULT_CLAUDE_SETTINGS, skillsMode: 'none' }).skills, []);
  assert.deepEqual(
    toQueryOptions({ effort: 'low', skillsMode: 'custom', enabledSkills: ['pdf', 'ecc:tdd'], disabledMcp: ['plugin:github:github'], auth: 'cli' }),
    { effort: 'low', skills: ['pdf', 'ecc:tdd'], disallowedTools: ['mcp__plugin_github_github'] },
  );
});

test('attack speed: deeper effort is slower but hits harder', () => {
  const m = EFFORT_LEVELS.map((e) => ATTACK_SPEED[e].multiplier);
  assert.deepEqual(m, [...m].sort((a, b) => a - b));
  assert.equal(ATTACK_SPEED.high.multiplier, 1);
});

test('coerce keeps valid fields and falls back per field', () => {
  assert.deepEqual(coerceClaudeSettings(undefined), DEFAULT_CLAUDE_SETTINGS);
  assert.deepEqual(
    coerceClaudeSettings({ effort: 'max', skillsMode: 'weird', enabledSkills: ['a', 3], disabledMcp: 'x' }),
    { ...DEFAULT_CLAUDE_SETTINGS, effort: 'max', enabledSkills: ['a'] },
  );
});

test('a turn closes on a result with no background tasks; otherwise it waits for the follow-up result', () => {
  const c = createTurnCloser();
  assert.equal(c.onResult(false), true, 'plain turn');

  const bg = createTurnCloser();
  bg.onBackgroundTasks(1);
  assert.equal(bg.onResult(false), false, 'background work still running: keep listening');
  assert.equal(bg.onBackgroundTasks(0), false, 'task done: Claude will answer it next');
  assert.equal(bg.onResult(false), true, 'the follow-up answer ends the turn');

  const err = createTurnCloser();
  err.onBackgroundTasks(2);
  assert.equal(err.onResult(true), true, 'an error result always ends the turn');
});

test('auth env: api mode injects the key; cli mode strips any inherited key so the login is used', async () => {
  const { authEnv } = await import('../src/claude-settings.ts');
  assert.equal(authEnv({ PATH: '/bin' }, 'api', 'sk-ant-x').ANTHROPIC_API_KEY, 'sk-ant-x');
  const cli = authEnv({ PATH: '/bin', ANTHROPIC_API_KEY: 'leaked' }, 'cli', 'sk-ant-x');
  assert.equal('ANTHROPIC_API_KEY' in cli, false);
  assert.equal(cli.PATH, '/bin');
  assert.equal('ANTHROPIC_API_KEY' in authEnv({}, 'api', undefined), false, 'api mode without a key adds nothing');
});

test('auth mode defaults to cli and survives coercion', () => {
  assert.equal(coerceClaudeSettings({}).auth, 'cli');
  assert.equal(coerceClaudeSettings({ auth: 'api' }).auth, 'api');
  assert.equal(coerceClaudeSettings({ auth: 'nope' }).auth, 'cli');
});

test('game MCP servers: a command or an http URL, validated; handed to Claude in the query options', async () => {
  const { parseMcpEntry } = await import('../src/claude-settings.ts');
  assert.deepEqual(parseMcpEntry('fs', 'command', 'npx -y @modelcontextprotocol/server-filesystem /tmp'), {
    server: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'] },
  });
  assert.deepEqual(parseMcpEntry('docs', 'url', 'https://example.com/mcp'), { server: { type: 'http', url: 'https://example.com/mcp' } });
  assert.ok('error' in parseMcpEntry('bad name!', 'url', 'https://x'));
  assert.ok('error' in parseMcpEntry('ok', 'url', 'ftp://x'));
  assert.ok('error' in parseMcpEntry('ok', 'command', '   '));
  const s = coerceClaudeSettings({ mcpServers: { docs: { type: 'http', url: 'https://example.com/mcp' }, junk: { type: 'http', url: 5 } } });
  assert.deepEqual(s.mcpServers, { docs: { type: 'http', url: 'https://example.com/mcp' } });
  assert.deepEqual(toQueryOptions(s).mcpServers, { docs: { type: 'http', url: 'https://example.com/mcp' } });
  assert.equal('mcpServers' in toQueryOptions(DEFAULT_CLAUDE_SETTINGS), false);
});
