import test from 'node:test';
import assert from 'node:assert/strict';
import { pickFamilies, mapCodexEvent, type CodexTurnState } from '../src/codex.ts';
import type { AgentEvent } from '../src/agent.ts';

test('codex models: the newest listed model per family, no versions hard-coded', () => {
  const picked = pickFamilies([
    { slug: 'gpt-6-astra', visibility: 'list', priority: 2 },
    { slug: 'gpt-6.1-sol', visibility: 'list', priority: 1 },
    { slug: 'gpt-6-sol', visibility: 'list', priority: 3 },
    { slug: 'gpt-6-luna', visibility: 'list', priority: 4 },
    { slug: 'gpt-5.6-terra', visibility: 'list', priority: 8 },
    { slug: 'gpt-daybreak-blue-latest', visibility: 'hide', priority: 11 },
    { slug: 'gpt-5.5', visibility: 'list', priority: 13 },
  ]);
  assert.deepEqual(picked, { astra: 'gpt-6-astra', sol: 'gpt-6.1-sol', luna: 'gpt-6-luna', terra: 'gpt-5.6-terra' });
});

test('codex events become battle events: commands and file edits land hits, the last message is the summary', () => {
  const state: CodexTurnState = { text: '', files: new Set(), commands: [], tokens: 0 };
  const out: AgentEvent[] = [];
  const feed = (e: unknown) => mapCodexEvent(e as never, state, (x) => out.push(x));
  feed({ type: 'thread.started', thread_id: 't-1' });
  feed({ type: 'item.started', item: { id: 'c1', type: 'command_execution', command: 'npm test', aggregated_output: '', status: 'in_progress' } });
  feed({ type: 'item.completed', item: { id: 'c1', type: 'command_execution', command: 'npm test', aggregated_output: 'ok', exit_code: 0, status: 'completed' } });
  feed({ type: 'item.completed', item: { id: 'f1', type: 'file_change', changes: [{ path: 'src/a.ts', kind: 'update' }], status: 'completed' } });
  feed({ type: 'item.completed', item: { id: 'm1', type: 'agent_message', text: 'Fixed it.' } });
  feed({ type: 'turn.completed', usage: { input_tokens: 100, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 20, reasoning_output_tokens: 5 } });
  assert.deepEqual(out.map((e) => e.type), ['command', 'toolResult', 'file', 'toolResult', 'text']);
  assert.equal(state.threadId, 't-1');
  assert.deepEqual([...state.files], ['src/a.ts']);
  assert.equal(state.text, 'Fixed it.');
  assert.equal(state.tokens, 125);
  const failed = { text: '', files: new Set<string>(), commands: [], tokens: 0 } as CodexTurnState;
  const errs: AgentEvent[] = [];
  mapCodexEvent({ type: 'item.completed', item: { id: 'c2', type: 'command_execution', command: 'false', aggregated_output: '', exit_code: 1, status: 'failed' } } as never, failed, (x) => errs.push(x));
  assert.ok(errs[0].type === 'toolResult' && errs[0].isError);
});
