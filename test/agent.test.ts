import test from 'node:test';
import assert from 'node:assert/strict';
import { extractToolInfo } from '../src/agent.ts';

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

test('unknown or malformed messages extract to empty, never throw', () => {
  assert.doesNotThrow(() => extractToolInfo(null));
  assert.doesNotThrow(() => extractToolInfo({}));
  assert.doesNotThrow(() => extractToolInfo({ type: 'system' }));
  const info = extractToolInfo({ type: 'system' });
  assert.deepEqual(info.filesChanged, []);
  assert.deepEqual(info.commandsRun, []);
  assert.equal(info.text, '');
});
