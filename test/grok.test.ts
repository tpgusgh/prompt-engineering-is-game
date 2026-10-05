import test from 'node:test';
import assert from 'node:assert/strict';
import { GROK_TUNE, mapGrokEvent, type GrokTurnState } from '../src/grok.ts';
import type { AgentEvent } from '../src/agent.ts';

function state(): GrokTurnState {
  return { text: '', files: new Set(), commands: [], tokens: 0, pending: new Map() };
}

test('grok weapons pair 4.6 with the light tiers and 4.7 with the heavy ones', () => {
  assert.deepEqual(GROK_TUNE['grok:spark'], { model: 'grok-4.6', effort: 'low' });
  assert.deepEqual(GROK_TUNE['grok:kindle'], { model: 'grok-4.6', effort: 'high' });
  assert.deepEqual(GROK_TUNE['grok:flare'], { model: 'grok-4.7', effort: 'medium' });
  assert.deepEqual(GROK_TUNE['grok:nova'], { model: 'grok-4.7', effort: 'high' });
});

test('a file edit and a shell command become battle hits when the tool finishes', () => {
  const events: AgentEvent[] = [];
  const turn = state();
  mapGrokEvent({ type: 'tool_call', toolCallId: 'c1', toolName: 'search_replace', kind: 'edit', rawInput: { path: 'src/a.ts' } }, turn, (e) => events.push(e));
  mapGrokEvent({ type: 'tool_call_update', toolCallId: 'c1', status: 'completed', rawOutput: { ok: true } }, turn, (e) => events.push(e));
  mapGrokEvent({ type: 'tool_call', toolCallId: 'c2', toolName: 'run_terminal_cmd', kind: 'execute', rawInput: { command: 'npm test' } }, turn, (e) => events.push(e));
  mapGrokEvent({ type: 'tool_call_update', toolCallId: 'c2', status: 'failed', rawOutput: 'no' }, turn, (e) => events.push(e));
  assert.equal(events[0]?.type, 'file');
  assert.equal(events[1]?.type, 'toolResult');
  assert.equal(events[2]?.type, 'command');
  assert.equal(events[3]?.type, 'toolResult');
  if (events[3]?.type === 'toolResult') assert.equal(events[3].isError, true);
  assert.deepEqual([...turn.files], ['src/a.ts']);
  assert.deepEqual(turn.commands, ['npm test']);
});

test('text chunks and the end event keep the reply and the session', () => {
  const events: AgentEvent[] = [];
  const turn = state();
  mapGrokEvent({ type: 'text', data: '안녕' }, turn, (e) => events.push(e));
  mapGrokEvent({ type: 'text', data: '하세요' }, turn, (e) => events.push(e));
  mapGrokEvent({ type: 'end', sessionId: 'abc', usage: { total_tokens: 12 } }, turn, (e) => events.push(e));
  mapGrokEvent({ type: 'thought', data: 'skip' }, turn, (e) => events.push(e));
  assert.equal(turn.text, '안녕하세요');
  assert.equal(turn.sessionId, 'abc');
  assert.equal(turn.tokens, 12);
  assert.equal(events.length, 2);
});
