import test from 'node:test';
import assert from 'node:assert/strict';
import { extractToolInfo, executableOverrideOptions, canUseToolFor } from '../src/agent.ts';

test('executableOverrideOptions is empty when PROMPTBATTLE_CLAUDE_EXECUTABLE is unset (plain CLI/dev case)', () => {
  const prior = process.env.PROMPTBATTLE_CLAUDE_EXECUTABLE;
  delete process.env.PROMPTBATTLE_CLAUDE_EXECUTABLE;
  try {
    assert.deepEqual(executableOverrideOptions(), {});
  } finally {
    if (prior !== undefined) process.env.PROMPTBATTLE_CLAUDE_EXECUTABLE = prior;
  }
});

test('executableOverrideOptions passes pathToClaudeCodeExecutable through when set (packaged Electron app case)', () => {
  const prior = process.env.PROMPTBATTLE_CLAUDE_EXECUTABLE;
  process.env.PROMPTBATTLE_CLAUDE_EXECUTABLE = '/Applications/Prompt Battle.app/Contents/Resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-agent-sdk-darwin-arm64/claude';
  try {
    assert.deepEqual(executableOverrideOptions(), {
      pathToClaudeCodeExecutable:
        '/Applications/Prompt Battle.app/Contents/Resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-agent-sdk-darwin-arm64/claude',
    });
  } finally {
    if (prior === undefined) delete process.env.PROMPTBATTLE_CLAUDE_EXECUTABLE;
    else process.env.PROMPTBATTLE_CLAUDE_EXECUTABLE = prior;
  }
});

test('extracts a bash command from an assistant tool_use message', () => {
  const message = {
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'npm test' } }] },
  };
  const info = extractToolInfo(message);
  assert.deepEqual(info.commandsRun, ['npm test']);
  assert.deepEqual(info.filesChanged, []);
});

test('extracts a changed file path from a Write or Edit tool_use message', () => {
  const writeMessage = {
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Write', input: { file_path: '/tmp/foo.ts' } }] },
  };
  const editMessage = {
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: '/tmp/bar.ts' } }] },
  };
  assert.deepEqual(extractToolInfo(writeMessage).filesChanged, ['/tmp/foo.ts']);
  assert.deepEqual(extractToolInfo(editMessage).filesChanged, ['/tmp/bar.ts']);
});

test('accumulates assistant text blocks', () => {
  const message = {
    type: 'assistant',
    message: { content: [{ type: 'text', text: 'done: ' }, { type: 'text', text: 'fixed the bug' }] },
  };
  const info = extractToolInfo(message);
  assert.equal(info.text, 'done: fixed the bug');
});

test('reads the final result string from a successful result message', () => {
  const message = { type: 'result', subtype: 'success', result: 'All tests pass.' };
  const info = extractToolInfo(message);
  assert.equal(info.finalResult, 'All tests pass.');
});

test('reports an error from an is_error success-subtype result (SDKResultSuccess with is_error true)', () => {
  // Real shape: sdk.d.ts SDKResultSuccess (5671-5735) — subtype 'success' but
  // is_error: true means `result` carries the API error text, not a real answer.
  const message = { type: 'result', subtype: 'success', is_error: true, result: 'invalid API key' };
  const info = extractToolInfo(message);
  assert.equal(info.error, 'invalid API key');
  assert.equal(info.finalResult, undefined);
});

test('reports an error from an SDKResultError message', () => {
  // Real shape: sdk.d.ts SDKResultError (5610-5664) — subtype is one of the
  // error_* variants, no `result` field, `errors: string[]` instead.
  const message = {
    type: 'result',
    subtype: 'error_during_execution',
    is_error: true,
    errors: ['API error: rate limit exceeded'],
  };
  const info = extractToolInfo(message);
  assert.equal(info.error, 'API error: rate limit exceeded');
  assert.equal(info.finalResult, undefined);
});

test('extracts a changed notebook path from a NotebookEdit tool_use message (uses notebook_path, not file_path)', () => {
  const message = {
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'NotebookEdit', input: { notebook_path: '/tmp/nb.ipynb', new_source: 'x' } }] },
  };
  assert.deepEqual(extractToolInfo(message).filesChanged, ['/tmp/nb.ipynb']);
});

test('captures session_id from any message so the caller can resume', () => {
  const assistantMessage = { type: 'assistant', session_id: 'abc-123', message: { content: [] } };
  const resultMessage = { type: 'result', subtype: 'success', result: 'ok', session_id: 'abc-123' };
  assert.equal(extractToolInfo(assistantMessage).sessionId, 'abc-123');
  assert.equal(extractToolInfo(resultMessage).sessionId, 'abc-123');
  assert.equal(extractToolInfo({ type: 'system' }).sessionId, undefined);
});

test('reads current context size from an assistant message usage (input + both cache buckets)', () => {
  const message = {
    type: 'assistant',
    message: {
      content: [],
      usage: { input_tokens: 1000, cache_read_input_tokens: 50000, cache_creation_input_tokens: 2000, output_tokens: 300 },
    },
  };
  assert.equal(extractToolInfo(message).contextTokens, 53000);
});

test('reads the context window size from a result message modelUsage', () => {
  const message = {
    type: 'result',
    subtype: 'success',
    result: 'ok',
    modelUsage: { 'claude-sonnet-5': { contextWindow: 200000, inputTokens: 1 } },
  };
  assert.equal(extractToolInfo(message).contextWindow, 200000);
});

test('unknown or malformed messages extract to empty, never throw', () => {
  assert.doesNotThrow(() => extractToolInfo(null));
  assert.doesNotThrow(() => extractToolInfo({}));
  assert.doesNotThrow(() => extractToolInfo({ type: 'system' }));
  const info = extractToolInfo({ type: 'system' });
  assert.deepEqual(info.filesChanged, []);
  assert.deepEqual(info.commandsRun, []);
  assert.equal(info.text, '');
});

test('toPlanUsage maps the 5-hour and weekly windows, or null when limits do not apply', async () => {
  const { toPlanUsage } = await import('../src/agent.ts');
  assert.deepEqual(
    toPlanUsage({
      rate_limits_available: true,
      rate_limits: {
        five_hour: { utilization: 82, resets_at: '2026-09-29T05:39:59Z' },
        seven_day: { utilization: 73.4, resets_at: '2026-10-03T20:59:59Z' },
      },
    }),
    { session: { usedPercent: 82, resetsAt: '2026-09-29T05:39:59Z' }, weekly: { usedPercent: 73.4, resetsAt: '2026-10-03T20:59:59Z' } },
  );
  assert.deepEqual(toPlanUsage({ rate_limits_available: true, rate_limits: { five_hour: null } }), { session: null, weekly: null });
  assert.equal(toPlanUsage({ rate_limits_available: false, rate_limits: null }), null);
  assert.equal(toPlanUsage(undefined), null);
});

test('toChatEntries keeps user prompts and assistant text, skips tool traffic, merges assistant chunks', async () => {
  const { toChatEntries } = await import('../src/agent.ts');
  const entries = toChatEntries([
    { type: 'user', message: { role: 'user', content: 'fix the bug' } },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'Looking.' }, { type: 'tool_use', name: 'Read', input: {} }] } },
    { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'file body' }] } },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'Fixed it.' }] } },
    { type: 'user', message: { role: 'user', content: [{ type: 'text', text: 'thanks' }] } },
    { type: 'system', message: {} },
  ]);
  assert.deepEqual(entries, [
    { role: 'user', text: 'fix the bug' },
    { role: 'assistant', text: 'Looking.\n\nFixed it.' },
    { role: 'user', text: 'thanks' },
  ]);
});

test('toChatEntries hides Claude Code housekeeping: a compaction summary becomes one short marker', async () => {
  const { toChatEntries } = await import('../src/agent.ts');
  const entries = toChatEntries([
    { type: 'user', message: { role: 'user', content: 'This session is being continued from a previous conversation that ran out of context. The summary below covers...' } },
    { type: 'user', message: { role: 'user', content: '<task-notification>\n<task-id>a1</task-id>\n</task-notification>' } },
    { type: 'user', message: { role: 'user', content: '<command-name>/clear</command-name>' } },
    { type: 'user', message: { role: 'user', content: 'Caveat: The messages below were generated by the user while running local commands.' } },
    { type: 'user', message: { role: 'user', content: 'next step please' } },
  ]);
  assert.deepEqual(entries, [
    { role: 'assistant', text: '(이전 대화가 길어서 요약된 뒤 이어졌다)' },
    { role: 'user', text: 'next step please' },
  ]);
});

test('an Agent tool_use from the main thread is reported as a party member starting', () => {
  const info = extractToolInfo({
    type: 'assistant',
    parent_tool_use_id: null,
    message: { content: [{ type: 'tool_use', name: 'Agent', id: 'tu_1', input: { subagent_type: 'wizard', description: 'Scout the code', prompt: '...' } }] },
  });
  assert.deepEqual(info.agentStarts, [{ id: 'tu_1', agentType: 'wizard', description: 'Scout the code' }]);
});

test('subagent tool uses carry the parent Agent id; tool_results are listed for end detection', () => {
  const sub = extractToolInfo({
    type: 'assistant',
    parent_tool_use_id: 'tu_1',
    message: { content: [{ type: 'tool_use', name: 'Bash', id: 'tu_2', input: { command: 'ls' } }] },
  });
  assert.deepEqual(sub.commandsRun, ['ls']);
  assert.equal(sub.parentToolUseId, 'tu_1');
  const done = extractToolInfo({ type: 'user', parent_tool_use_id: null, message: { content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: 'ok' }] } });
  assert.deepEqual(done.toolResultIds, ['tu_1']);
});

test('main-thread text deltas stream out; subagent deltas do not', () => {
  const delta = (parent: string | null) => ({
    type: 'stream_event',
    parent_tool_use_id: parent,
    event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hel' } },
  });
  assert.equal(extractToolInfo(delta(null)).textDelta, 'Hel');
  assert.equal(extractToolInfo(delta('tu_1')).textDelta, undefined);
  assert.equal(extractToolInfo({ type: 'assistant', parent_tool_use_id: 'tu_1', message: { content: [{ type: 'text', text: 'sub says' }] } }).text, '', 'subagent text is not the reply');
});

test('read-only tool uses (Read/Glob/Grep) are listed, so a scouting subagent can land hits', () => {
  const info = extractToolInfo({
    type: 'assistant',
    parent_tool_use_id: 'tu_1',
    message: { content: [
      { type: 'tool_use', name: 'Read', id: 'r1', input: { file_path: '/p/src/cart.js' } },
      { type: 'tool_use', name: 'Grep', id: 'r2', input: { pattern: 'total' } },
      { type: 'tool_use', name: 'Glob', id: 'r3', input: { pattern: 'src/**' } },
    ] },
  });
  assert.deepEqual(info.readsRun, ['Read /p/src/cart.js', 'Grep total', 'Glob src/**']);
});

test('tool calls come out in order with their ids (for IN/OUT cards)', () => {
  const info = extractToolInfo({
    type: 'assistant',
    message: { content: [
      { type: 'tool_use', name: 'Bash', id: 'b1', input: { command: 'npm test', description: 'Run the tests' } },
      { type: 'tool_use', name: 'Edit', id: 'e1', input: { file_path: '/p/a.ts' } },
      { type: 'tool_use', name: 'Read', id: 'r1', input: { file_path: '/p/b.ts' } },
    ] },
  });
  assert.deepEqual(info.toolCalls, [
    { id: 'b1', kind: 'command', value: 'npm test', detail: 'Run the tests' },
    { id: 'e1', kind: 'file', value: '/p/a.ts' },
    { id: 'r1', kind: 'read', value: 'Read /p/b.ts' },
  ]);
});

test('tool results carry their output text and error flag, capped', () => {
  const info = extractToolInfo({
    type: 'user',
    message: { content: [
      { type: 'tool_result', tool_use_id: 'b1', content: 'ok\n3 passed' },
      { type: 'tool_result', tool_use_id: 'b2', is_error: true, content: [{ type: 'text', text: 'exit 1' }] },
      { type: 'tool_result', tool_use_id: 'b3', content: 'x'.repeat(10000) },
    ] },
  });
  assert.deepEqual(info.toolOutputs[0], { id: 'b1', output: 'ok\n3 passed', isError: false });
  assert.deepEqual(info.toolOutputs[1], { id: 'b2', output: 'exit 1', isError: true });
  assert.ok(info.toolOutputs[2].output.length <= 4100);
});

test('a new main-thread assistant message is flagged so replies split into separate paragraphs', () => {
  assert.equal(extractToolInfo({ type: 'stream_event', parent_tool_use_id: null, event: { type: 'message_start', message: {} } }).messageStart, true);
  assert.equal(extractToolInfo({ type: 'stream_event', parent_tool_use_id: 'tu_1', event: { type: 'message_start', message: {} } }).messageStart, false);
});

test('task notifications report which Agent tool call a background task belonged to', () => {
  const info = extractToolInfo({ type: 'system', subtype: 'task_notification', task_id: 't1', tool_use_id: 'tu_9', status: 'completed' });
  assert.deepEqual(info.tasksFinished, ['tu_9']);
  assert.deepEqual(extractToolInfo({ type: 'system', subtype: 'task_started', task_id: 't1', tool_use_id: 'tu_9' }).tasksStarted, ['tu_9']);
});

test('a background task notification carries its summary as the agent report', () => {
  const info = extractToolInfo({ type: 'system', subtype: 'task_notification', task_id: 't1', tool_use_id: 'tu_9', status: 'completed', summary: 'Tests: 12 passed' });
  assert.deepEqual(info.taskReports, { tu_9: 'Tests: 12 passed' });
});

test('a result message reports the tokens the turn used (input + output + cache)', () => {
  const info = extractToolInfo({ type: 'result', subtype: 'success', is_error: false, result: 'ok', usage: { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 5, cache_read_input_tokens: 100 } });
  assert.equal(info.tokensUsed, 135);
  assert.equal(extractToolInfo({ type: 'assistant', message: { content: [] } }).tokensUsed, undefined);
});

test('canUseToolFor: Claude\'s questions (AskUserQuestion) go to the player; their answers come back as the tool input', async () => {
  const q = [{ question: '어떤 색?', header: '색', options: [{ label: '빨강', description: '' }, { label: '파랑', description: '' }], multiSelect: false }];
  const asked: unknown[] = [];
  const allow = canUseToolFor(async (questions) => (asked.push(questions), { '어떤 색?': '파랑' }));
  const r = await allow('AskUserQuestion', { questions: q }, {} as never);
  assert.deepEqual(asked, [q]);
  assert.deepEqual(r, { behavior: 'allow', updatedInput: { questions: q, answers: { '어떤 색?': '파랑' } } });
  const skipped = await canUseToolFor(async () => null)('AskUserQuestion', { questions: q }, {} as never);
  assert.equal(skipped.behavior, 'deny', 'skipped (stopped) → Claude is told and goes on');
  assert.deepEqual(await allow('Bash', { command: 'ls' }, {} as never), { behavior: 'allow', updatedInput: { command: 'ls' } });
});
