// test/battle.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { runDungeon, type BattleEvent } from '../src/battle.ts';
import type { TurnResult } from '../src/agent.ts';

const ONE_SHOT_PROMPT = 'test refactor ' + 'x'.repeat(700); // crits at 225 damage, one-shots floors 0-2

function makeFakeDeps(inputs: string[], turnResult: TurnResult = { summary: 'ok', filesChanged: [], commandsRun: [] }) {
  let i = 0;
  const events: BattleEvent[] = [];
  const runTurnCalls: string[] = [];
  return {
    deps: {
      runTurn: async (prompt: string) => {
        runTurnCalls.push(prompt);
        return turnResult;
      },
      readInput: async () => (i < inputs.length ? inputs[i++] : null),
      onBattleEvent: (event: BattleEvent) => events.push(event),
      cwd: '/fake/cwd',
      difficulty: 'normal' as const,
    },
    events,
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

test('empty input emits a hesitate event: no agent call, no damage, loop continues', async () => {
  const { deps, events, runTurnCalls } = makeFakeDeps(['', ONE_SHOT_PROMPT, '/quit']);
  const summary = await runDungeon(deps);
  assert.equal(summary.floorsCleared, 1);
  assert.equal(summary.floorsEngaged, 1);
  assert.equal(runTurnCalls.length, 1);
  assert.ok(events.some((e) => e.type === 'hesitate'));
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

test('an agent turn that throws emits an agentError event and deals no damage', async () => {
  let calls = 0;
  const events: BattleEvent[] = [];
  const deps = {
    runTurn: async () => {
      calls += 1;
      throw new Error('bash exited 1');
    },
    readInput: drain([ONE_SHOT_PROMPT, '/quit']),
    onBattleEvent: (event: BattleEvent) => events.push(event),
    cwd: '/fake/cwd',
    difficulty: 'normal' as const,
  };
  const summary = await runDungeon(deps);
  assert.equal(calls, 1);
  assert.equal(summary.floorsCleared, 0, 'no damage lands when the agent call failed, so the floor is not cleared');
  assert.equal(summary.floorsEngaged, 1, 'the floor was still engaged — a real attack was attempted, it just missed');
  const errorEvent = events.find((e) => e.type === 'agentError');
  assert.ok(errorEvent && errorEvent.type === 'agentError' && errorEvent.error === 'bash exited 1');
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
    onBattleEvent: () => {},
    cwd: '/fake/cwd',
    difficulty: 'normal' as const,
  };
  await runDungeon(deps);
  assert.equal(sessionIdsSeen[0], undefined, 'first turn of a run has no prior session to resume');
  assert.equal(sessionIdsSeen[1], 'session-1', "second turn (a new floor) still receives the first turn's session");
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
        return { summary: '', filesChanged: [], commandsRun: [], error: 'invalid API key', sessionId: 'broken-session' };
      }
      return { summary: '', filesChanged: [], commandsRun: [], sessionId: `session-${turnCount}` };
    },
    readInput: drain([ONE_SHOT_PROMPT, ONE_SHOT_PROMPT, ONE_SHOT_PROMPT, '/quit']),
    onBattleEvent: () => {},
    cwd: '/fake/cwd',
    difficulty: 'normal' as const,
  };
  await runDungeon(deps);
  assert.equal(sessionIdsSeen[0], undefined);
  assert.equal(sessionIdsSeen[1], 'session-1', 'second (failing) turn still resumes the last good session');
  assert.equal(sessionIdsSeen[2], 'session-1', 'third turn resumes the last GOOD session, not the broken one the failed turn reported');
});

test('emits agentEvent for each live file/command event, before the attack event resolves', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  deps.runTurn = async (
    _prompt: string,
    _cwd: string,
    _sessionId?: string,
    onEvent?: (e: { type: 'command' | 'file'; value: string }) => void,
  ) => {
    onEvent?.({ type: 'command', value: 'npm test' });
    onEvent?.({ type: 'file', value: 'src/foo.ts' });
    return { summary: 'done', filesChanged: ['src/foo.ts'], commandsRun: ['npm test'] };
  };
  await runDungeon(deps);
  const agentEventIndices = events.map((e, i) => (e.type === 'agentEvent' ? i : -1)).filter((i) => i !== -1);
  const attackIndex = events.findIndex((e) => e.type === 'attack');
  assert.equal(agentEventIndices.length, 2, 'both live events were forwarded as agentEvent battle events');
  assert.ok(agentEventIndices.every((i) => i < attackIndex), 'agent events arrive before the attack/damage event, proving they are live, not buffered');
});

test('emits turnStart right before a real turn starts (not for hesitate)', async () => {
  const { deps, events } = makeFakeDeps(['', ONE_SHOT_PROMPT, '/quit']);
  await runDungeon(deps);
  const turnStartIndices = events.map((e, i) => (e.type === 'turnStart' ? i : -1)).filter((i) => i !== -1);
  assert.equal(turnStartIndices.length, 1, 'only the real attack triggers turnStart, the hesitate does not');
  const attackIndex = events.findIndex((e) => e.type === 'attack');
  assert.ok(turnStartIndices[0] < attackIndex, 'turnStart fires before the turn resolves');
});

test('deals partial damage per live agentEvent in real time, tapering, with the remainder as the closing attack', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  deps.runTurn = async (
    _prompt: string,
    _cwd: string,
    _sessionId?: string,
    onEvent?: (e: { type: 'command' | 'file'; value: string }) => void,
  ) => {
    onEvent?.({ type: 'command', value: 'npm test' });
    onEvent?.({ type: 'file', value: 'src/foo.ts' });
    return { summary: 'done', filesChanged: ['src/foo.ts'], commandsRun: ['npm test'] };
  };
  const summary = await runDungeon(deps);
  const partialHits = events.filter((e) => e.type === 'partialHit');
  const attack = events.find((e) => e.type === 'attack');
  assert.equal(partialHits.length, 2, 'one partial hit per live event');
  // ONE_SHOT_PROMPT deals 225 total (crit). 40% of remaining per event: 90, then 40% of 135 = 54.
  assert.deepEqual(
    partialHits.map((e) => (e.type === 'partialHit' ? e.damage : -1)),
    [90, 54],
  );
  assert.ok(attack && attack.type === 'attack' && attack.damage === 225 - 90 - 54, 'closing attack carries only the undealt remainder');
  assert.equal(summary.floorsCleared, 1, 'total damage across partial hits + remainder still clears the floor');
});

test('partial hits land for real even if the turn ultimately errors — only the closing/remainder bonus is skipped', async () => {
  // Deliberately not ONE_SHOT_PROMPT: this one's total damage (40) is well
  // under the monster's HP (60) even after landing the partial hit, so
  // skipping the closing bonus is actually observable (the monster survives).
  const SMALL_PROMPT = 'x'.repeat(150); // no keywords, no crit: base = 10 + floor(150/5) = 40
  const { deps, events } = makeFakeDeps([SMALL_PROMPT, '/quit']);
  deps.runTurn = async (
    _prompt: string,
    _cwd: string,
    _sessionId?: string,
    onEvent?: (e: { type: 'command' | 'file'; value: string }) => void,
  ) => {
    onEvent?.({ type: 'file', value: 'src/foo.ts' });
    return { summary: '', filesChanged: [], commandsRun: [], error: 'rate limited' };
  };
  const summary = await runDungeon(deps);
  const partialHits = events.filter((e) => e.type === 'partialHit');
  assert.equal(partialHits.length, 1);
  assert.equal(partialHits[0].type === 'partialHit' ? partialHits[0].damage : -1, 16, '40% of the 40 total landed live before the error');
  assert.equal(summary.floorsCleared, 0, 'the 24 remaining (the closing bonus) is skipped because the turn errored, and 16 alone does not clear a 60-HP monster — matches "no bonus on error"');
});

test('emits floorStart with the monster name/art/maxHp, hpChanged after the attack, and floorCleared', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  await runDungeon(deps);
  const floorStart = events.find((e) => e.type === 'floorStart');
  assert.ok(floorStart && floorStart.type === 'floorStart' && floorStart.monsterName === '버그 고블린' && floorStart.maxHp === 60);
  const hpChanged = events.find((e) => e.type === 'hpChanged');
  assert.ok(hpChanged && hpChanged.type === 'hpChanged' && hpChanged.hp === 0 && hpChanged.maxHp === 60);
  const floorCleared = events.find((e) => e.type === 'floorCleared');
  assert.ok(floorCleared && floorCleared.type === 'floorCleared' && floorCleared.xpGained === 20);
});

test('emits a final runEnded event matching the returned summary', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  const summary = await runDungeon(deps);
  const runEnded = events.find((e) => e.type === 'runEnded');
  assert.ok(runEnded && runEnded.type === 'runEnded');
  if (runEnded && runEnded.type === 'runEnded') {
    assert.deepEqual(
      { floorsCleared: runEnded.floorsCleared, floorsEngaged: runEnded.floorsEngaged, xpGained: runEnded.xpGained },
      summary,
    );
  }
});
