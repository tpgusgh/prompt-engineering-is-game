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
      random: () => 0.99, // no merchant, flee fails — override per test
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
    const { type: _type, ...fields } = runEnded;
    assert.deepEqual(fields, summary);
  }
});

const WEAK_PROMPT = 'x';
const WEAK_PROMPT_2 = 'y'; // same 10 damage, distinguishable in runTurn calls // 10 damage, no crit — floor 0's 60-HP goblin survives it

test('the monster counterattacks after every real turn it survives', async () => {
  const { deps, events } = makeFakeDeps([WEAK_PROMPT, '/quit']);
  await runDungeon(deps);
  const counter = events.find((e) => e.type === 'monsterAttack');
  assert.ok(counter && counter.type === 'monsterAttack' && counter.damage === 6, '10% of the goblin\'s 60 max HP');
  const playerHp = events.filter((e) => e.type === 'playerHpChanged');
  assert.ok(playerHp.some((e) => e.type === 'playerHpChanged' && e.hp === 94 && e.maxHp === 100));
});

test('hesitating is punished with a heavier counterattack', async () => {
  const { deps, events } = makeFakeDeps(['', '/quit']);
  await runDungeon(deps);
  const counter = events.find((e) => e.type === 'monsterAttack');
  assert.ok(counter && counter.type === 'monsterAttack' && counter.damage === 9, '1.5x the normal 6');
});

test('a monster killed by the turn does not counterattack', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  await runDungeon(deps);
  assert.equal(events.filter((e) => e.type === 'monsterAttack').length, 0);
});

test('player HP reaching 0 ends the run as a defeat', async () => {
  const { deps, events, runTurnCalls } = makeFakeDeps([WEAK_PROMPT, WEAK_PROMPT, WEAK_PROMPT, '/quit']);
  const summary = await runDungeon({ ...deps, playerMaxHp: 10 });
  assert.equal(runTurnCalls.length, 2, 'two counters of 6 kill a 10-HP player; the third prompt is never read');
  assert.ok(events.some((e) => e.type === 'playerDefeated'));
  assert.equal(summary.defeated, true);
  assert.equal(summary.floorsCleared, 0);
});

test('clearing a floor heals the player a little', async () => {
  const { deps, events } = makeFakeDeps([WEAK_PROMPT, ONE_SHOT_PROMPT, '/quit']);
  await runDungeon(deps);
  const hpValues = events.filter((e) => e.type === 'playerHpChanged').map((e) => (e.type === 'playerHpChanged' ? e.hp : -1));
  assert.deepEqual(hpValues, [94, 100], 'counter to 94, then the floor-clear heal caps back at 100');
});

test('every 6th floor is a chapter boss with 1.5x HP, and clearing it emits chapterCleared', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  const summary = await runDungeon({ ...deps, startFloor: 5, getDamageMultiplier: () => 10 });
  const floorStart = events.find((e) => e.type === 'floorStart');
  assert.ok(floorStart && floorStart.type === 'floorStart');
  if (floorStart && floorStart.type === 'floorStart') {
    assert.equal(floorStart.isBoss, true);
    assert.equal(floorStart.chapter, 1);
    assert.equal(floorStart.monsterIndex, 5);
    assert.equal(floorStart.maxHp, Math.round(495 * 1.5), 'floor-5 dragon (495) boosted 1.5x as a boss');
  }
  assert.ok(events.some((e) => e.type === 'chapterCleared' && e.chapter === 1));
  assert.equal(summary.chaptersCleared, 1);
  assert.equal(summary.nextFloor, 6);
});

test('startFloor resumes the story mid-way (chapter 2 starts at floor 6)', async () => {
  const { deps, events } = makeFakeDeps(['/quit']);
  const summary = await runDungeon({ ...deps, startFloor: 6 });
  const floorStart = events.find((e) => e.type === 'floorStart');
  assert.ok(floorStart && floorStart.type === 'floorStart' && floorStart.chapter === 2 && floorStart.isBoss === false);
  assert.equal(summary.chaptersCleared, 1, 'chapters behind the start floor still count as cleared');
  assert.equal(summary.nextFloor, 6);
});

test('the weapon multiplier scales the prompt\'s total damage', async () => {
  const { deps, events } = makeFakeDeps([WEAK_PROMPT, '/quit']);
  await runDungeon({ ...deps, getDamageMultiplier: () => 1.5 });
  const attack = events.find((e) => e.type === 'attack');
  assert.ok(attack && attack.type === 'attack' && attack.damage === 15, '10 base x 1.5');
});

test('/new resets the session and runs the rest of the line as a fresh-session prompt', async () => {
  const sessionIdsSeen: (string | undefined)[] = [];
  const events: BattleEvent[] = [];
  const deps = {
    runTurn: async (_prompt: string, _cwd: string, sessionId?: string) => {
      sessionIdsSeen.push(sessionId);
      return { summary: '', filesChanged: [], commandsRun: [], sessionId: 'session-old' };
    },
    readInput: drain([WEAK_PROMPT, '/new keep going', '/quit']),
    onBattleEvent: (e: BattleEvent) => events.push(e),
    cwd: '/fake/cwd',
    difficulty: 'normal' as const,
  };
  await runDungeon(deps);
  assert.deepEqual(sessionIdsSeen, [undefined, undefined], 'the /new turn resumes nothing');
  assert.ok(events.some((e) => e.type === 'sessionReset'));
});

test('warns once when the session context passes 80% of the window', async () => {
  const events: BattleEvent[] = [];
  const deps = {
    runTurn: async () => ({
      summary: 'done',
      filesChanged: [],
      commandsRun: [],
      sessionId: 's1',
      contextTokens: 170000,
      contextWindow: 200000,
    }),
    readInput: drain([WEAK_PROMPT, WEAK_PROMPT, '/quit']),
    onBattleEvent: (e: BattleEvent) => events.push(e),
    cwd: '/fake/cwd',
    difficulty: 'normal' as const,
  };
  await runDungeon(deps);
  const warnings = events.filter((e) => e.type === 'sessionNearlyFull');
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0].type === 'sessionNearlyFull' && warnings[0].usedTokens === 170000 && warnings[0].contextWindow === 200000);
});

// Returns the given values in order, then repeats the last one.
function seq(...values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

test('successful flee (roll < 0.5) skips to the next floor with no XP, no coins, no heal', async () => {
  const { deps, events, runTurnCalls } = makeFakeDeps(['/flee', '/quit']);
  const summary = await runDungeon({ ...deps, random: () => 0.1 });
  assert.ok(events.some((e) => e.type === 'fleeAttempt' && e.success));
  const floors = events.filter((e) => e.type === 'floorStart').map((e) => (e.type === 'floorStart' ? e.floor : -1));
  assert.deepEqual(floors, [0, 1]);
  assert.equal(summary.floorsCleared, 0);
  assert.equal(summary.xpGained, 0);
  assert.equal(summary.coins, 0);
  assert.equal(summary.nextFloor, 1);
  assert.equal(runTurnCalls.length, 0);
});

test('failed flee costs the turn: the monster counterattacks and the floor stays', async () => {
  const { deps, events } = makeFakeDeps(['/flee', '/quit']);
  await runDungeon({ ...deps, random: () => 0.9 });
  assert.ok(events.some((e) => e.type === 'fleeAttempt' && !e.success));
  const counter = events.find((e) => e.type === 'monsterAttack');
  assert.ok(counter && counter.type === 'monsterAttack' && counter.damage === 6);
  assert.equal(events.filter((e) => e.type === 'floorStart').length, 1);
});

test('cannot flee from a boss, and trying costs nothing', async () => {
  const { deps, events } = makeFakeDeps(['/flee', '/quit']);
  await runDungeon({ ...deps, startFloor: 5, random: () => 0.1 });
  assert.ok(events.some((e) => e.type === 'fleeBlocked'));
  assert.equal(events.filter((e) => e.type === 'monsterAttack').length, 0);
});

test('clearing a floor earns coins (boss pays triple); coins carry over from startCoins', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  const summary = await runDungeon({ ...deps, coins: 5 });
  assert.ok(events.some((e) => e.type === 'coinsChanged' && e.gained === 10 && e.coins === 15));
  assert.equal(summary.coins, 15);

  const boss = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  const bossSummary = await runDungeon({ ...boss.deps, startFloor: 5, getDamageMultiplier: () => 10 });
  assert.equal(bossSummary.coins, (10 + 5 * 2) * 3);
});

test('the merchant appears after a clear on a low roll; /buy spends coins, /leave moves on', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/buy potion', '/buy crystal', '/leave', '/quit']);
  const summary = await runDungeon({ ...deps, coins: 50, random: seq(0.1, 0.99) });
  assert.ok(events.some((e) => e.type === 'merchantOpen' && e.coins === 60));
  assert.ok(events.some((e) => e.type === 'purchased' && e.itemId === 'potion' && e.coins === 30));
  assert.ok(events.some((e) => e.type === 'purchaseFailed' && e.itemId === 'crystal'), '30 coins cannot buy an 80-coin crystal');
  assert.ok(events.some((e) => e.type === 'merchantClosed'));
  assert.equal(summary.coins, 30);
  assert.deepEqual(summary.bag, { potion: 1 });
});

test('typing a prompt at the merchant closes the shop and attacks the next monster with it', async () => {
  const { deps, runTurnCalls } = makeFakeDeps([ONE_SHOT_PROMPT, WEAK_PROMPT_2, '/quit']);
  await runDungeon({ ...deps, random: seq(0.1, 0.99) });
  assert.deepEqual(runTurnCalls, [ONE_SHOT_PROMPT, WEAK_PROMPT_2]);
});

test('life crystal raises max HP permanently and is reported in the summary', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/buy crystal', '/leave', '/quit']);
  const summary = await runDungeon({ ...deps, coins: 100, random: seq(0.1, 0.99) });
  assert.equal(summary.playerMaxHp, 110);
  assert.ok(events.some((e) => e.type === 'playerHpChanged' && e.maxHp === 110));
  assert.deepEqual(summary.bag, {});
});

test('/use potion heals as a free action (no counterattack) and consumes the item', async () => {
  const { deps, events } = makeFakeDeps([WEAK_PROMPT_2, '/use potion', '/use potion', '/quit']);
  const summary = await runDungeon({ ...deps, bag: { potion: 1 }, playerMaxHp: 100 });
  const hp = events.filter((e) => e.type === 'playerHpChanged').map((e) => (e.type === 'playerHpChanged' ? e.hp : -1));
  assert.deepEqual(hp, [94, 100]);
  assert.equal(events.filter((e) => e.type === 'monsterAttack').length, 1, 'only the attack drew a counter');
  assert.ok(events.some((e) => e.type === 'itemUseFailed' && e.itemId === 'potion'), 'second use: none left');
  assert.deepEqual(summary.bag, {});
});

test('whetstone doubles the next attack only', async () => {
  const { deps, events } = makeFakeDeps(['/use whetstone', WEAK_PROMPT_2, WEAK_PROMPT_2, '/quit']);
  await runDungeon({ ...deps, bag: { whetstone: 1 } });
  const attacks = events.filter((e) => e.type === 'attack').map((e) => (e.type === 'attack' ? e.damage : -1));
  assert.deepEqual(attacks, [20, 10]);
});

test('amulet blocks the next counterattack', async () => {
  const { deps, events } = makeFakeDeps(['/use amulet', WEAK_PROMPT_2, WEAK_PROMPT_2, '/quit']);
  await runDungeon({ ...deps, bag: { amulet: 1 } });
  assert.equal(events.filter((e) => e.type === 'counterBlocked').length, 1);
  assert.equal(events.filter((e) => e.type === 'monsterAttack').length, 1);
});

test('smoke bomb flees for sure; wasted on a boss it is not consumed', async () => {
  const { deps, events } = makeFakeDeps(['/use smoke', '/quit']);
  const summary = await runDungeon({ ...deps, bag: { smoke: 1 } });
  assert.ok(events.some((e) => e.type === 'fleeAttempt' && e.success));
  assert.deepEqual(summary.bag, {});

  const boss = makeFakeDeps(['/use smoke', '/quit']);
  const bossSummary = await runDungeon({ ...boss.deps, startFloor: 5, bag: { smoke: 1 } });
  assert.ok(boss.events.some((e) => e.type === 'fleeBlocked'));
  assert.deepEqual(bossSummary.bag, { smoke: 1 });
});

test('turnStart carries the prompt text (for chat history)', async () => {
  const { deps, events } = makeFakeDeps([WEAK_PROMPT_2, '/quit']);
  await runDungeon(deps);
  assert.ok(events.some((e) => e.type === 'turnStart' && e.prompt === WEAK_PROMPT_2));
});

test('initialSessionId resumes a saved session; each adopted id is announced via sessionSaved', async () => {
  const seen: (string | undefined)[] = [];
  const { deps, events } = makeFakeDeps([WEAK_PROMPT_2, '/quit']);
  deps.runTurn = async (_p: string, _c: string, sessionId?: string) => {
    seen.push(sessionId);
    return { summary: '', filesChanged: [], commandsRun: [], sessionId: 'saved-1' };
  };
  await runDungeon({ ...deps, initialSessionId: 'saved-1' });
  assert.deepEqual(seen, ['saved-1']);
  assert.ok(events.some((e) => e.type === 'sessionSaved' && e.sessionId === 'saved-1'));
});

test('a resumed session that fails before ever succeeding is dropped for a fresh one', async () => {
  const seen: (string | undefined)[] = [];
  let n = 0;
  const { deps, events } = makeFakeDeps([WEAK_PROMPT_2, WEAK_PROMPT_2, '/quit']);
  deps.runTurn = async (_p: string, _c: string, sessionId?: string) => {
    seen.push(sessionId);
    n += 1;
    return n === 1
      ? { summary: '', filesChanged: [], commandsRun: [], error: 'No conversation found' }
      : { summary: '', filesChanged: [], commandsRun: [], sessionId: 'fresh' };
  };
  await runDungeon({ ...deps, initialSessionId: 'stale' });
  assert.deepEqual(seen, ['stale', undefined]);
  assert.ok(events.some((e) => e.type === 'sessionReset'));
});

test('odd/even bet at the merchant: a win pays the stake back double', async () => {
  // rolls: merchant appears (0.1), die = floor(0.4*6)+1 = 3 (odd), then no more merchants
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/bet odd 5', '/leave', '/quit']);
  const summary = await runDungeon({ ...deps, random: seq(0.1, 0.4, 0.99) });
  assert.ok(events.some((e) => e.type === 'betResult' && e.choice === 'odd' && e.roll === 3 && e.won && e.amount === 5 && e.coins === 15));
  assert.equal(summary.coins, 15, '10 from the clear, +5 net win');
});

test('a losing bet takes the stake', async () => {
  // die = floor(0.2*6)+1 = 2 (even) vs odd
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/bet odd 4', '/leave', '/quit']);
  const summary = await runDungeon({ ...deps, random: seq(0.1, 0.2, 0.99) });
  assert.ok(events.some((e) => e.type === 'betResult' && e.roll === 2 && !e.won && e.coins === 6));
  assert.equal(summary.coins, 6);
});

test('bets must be a whole amount between 1 and your coins; Korean 홀/짝 work too', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/bet odd 11', '/bet odd 0', '/bet red 1', '/bet 짝 10', '/leave', '/quit']);
  const summary = await runDungeon({ ...deps, random: seq(0.1, 0.9, 0.99) }); // die 6 = even
  assert.equal(events.filter((e) => e.type === 'betFailed').length, 3);
  assert.ok(events.some((e) => e.type === 'betResult' && e.choice === 'even' && e.won && e.coins === 20));
  assert.equal(summary.coins, 20);
});

test('defense reduces monster counterattacks', async () => {
  const { deps, events } = makeFakeDeps([WEAK_PROMPT_2, '/quit']);
  await runDungeon({ ...deps, stats: { attack: 0, defense: 10, vitality: 0 } });
  const counter = events.find((e) => e.type === 'monsterAttack');
  assert.ok(counter && counter.type === 'monsterAttack' && counter.damage === 3, '6 halved');
});

test('contextUsage is reported after each turn that knows its context size', async () => {
  const { deps, events } = makeFakeDeps([WEAK_PROMPT_2, '/quit'], {
    summary: '', filesChanged: [], commandsRun: [], sessionId: 's', contextTokens: 12000, contextWindow: 200000,
  });
  await runDungeon(deps);
  assert.ok(events.some((e) => e.type === 'contextUsage' && e.usedTokens === 12000 && e.contextWindow === 200000));
});

test('each monster defeated grants a free stat point; /stat spends it as a free action', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/stat vitality', '/stat attack', WEAK_PROMPT_2, '/quit']);
  const summary = await runDungeon(deps);
  assert.ok(events.some((e) => e.type === 'statPointsChanged' && e.points === 1));
  assert.ok(events.some((e) => e.type === 'statRaised' && e.stat === 'vitality' && e.points === 0));
  assert.ok(events.some((e) => e.type === 'statRaiseFailed'), 'second /stat has no point left');
  assert.deepEqual(summary.stats, { attack: 0, defense: 0, vitality: 1 });
  assert.equal(summary.statPoints, 0);
  assert.equal(summary.playerMaxHp, 110, 'vitality raises max HP right away');
  assert.ok(events.some((e) => e.type === 'playerHpChanged' && e.maxHp === 110));
});

test('attack stat and sword level both scale damage', async () => {
  const { deps, events } = makeFakeDeps([WEAK_PROMPT_2, '/quit']);
  await runDungeon({ ...deps, stats: { attack: 5, defense: 0, vitality: 0 }, swordLevel: 2 });
  const attack = events.find((e) => e.type === 'attack');
  assert.ok(attack && attack.type === 'attack' && attack.damage === 18, '10 x 1.5 x 1.2');
});

test('unspent stat points carry over, and a maxed stat refuses', async () => {
  const { deps, events } = makeFakeDeps(['/stat attack', '/quit']);
  const summary = await runDungeon({ ...deps, statPoints: 2, stats: { attack: 10, defense: 0, vitality: 0 } });
  assert.ok(events.some((e) => e.type === 'statRaiseFailed'));
  assert.equal(summary.statPoints, 2);
});

test('blacksmith appears on a 0.3-0.5 roll; a successful enhance costs coins and adds a level', async () => {
  // rolls: encounter 0.35 (blacksmith), enhance success roll 0.0, then nothing
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/enhance', '/leave', '/quit']);
  const summary = await runDungeon({ ...deps, coins: 100, random: seq(0.35, 0.0, 0.99) });
  assert.ok(events.some((e) => e.type === 'blacksmithOpen' && e.swordLevel === 0));
  assert.ok(events.some((e) => e.type === 'enhanceResult' && e.outcome === 'success' && e.swordLevel === 1));
  assert.equal(summary.swordLevel, 1);
  assert.equal(summary.coins, 110 - 20);
  assert.ok(events.some((e) => e.type === 'blacksmithClosed'));
});

test('a failed enhance at a high level can break the sword back to +0', async () => {
  // at +5: success roll 0.99 fails, break roll 0.0 breaks
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/enhance', '/leave', '/quit']);
  const summary = await runDungeon({ ...deps, coins: 500, swordLevel: 5, random: seq(0.35, 0.99, 0.0, 0.99) });
  assert.ok(events.some((e) => e.type === 'enhanceResult' && e.outcome === 'broken' && e.swordLevel === 0));
  assert.equal(summary.swordLevel, 0);
});

test('a failed enhance without breaking keeps the level; no coins means no enhance', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/enhance', '/leave', '/quit']);
  const summary = await runDungeon({ ...deps, coins: 500, swordLevel: 5, random: seq(0.35, 0.99, 0.99) });
  assert.ok(events.some((e) => e.type === 'enhanceResult' && e.outcome === 'fail' && e.swordLevel === 5));
  assert.equal(summary.swordLevel, 5);

  const poor = makeFakeDeps([ONE_SHOT_PROMPT, '/enhance', '/leave', '/quit']);
  await runDungeon({ ...poor.deps, coins: 0, random: seq(0.35, 0.99) });
  assert.ok(poor.events.some((e) => e.type === 'enhanceFailed'));
});

test('/save N snapshots the run as a free action (no turn, no counter)', async () => {
  const { deps, events } = makeFakeDeps([WEAK_PROMPT_2, '/save 2', '/quit']);
  deps.runTurn = async () => ({ summary: '', filesChanged: [], commandsRun: [], sessionId: 'sess-1' });
  await runDungeon({ ...deps, coins: 7, swordLevel: 3, statPoints: 1, bag: { potion: 1 } });
  const snap = events.find((e) => e.type === 'snapshot');
  assert.ok(snap && snap.type === 'snapshot');
  if (snap && snap.type === 'snapshot') {
    assert.equal(snap.slot, 2);
    assert.deepEqual(snap.state, {
      floor: 0, playerHp: 94, playerMaxHp: 100, coins: 7, bag: { potion: 1 },
      stats: { attack: 0, defense: 0, vitality: 0 }, statPoints: 1, swordLevel: 3, sessionId: 'sess-1',
    });
  }
  assert.equal(events.filter((e) => e.type === 'monsterAttack').length, 1);
});

test('/save with a bad slot is refused', async () => {
  const { deps, events } = makeFakeDeps(['/save 9', '/quit']);
  await runDungeon(deps);
  assert.ok(events.some((e) => e.type === 'saveFailed'));
  assert.equal(events.filter((e) => e.type === 'snapshot').length, 0);
});

test('playerHp starts a loaded run at the saved HP', async () => {
  const { deps, events } = makeFakeDeps(['/quit']);
  await runDungeon({ ...deps, playerHp: 40, playerMaxHp: 120 });
  assert.ok(events.some((e) => e.type === 'runStart' && e.playerHp === 40 && e.playerMaxHp === 120));
});

test('/session <id> swaps the Claude session mid-run; the next turn resumes it', async () => {
  const seen: (string | undefined)[] = [];
  const { deps, events } = makeFakeDeps([WEAK_PROMPT_2, '/session other-id', WEAK_PROMPT_2, '/quit']);
  deps.runTurn = async (_p: string, _c: string, sessionId?: string) => {
    seen.push(sessionId);
    return { summary: '', filesChanged: [], commandsRun: [], sessionId: sessionId ?? 'first' };
  };
  await runDungeon(deps);
  assert.deepEqual(seen, [undefined, 'other-id']);
  assert.ok(events.some((e) => e.type === 'sessionSwitched' && e.sessionId === 'other-id'));
});
