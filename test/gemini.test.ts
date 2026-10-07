import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GEMINI_TUNE, mapGeminiEvent, runGeminiTurn, readableError, type GeminiTurnState } from '../src/gemini.ts';
import type { AgentEvent } from '../src/agent.ts';

const state = (): GeminiTurnState => ({ text: '', files: new Set(), commands: [], tokens: 0, pending: new Map() });

test('gemini weapons are the CLI\'s own model aliases (no version numbers to go stale)', () => {
  assert.deepEqual(Object.values(GEMINI_TUNE), ['flash-lite', 'flash', 'auto', 'pro']);
});

test('stream-json: shell commands and file writes become battle hits when their result comes back', () => {
  const events: AgentEvent[] = [];
  const turn = state();
  const emit = (e: AgentEvent) => events.push(e);
  mapGeminiEvent({ type: 'init', session_id: 'u1', model: 'gemini-2.5-pro' }, turn, emit);
  mapGeminiEvent({ type: 'tool_use', tool_name: 'run_shell_command', tool_id: 't1', parameters: { command: 'npm test' } }, turn, emit);
  mapGeminiEvent({ type: 'tool_result', tool_id: 't1', status: 'error', error: { type: 'x', message: 'exit 1' } }, turn, emit);
  mapGeminiEvent({ type: 'tool_use', tool_name: 'replace', tool_id: 't2', parameters: { file_path: '/p/src/a.ts' } }, turn, emit);
  mapGeminiEvent({ type: 'tool_result', tool_id: 't2', status: 'success', output: 'ok' }, turn, emit);
  mapGeminiEvent({ type: 'tool_use', tool_name: 'read_file', tool_id: 't3', parameters: { file_path: 'x' } }, turn, emit);
  assert.deepEqual(events.map((e) => e.type), ['command', 'toolResult', 'file', 'toolResult']);
  assert.equal(events[1]?.type === 'toolResult' && events[1].isError, true);
  assert.deepEqual(turn.commands, ['npm test']);
  assert.deepEqual([...turn.files], ['/p/src/a.ts']);
  assert.equal(turn.sessionId, 'u1');
});

test('stream-json: assistant deltas stream as text; the user echo is skipped; the result ends the turn with its tokens', () => {
  const events: AgentEvent[] = [];
  const turn = state();
  mapGeminiEvent({ type: 'message', role: 'user', content: 'my prompt' }, turn, (e) => events.push(e));
  mapGeminiEvent({ type: 'message', role: 'assistant', content: '안녕', delta: true }, turn, (e) => events.push(e));
  mapGeminiEvent({ type: 'message', role: 'assistant', content: '하세요', delta: true }, turn, (e) => events.push(e));
  mapGeminiEvent({ type: 'result', status: 'success', stats: { total_tokens: 42 } }, turn, (e) => events.push(e));
  assert.equal(turn.text, '안녕하세요');
  assert.equal(turn.ended, true);
  assert.equal(turn.tokens, 42);
  assert.equal(events.length, 2);
  const bad = state();
  mapGeminiEvent({ type: 'result', status: 'error', error: { type: 'auth', message: 'Please log in' } }, bad, () => {});
  assert.equal(bad.error, 'Please log in');
});

// A fake `gemini`: a node script that reads the prompt from stdin like the real one.
async function fakeGemini(script: string) {
  const dir = await mkdtemp(path.join(tmpdir(), 'fake-gemini-'));
  const bin = path.join(dir, 'gemini');
  await writeFile(bin, `#!/usr/bin/env node\n${script}\n`);
  await chmod(bin, 0o755);
  process.env.PROMPTBATTLE_GEMINI_EXECUTABLE = bin;
  return dir;
}
const posix = process.platform !== 'win32';

test('runGeminiTurn: prompt on stdin, model alias and resume on the command line, session and last message kept', { skip: !posix }, async () => {
  const dir = await fakeGemini(`
    let input = ''; process.stdin.on('data', (d) => (input += d)); process.stdin.on('end', () => {
      require('node:fs').writeFileSync(${JSON.stringify(path.join(tmpdir(), 'fake-gemini-seen.json'))}, JSON.stringify({ input, args: process.argv.slice(2) }));
      const out = (o) => console.log(JSON.stringify(o));
      out({ type: 'init', session_id: 'u2', model: 'm' });
      out({ type: 'message', role: 'assistant', content: '보는 중', delta: true });
      out({ type: 'tool_use', tool_name: 'run_shell_command', tool_id: 't', parameters: { command: 'ls' } });
      out({ type: 'tool_result', tool_id: 't', status: 'success', output: '' });
      out({ type: 'message', role: 'assistant', content: '끝', delta: true });
      out({ type: 'result', status: 'success', stats: { total_tokens: 7 } });
    });`);
  void dir;
  const r = await runGeminiTurn('고쳐줘 "따옴표" & | 와 줄바꿈\n도', tmpdir(), 'u1', undefined, { model: 'gemini:pro' });
  const seen = JSON.parse(await readFile(path.join(tmpdir(), 'fake-gemini-seen.json'), 'utf8'));
  assert.equal(seen.input, '고쳐줘 "따옴표" & | 와 줄바꿈\n도', 'the prompt goes on stdin, untouched');
  for (const flag of ['--output-format', 'stream-json', '--approval-mode', 'yolo', '--skip-trust', '-m', 'pro', '--resume', 'u1']) assert.ok(seen.args.includes(flag), flag);
  assert.equal(r.error, undefined);
  assert.equal(r.sessionId, 'u2');
  assert.equal(r.summary, '끝');
  assert.equal(r.tokensUsed, 7);
});

test('runGeminiTurn: no result event is an error and the session is dropped; a stop ends the turn and its processes', { skip: !posix }, async () => {
  await fakeGemini(`process.stdin.resume(); process.stdin.on('end', () => { console.error('API key not valid'); process.exit(0); });`);
  const r = await runGeminiTurn('hi', tmpdir(), 'bad', undefined, { model: 'gemini:flash' });
  assert.match(r.error ?? '', /API key not valid/);
  assert.equal(r.sessionId, undefined);
  await fakeGemini(`process.on('SIGTERM', () => {}); process.stdin.resume(); setInterval(() => {}, 1000);`);
  const stop = new AbortController();
  setTimeout(() => stop.abort(), 400);
  const started = Date.now();
  const s = await runGeminiTurn('hi', tmpdir(), undefined, undefined, { model: 'gemini:flash', signal: stop.signal });
  assert.equal(s.interrupted, true);
  assert.ok(Date.now() - started < 6000);
});

test('an API error blob from the real CLI comes out as its readable message', () => {
  // Captured from gemini 0.62.0 with an invalid key.
  const blob = '[API Error: {"error":{"message":"{\\n  \\"error\\": {\\n    \\"code\\": 400,\\n    \\"message\\": \\"API key not valid. Please pass a valid API key.\\",\\n    \\"status\\": \\"INVALID_ARGUMENT\\"\\n  }\\n}\\n","code":400,"status":""}}]';
  assert.equal(readableError(blob), 'API key not valid. Please pass a valid API key.');
  assert.equal(readableError('plain words'), 'plain words');
});

test('safe mode: a BeforeTool hook asks the player about risky shell commands only — via a stand-in ~/.gemini that links to the real one', { skip: !posix }, async () => {
  // The player's own ~/.gemini: a login, sessions, and settings of their own.
  const home = await mkdtemp(path.join(tmpdir(), 'gemini-home-'));
  await import('node:fs/promises').then((f) => f.mkdir(path.join(home, '.gemini', 'tmp'), { recursive: true }));
  await writeFile(path.join(home, '.gemini', 'oauth_creds.json'), '{"token":"t"}');
  await writeFile(path.join(home, '.gemini', 'settings.json'), JSON.stringify({ security: { auth: { selectedType: 'oauth-personal' } }, hooks: { AfterTool: [{ matcher: 'x', hooks: [] }] } }));
  const realHome = process.env.HOME;
  process.env.HOME = home;
  // This fake runs the configured hook the way the real CLI does: tool input as JSON on stdin, a decision as JSON on stdout.
  await fakeGemini(`
    const fs = require('node:fs'); const path = require('node:path'); const { execSync } = require('node:child_process');
    const dir = path.join(process.env.GEMINI_CLI_HOME, '.gemini');
    const settings = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'));
    const hook = settings.hooks.BeforeTool.find((h) => h.matcher === 'run_shell_command');
    const ask = (command) => JSON.parse(execSync(hook.hooks[0].command, { input: JSON.stringify({ hook_event_name: 'BeforeTool', tool_name: 'run_shell_command', tool_input: { command } }) }).toString());
    fs.writeFileSync(path.join(dir, 'tmp', 'session.json'), 'saved');
    process.stdin.resume(); process.stdin.on('end', () => {
      const out = (o) => console.log(JSON.stringify(o));
      out({ type: 'init', session_id: 's' });
      out({ type: 'message', role: 'assistant', content: JSON.stringify({ auth: settings.security.auth.selectedType, keptHooks: Object.keys(settings.hooks), enabled: settings.hooksConfig.enabled, creds: fs.readFileSync(path.join(dir, 'oauth_creds.json'), 'utf8'), ls: ask('ls -la'), rm: ask('rm -rf dist'), keep: ask('rm -rf keep') }), delta: true });
      out({ type: 'result', status: 'success', stats: { total_tokens: 1 } });
    });`);
  const asked: string[] = [];
  let r;
  try {
    r = await runGeminiTurn('hi', tmpdir(), undefined, undefined, { model: 'gemini:flash', guard: async (command) => (asked.push(command), command.includes('keep')) });
  } finally {
    process.env.HOME = realHome;
  }
  const seen = JSON.parse(r.summary);
  assert.equal(seen.auth, 'oauth-personal', 'the player\'s own settings still apply');
  assert.deepEqual(seen.keptHooks.sort(), ['AfterTool', 'BeforeTool'], 'and their own hooks');
  assert.equal(seen.enabled, true);
  assert.equal(seen.creds, '{"token":"t"}', 'the login is the real one');
  assert.equal(seen.ls.decision, 'allow', 'ordinary commands pass without asking');
  assert.equal(seen.rm.decision, 'deny');
  assert.match(seen.rm.reason, /refused/);
  assert.equal(seen.keep.decision, 'allow');
  assert.deepEqual(asked, ['rm -rf dist', 'rm -rf keep']);
  const fs = await import('node:fs');
  assert.equal(fs.readFileSync(path.join(home, '.gemini', 'tmp', 'session.json'), 'utf8'), 'saved', 'sessions land in the real ~/.gemini (resume works either way)');
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, '.gemini', 'settings.json'), 'utf8')).hooks.BeforeTool, undefined, 'the real settings are untouched');
  assert.equal(fs.readFileSync(path.join(home, '.gemini', 'oauth_creds.json'), 'utf8'), '{"token":"t"}', 'cleanup left the real files alone');
});
