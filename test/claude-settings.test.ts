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
  assert.deepEqual(toQueryOptions(DEFAULT_CLAUDE_SETTINGS), { effort: 'high', disallowedTools: [] }, 'all skills = CLI default (skills omitted)');
  assert.deepEqual(toQueryOptions({ ...DEFAULT_CLAUDE_SETTINGS, skillsMode: 'none' }).skills, []);
  assert.deepEqual(
    toQueryOptions({ effort: 'low', skillsMode: 'custom', enabledSkills: ['pdf', 'ecc:tdd'], disabledMcp: ['plugin:github:github'] }),
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
