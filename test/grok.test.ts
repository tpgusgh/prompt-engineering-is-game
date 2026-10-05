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

// A fake `grok`: a node script that prints streaming-json lines, as told by FAKE_GROK.
import { mkdtemp, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runGrokTurn } from '../src/grok.ts';

async function fakeGrok(script: string) {
  const dir = await mkdtemp(path.join(tmpdir(), 'fake-grok-'));
  const bin = path.join(dir, 'grok');
  await writeFile(bin, `#!/usr/bin/env node\n${script}\n`);
  await chmod(bin, 0o755);
  process.env.PROMPTBATTLE_GROK_EXECUTABLE = bin;
  return dir;
}
const posix = process.platform !== 'win32';
const out = (o: unknown) => `console.log(${JSON.stringify(JSON.stringify(o))});`;

test('runGrokTurn: a finished turn keeps the session and only the last message as the summary', { skip: !posix }, async () => {
  await fakeGrok([out({ type: 'text', data: '먼저 볼게.' }), out({ type: 'tool_call', toolCallId: 't', kind: 'execute', rawInput: { command: 'ls' } }), out({ type: 'tool_call_update', toolCallId: 't', status: 'completed' }), out({ type: 'text', data: '끝났다.' }), out({ type: 'end', sessionId: 's2', usage: { total_tokens: 5 } })].join('\n'));
  const r = await runGrokTurn('hi', tmpdir(), 's1', undefined, { model: 'grok:spark' });
  assert.equal(r.error, undefined);
  assert.equal(r.sessionId, 's2');
  assert.equal(r.summary, '끝났다.');
  assert.deepEqual(r.commandsRun, ['ls']);
});

test('runGrokTurn: exiting without an end event is an error, and the (maybe bad) session is not kept', { skip: !posix }, async () => {
  await fakeGrok(`${out({ type: 'text', data: '...' })}\nconsole.error('auth expired');`);
  const r = await runGrokTurn('hi', tmpdir(), 'bad-session', undefined, { model: 'grok:spark' });
  assert.match(r.error ?? '', /auth expired/);
  assert.equal(r.sessionId, undefined);
  await fakeGrok(out({ type: 'error', error: { message: 'rate limited' } }));
  assert.match((await runGrokTurn('hi', tmpdir(), undefined, undefined, { model: 'grok:spark' })).error ?? '', /rate limited/);
});

test('runGrokTurn: stopping kills grok and what it started, even if grok ignores SIGTERM', { skip: !posix }, async () => {
  const dir = await fakeGrok(`
    const { spawn } = require('node:child_process');
    const kid = spawn('sleep', ['30'], { stdio: 'ignore' });
    require('node:fs').writeFileSync(${JSON.stringify(path.join(tmpdir(), 'fake-grok-kid'))}, String(kid.pid));
    process.on('SIGTERM', () => {});
    console.log(JSON.stringify({ type: 'text', data: 'working' }));
    setInterval(() => {}, 1000);`);
  void dir;
  const stop = new AbortController();
  setTimeout(() => stop.abort(), 600);
  const started = Date.now();
  const r = await runGrokTurn('hi', tmpdir(), undefined, undefined, { model: 'grok:spark', signal: stop.signal });
  assert.equal(r.interrupted, true);
  assert.ok(Date.now() - started < 6000, 'the turn ends');
  const kid = Number((await import('node:fs')).readFileSync(path.join(tmpdir(), 'fake-grok-kid'), 'utf8'));
  await new Promise((res) => setTimeout(res, 300));
  assert.throws(() => process.kill(kid, 0), 'the command grok started is gone too');
});

test('runGrokTurn: a missing binary says it is not installed', { skip: !posix }, async () => {
  process.env.PROMPTBATTLE_GROK_EXECUTABLE = '/nope/grok';
  const old = process.env.PATH;
  process.env.PATH = '';
  const r = await runGrokTurn('hi', tmpdir(), undefined, undefined, { model: 'grok:spark' });
  process.env.PATH = old;
  assert.match(r.error ?? '', /설치/);
});
