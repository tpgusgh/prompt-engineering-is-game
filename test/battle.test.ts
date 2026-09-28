// test/battle.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { runDungeon } from '../src/battle.ts';
import type { TurnResult } from '../src/agent.ts';

const ONE_SHOT_PROMPT = 'test refactor ' + 'x'.repeat(700); // crits at 225 damage, one-shots floors 0-2

function makeFakeDeps(inputs: string[], turnResult: TurnResult = { summary: 'ok', filesChanged: [], commandsRun: [] }) {
  let i = 0;
  const written: string[] = [];
  const runTurnCalls: string[] = [];
  return {
    deps: {
      runTurn: async (prompt: string) => {
        runTurnCalls.push(prompt);
        return turnResult;
      },
      readInput: async () => (i < inputs.length ? inputs[i++] : null),
      write: (text: string) => written.push(text),
      cwd: '/fake/cwd',
      difficulty: 'normal' as const,
    },
    written,
    runTurnCalls,
  };
}

function drain(inputs: string[]) {
  let i = 0;
  return async () => (i < inputs.length ? inputs[i++] : null);
}

test('clears three floors with one-shot crits, then quits', async () => {
  const { deps, runTurnCalls } = makeFakeDeps([ONE_SHOT_PROMPT, ONE_SHOT_PROMPT, ONE_SHOT_PROMPT, '/quit']);
  const summary = await runDungeon(deps);
  assert.equal(summary.floorsCleared, 3);
  assert.equal(summary.floorsEngaged, 3, 'quitting on a fresh floor before attacking does not count as engaging it');
  assert.equal(summary.xpGained, 20 + 25 + 30);
  assert.equal(runTurnCalls.length, 3);
});

test('empty input is a free hesitate turn: no agent call, no damage, loop continues', async () => {
  const { deps, runTurnCalls } = makeFakeDeps(['', ONE_SHOT_PROMPT, '/quit']);
  const summary = await runDungeon(deps);
  assert.equal(summary.floorsCleared, 1);
  assert.equal(summary.floorsEngaged, 1);
  assert.equal(runTurnCalls.length, 1);
});

test('EOF (null input) ends the run immediately with no floors cleared or engaged', async () => {
  const { deps, runTurnCalls } = makeFakeDeps([]);
  const summary = await runDungeon(deps);
  assert.equal(summary.floorsCleared, 0);
  assert.equal(summary.floorsEngaged, 0);
  assert.equal(summary.xpGained, 0);
  assert.equal(runTurnCalls.length, 0);
});

test('/flee behaves the same as /quit', async () => {
  const { deps } = makeFakeDeps([ONE_SHOT_PROMPT, '/flee']);
  const summary = await runDungeon(deps);
  assert.equal(summary.floorsCleared, 1);
  assert.equal(summary.floorsEngaged, 1);
});

test('an agent turn that throws does not crash the loop and deals no damage', async () => {
  let calls = 0;
  const deps = {
    runTurn: async () => {
      calls += 1;
      throw new Error('bash exited 1');
    },
    readInput: (() => {
      const inputs = [ONE_SHOT_PROMPT, '/quit'];
      let i = 0;
      return async () => (i < inputs.length ? inputs[i++] : null);
    })(),
    write: () => {},
    cwd: '/fake/cwd',
    difficulty: 'normal' as const,
  };
  const summary = await runDungeon(deps);
  assert.equal(calls, 1);
  assert.equal(summary.floorsCleared, 0, 'no damage lands when the agent call failed, so the floor is not cleared');
  assert.equal(summary.floorsEngaged, 1, 'the floor was still engaged — a real attack was attempted, it just missed');
});

test('an agent turn that resolves with TurnResult.error set deals no damage either', async () => {
  const { deps, runTurnCalls } = makeFakeDeps([ONE_SHOT_PROMPT, '/quit'], {
    summary: '',
    filesChanged: [],
    commandsRun: [],
    error: 'invalid API key',
  });
  const summary = await runDungeon(deps);
  assert.equal(runTurnCalls.length, 1);
  assert.equal(summary.floorsCleared, 0, 'a result-level error (no thrown exception) still deals no damage');
  assert.equal(summary.floorsEngaged, 1);
});

test('threads sessionId returned from one turn into the next turn call, across floors, latest wins', async () => {
  const sessionIdsSeen: (string | undefined)[] = [];
  let turnCount = 0;
  const deps = {
    runTurn: async (_prompt: string, _cwd: string, sessionId?: string) => {
      sessionIdsSeen.push(sessionId);
      turnCount += 1;
      return { summary: '', filesChanged: [], commandsRun: [], sessionId: `session-${turnCount}` };
    },
    readInput: drain([ONE_SHOT_PROMPT, ONE_SHOT_PROMPT, ONE_SHOT_PROMPT, '/quit']),
    write: () => {},
    cwd: '/fake/cwd',
    difficulty: 'normal' as const,
  };
  await runDungeon(deps);
  assert.equal(sessionIdsSeen[0], undefined, 'first turn of a run has no prior session to resume');
  assert.equal(sessionIdsSeen[1], 'session-1', 'second turn (a new floor) still receives the first turn\'s session');
  assert.equal(sessionIdsSeen[2], 'session-2', 'third turn receives the most recent session, not the first');
});

test('a failed turn never poisons sessionId for later turns', async () => {
  const sessionIdsSeen: (string | undefined)[] = [];
  let turnCount = 0;
  const deps = {
    runTurn: async (_prompt: string, _cwd: string, sessionId?: string) => {
      sessionIdsSeen.push(sessionId);
      turnCount += 1;
      if (turnCount === 2) {
        // second turn fails but still reports a (broken/unreliable) session id
        return { summary: '', filesChanged: [], commandsRun: [], error: 'invalid API key', sessionId: 'broken-session' };
      }
      return { summary: '', filesChanged: [], commandsRun: [], sessionId: `session-${turnCount}` };
    },
    readInput: drain([ONE_SHOT_PROMPT, ONE_SHOT_PROMPT, ONE_SHOT_PROMPT, '/quit']),
    write: () => {},
    cwd: '/fake/cwd',
    difficulty: 'normal' as const,
  };
  await runDungeon(deps);
  assert.equal(sessionIdsSeen[0], undefined);
  assert.equal(sessionIdsSeen[1], 'session-1', 'second (failing) turn still resumes the last good session');
  assert.equal(sessionIdsSeen[2], 'session-1', 'third turn resumes the last GOOD session, not the broken one the failed turn reported');
});

test('streams file/command events live via deps.write as they happen', async () => {
  const { deps, written } = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  deps.runTurn = async (_prompt: string, _cwd: string, _sessionId?: string, onEvent?: (e: { type: 'command' | 'file'; value: string }) => void) => {
    onEvent?.({ type: 'command', value: 'npm test' });
    onEvent?.({ type: 'file', value: 'src/foo.ts' });
    return { summary: 'done', filesChanged: ['src/foo.ts'], commandsRun: ['npm test'] };
  };
  await runDungeon(deps);
  const commandIndex = written.findIndex((line) => line.includes('npm test'));
  const fileIndex = written.findIndex((line) => line.includes('src/foo.ts'));
  const damageLineIndex = written.findIndex((line) => line.includes('You attack for'));
  assert.notEqual(commandIndex, -1, 'command event was written');
  assert.notEqual(fileIndex, -1, 'file event was written');
  assert.ok(
    commandIndex < damageLineIndex && fileIndex < damageLineIndex,
    'events are written from onEvent during the turn, before the post-turn damage line — not buffered until the turn resolves',
  );
});
