import test from 'node:test';
import assert from 'node:assert/strict';
import { extractToolInfo, executableOverrideOptions } from '../src/agent.ts';

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
