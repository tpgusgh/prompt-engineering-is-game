// test/battle.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { runDungeon, bestiary, AUTO_SAVE_SLOT, type BattleEvent } from '../src/battle.ts';
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
      shopRandom: () => 0.99, // no contract on the shelf
      chests: false, // treasure chests have their own tests below
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

for (const summary of ['수정할까요?', '어느 쪽으로 할까요?\n\n- A안\n- B안', 'Which one? **']) {
  test(`the monster waits while the AI's reply asks the player something: ${JSON.stringify(summary)}`, async () => {
    const { deps, events } = makeFakeDeps([WEAK_PROMPT, '/quit'], { summary, filesChanged: [], commandsRun: [] });
    await runDungeon(deps);
    assert.equal(events.filter((e) => e.type === 'monsterAttack').length, 0);
    assert.ok(events.some((e) => e.type === 'monsterWaits'));
  });
}

test('a question mid-reply does not stop the counterattack', async () => {
  const { deps, events } = makeFakeDeps([WEAK_PROMPT, '/quit'], { summary: '왜 안 됐을까? 원인은 오타였고 고쳤습니다.', filesChanged: [], commandsRun: [] });
  await runDungeon(deps);
  assert.equal(events.filter((e) => e.type === 'monsterAttack').length, 1);
});

test('a monster killed by the turn does not counterattack', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  await runDungeon(deps);
  assert.equal(events.filter((e) => e.type === 'monsterAttack').length, 0);
});

test('player HP reaching 0 ends the run as a defeat', async () => {
  const { deps, events, runTurnCalls } = makeFakeDeps([WEAK_PROMPT, WEAK_PROMPT, WEAK_PROMPT, '/quit']);
  const summary = await runDungeon({ ...deps, playerMaxHp: 100, playerHp: 10 });
  assert.equal(runTurnCalls.length, 2, 'two counters of 6 kill a hero at 10 HP; the third prompt is never read');
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
    assert.equal(floorStart.maxHp, Math.round(550 * 1.5), 'floor-5 dragon (220 x 2.5 = 550) boosted 1.5x as a boss');
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
  assert.ok(events.some((e) => e.type === 'sessionReset' && e.reason === 'new'));
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
  assert.ok(events.some((e) => e.type === 'purchased' && e.itemId === 'potion' && e.coins === 27), 'potion 30 x1.1 on the way to floor 2 = 33');
  assert.ok(events.some((e) => e.type === 'purchaseFailed' && e.itemId === 'crystal'), '27 coins cannot buy an 88-coin crystal');
  assert.ok(events.some((e) => e.type === 'merchantClosed'));
  assert.equal(summary.coins, 27);
  assert.deepEqual(summary.bag, { potion: 1 });
});

test('typing a prompt at the merchant closes the shop and attacks the next monster with it', async () => {
  const { deps, runTurnCalls } = makeFakeDeps([ONE_SHOT_PROMPT, WEAK_PROMPT_2, '/quit']);
  await runDungeon({ ...deps, random: seq(0.1, 0.99) });
  assert.deepEqual(runTurnCalls, [ONE_SHOT_PROMPT, WEAK_PROMPT_2]);
});

test('life crystal raises max HP for the run and is reported in the summary', async () => {
  // The shelf rotates: the crystal is on the second visit's five.
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/leave', ONE_SHOT_PROMPT, '/buy crystal', '/leave', '/quit']);
  const summary = await runDungeon({ ...deps, coins: 100, random: seq(0.1, 0.1, 0.99) });
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

test('vitality adds 10% of the current max HP, not a flat 10', async () => {
  const { deps } = makeFakeDeps([ONE_SHOT_PROMPT, '/stat vitality', '/quit']);
  const summary = await runDungeon({ ...deps, playerMaxHp: 200 });
  assert.equal(summary.playerMaxHp, 220);
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
  const snap = events.find((e) => e.type === 'snapshot' && e.slot === 2);
  assert.ok(snap && snap.type === 'snapshot');
  if (snap && snap.type === 'snapshot') {
    assert.equal(snap.slot, 2);
    assert.deepEqual(snap.state, {
      floor: 0, playerHp: 94, playerMaxHp: 100, coins: 7, bag: { potion: 1 },
      stats: { attack: 0, defense: 0, vitality: 0 }, statPoints: 1, swordLevel: 3, sessionId: 'sess-1', monsterHp: 47, // 60 - 10 x 1.3 (sword +3)
    });
  }
  assert.equal(events.filter((e) => e.type === 'monsterAttack').length, 1);
});

test('/save with a bad slot is refused', async () => {
  const { deps, events } = makeFakeDeps(['/save 9', '/quit']);
  await runDungeon(deps);
  assert.ok(events.some((e) => e.type === 'saveFailed'));
  assert.equal(events.filter((e) => e.type === 'snapshot' && e.slot > 0 && e.slot !== AUTO_SAVE_SLOT).length, 0);
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


test('a save mid-fight records the monster HP, and loading restores it', async () => {
  const { deps, events } = makeFakeDeps([WEAK_PROMPT_2, '/save 1', '/quit']);
  await runDungeon(deps);
  const snap = events.find((e) => e.type === 'snapshot' && e.slot === 1);
  assert.ok(snap && snap.type === 'snapshot' && snap.state.monsterHp === 50, '60 - 10');

  const loaded = makeFakeDeps(['/quit']);
  await runDungeon({ ...loaded.deps, monsterHp: 50 });
  const hp = loaded.events.find((e) => e.type === 'hpChanged');
  assert.ok(hp && hp.type === 'hpChanged' && hp.hp === 50 && hp.maxHp === 60);
});

test('a save at the shop has no monster HP (the next monster starts fresh)', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/save 1', '/leave', '/quit']);
  await runDungeon({ ...deps, random: seq(0.1, 0.99) });
  const snap = events.find((e) => e.type === 'snapshot' && e.slot === 1);
  assert.ok(snap && snap.type === 'snapshot' && snap.state.monsterHp === undefined && snap.state.floor === 1);
});


test('typing hits (bound by the host) deal damage only while a turn is running', async () => {
  let hit: ((damage: number) => boolean) | undefined;
  const { deps, events } = makeFakeDeps([WEAK_PROMPT_2, '/quit']);
  let outside: boolean | undefined;
  deps.runTurn = async () => {
    hit?.(1);
    hit?.(1);
    return { summary: '', filesChanged: [], commandsRun: [] };
  };
  const readInput = deps.readInput;
  deps.readInput = async () => {
    if (outside === undefined && hit) outside = hit(1); // before the first turn: refused
    return readInput();
  };
  await runDungeon({ ...deps, bindExternalHit: (fn) => (hit = fn) });
  assert.equal(outside, false);
  assert.equal(events.filter((e) => e.type === 'typingHit').length, 2);
  const attack = events.find((e) => e.type === 'attack');
  assert.ok(attack && attack.type === 'attack' && attack.damage === 10);
  const lastHp = events.filter((e) => e.type === 'hpChanged').pop();
  assert.ok(lastHp && lastHp.type === 'hpChanged' && lastHp.hp === 60 - 2 - 10);
});

test('autosave: a slot-0 snapshot is emitted each time the game waits for input, with the live state', async () => {
  const { deps, events } = makeFakeDeps([WEAK_PROMPT_2, '/stat vitality', '/quit']);
  deps.runTurn = async () => ({ summary: '', filesChanged: [], commandsRun: [], sessionId: 'sess-a' });
  await runDungeon({ ...deps, statPoints: 1 });
  const autos = events.filter((e) => e.type === 'snapshot' && e.slot === 0);
  assert.equal(autos.length, 3, 'one before each of the three inputs');
  const last = autos[autos.length - 1];
  assert.ok(last.type === 'snapshot');
  if (last.type === 'snapshot') {
    assert.equal(last.state.sessionId, 'sess-a');
    assert.equal(last.state.monsterHp, 50);
    assert.equal(last.state.playerHp, 104, '94 after the counter, +10 from vitality');
    assert.equal(last.state.playerMaxHp, 110);
    assert.deepEqual(last.state.stats, { attack: 0, defense: 0, vitality: 1 });
  }
});

test('/use bandage heals a little (a cheaper potion)', async () => {
  const { deps, events } = makeFakeDeps([WEAK_PROMPT_2, '/use bandage', '/quit']);
  const summary = await runDungeon({ ...deps, bag: { bandage: 2 } });
  const hp = events.filter((e) => e.type === 'playerHpChanged').map((e) => (e.type === 'playerHpChanged' ? e.hp : -1));
  assert.deepEqual(hp, [94, 100], '94 + 15, capped at 100');
  assert.deepEqual(summary.bag, { bandage: 1 });
});

test('the auto slot (4) always holds the latest state, including a wounded monster', async () => {
  const { deps, events } = makeFakeDeps(['x', '/quit']); // 10 damage: goblin 60 → 50
  await runDungeon({ ...deps, coins: 3 });
  const autos = events.filter((e) => e.type === 'snapshot' && e.slot === AUTO_SAVE_SLOT);
  const last = autos.at(-1);
  assert.ok(last && last.type === 'snapshot' && last.state.floor === 0 && last.state.monsterHp === 50, 'saved after the 10-damage hit (60 → 50)');
});

test('the auto slot cannot be written by /save', async () => {
  const { deps, events } = makeFakeDeps([`/save ${AUTO_SAVE_SLOT}`, '/quit']);
  await runDungeon(deps);
  assert.ok(events.some((e) => e.type === 'saveFailed'));
});

type Ev = { type: string; [k: string]: unknown };
function scriptedTurn(events: Ev[], result: Record<string, unknown> = { summary: 'done', filesChanged: [], commandsRun: [] }) {
  return async (_p: string, _c: string, _s?: string, onEvent?: (e: any) => void) => {
    for (const e of events) onEvent?.(e);
    return result as any;
  };
}

test('every successful tool result lands its own hit (25% of the prompt damage, 1..12); the full prompt damage closes', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  deps.runTurn = scriptedTurn([
    { type: 'command', value: 'npm test', toolId: 't1' },
    { type: 'toolResult', toolId: 't1', output: 'ok', isError: false },
    { type: 'file', value: 'src/a.ts', toolId: 't2' },
    { type: 'toolResult', toolId: 't2', output: 'ok', isError: false },
  ]);
  await runDungeon(deps);
  const hits = events.filter((e) => e.type === 'partialHit').map((e) => (e.type === 'partialHit' ? e.damage : -1));
  assert.deepEqual(hits, [12, 12], '225 * 0.25 capped at 12, once per successful action');
  const attack = events.find((e) => e.type === 'attack');
  assert.ok(attack && attack.type === 'attack' && attack.damage === 225, 'the closing blow is the whole prompt damage');
});

test('more work = more damage: a short prompt still wins by doing many actions', async () => {
  const SHORT = 'x'.repeat(50); // 20 prompt damage → 5 per action
  const actions = Array.from({ length: 10 }, (_, i) => [
    { type: 'command', value: `step ${i}`, toolId: `t${i}` },
    { type: 'toolResult', toolId: `t${i}`, output: 'ok', isError: false },
  ]).flat();
  const { deps } = makeFakeDeps([SHORT, '/quit']);
  deps.runTurn = scriptedTurn(actions);
  const summary = await runDungeon(deps);
  assert.equal(summary.floorsCleared, 1, '10 actions x 5 + 20 closing = 70 > the 60-HP goblin');
});

test('failed tool results do not hit; calls alone do not hit; text and party events do not hit', async () => {
  const { deps, events } = makeFakeDeps([WEAK_PROMPT_2, '/quit']);
  deps.runTurn = scriptedTurn([
    { type: 'text', value: 'hi' },
    { type: 'agentStart', id: 'a1', agentType: 'wizard', description: 'scout' },
    { type: 'command', value: 'ls', toolId: 't1', agentId: 'a1' },
    { type: 'toolResult', toolId: 't1', output: 'blocked by hook', isError: true },
    { type: 'command', value: 'pwd', toolId: 't2' },
    { type: 'agentEnd', id: 'a1' },
  ]);
  await runDungeon(deps);
  assert.equal(events.filter((e) => e.type === 'partialHit').length, 0);
  assert.equal(events.filter((e) => e.type === 'agentEvent').length, 6, 'all are still forwarded for the UI');
});

test('action hits land even if the turn later errors; only the closing blow is skipped', async () => {
  const { deps, events } = makeFakeDeps(['x'.repeat(150), '/quit']); // 40 damage → 10 per action
  deps.runTurn = scriptedTurn(
    [{ type: 'command', value: 'npm test', toolId: 't1' }, { type: 'toolResult', toolId: 't1', output: 'ok', isError: false }],
    { summary: '', filesChanged: [], commandsRun: [], error: 'rate limited' },
  );
  const summary = await runDungeon(deps);
  assert.deepEqual(events.filter((e) => e.type === 'partialHit').map((e) => (e.type === 'partialHit' ? e.damage : -1)), [10]);
  assert.equal(events.filter((e) => e.type === 'attack').length, 0);
  assert.equal(summary.floorsCleared, 0);
});

test('a stopped (interrupted) turn keeps its hits, skips the closing blow, and the monster waits (no counter)', async () => {
  const { deps, events } = makeFakeDeps(['x'.repeat(150), '/quit']);
  deps.runTurn = scriptedTurn(
    [{ type: 'command', value: 'npm test', toolId: 't1' }, { type: 'toolResult', toolId: 't1', output: 'ok', isError: false }],
    { summary: 'partial', filesChanged: [], commandsRun: [], interrupted: true, sessionId: 's-int' },
  );
  await runDungeon(deps);
  assert.ok(events.some((e) => e.type === 'turnInterrupted'));
  assert.equal(events.filter((e) => e.type === 'attack' || e.type === 'agentError').length, 0);
  assert.equal(events.filter((e) => e.type === 'monsterAttack').length, 0, 'stopping lets you type again instead of taking a hit');
  assert.ok(events.some((e) => e.type === 'monsterWaits'));
  assert.ok(events.some((e) => e.type === 'sessionSaved' && e.sessionId === 's-int'), 'the session is kept');
});

test('the run reports its stats: turns, tokens, tests passed, edits, crits, best hit, floors per model', async () => {
  const { deps } = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  deps.runTurn = scriptedTurn(
    [
      { type: 'command', value: 'npm test', toolId: 't1' },
      { type: 'toolResult', toolId: 't1', output: 'ok', isError: false },
      { type: 'file', value: 'src/a.ts', toolId: 't2' },
      { type: 'toolResult', toolId: 't2', output: 'ok', isError: false },
      { type: 'command', value: 'npm test', toolId: 't3' },
      { type: 'toolResult', toolId: 't3', output: 'fail', isError: true },
    ],
    { summary: 'done', filesChanged: [], commandsRun: [], tokensUsed: 500 },
  );
  const summary = await runDungeon({ ...deps, getModel: () => 'sonnet' });
  const s = summary.runStats;
  assert.equal(s.turns, 1);
  assert.equal(s.tokens, 500);
  assert.equal(s.testsPassed, 1, 'the failed test run does not count');
  assert.equal(s.filesEdited, 1);
  assert.equal(s.crits, 1);
  assert.equal(s.bestHit, 225);
  assert.equal(s.floorsCleared, 1);
  assert.deepEqual(s.byModel, { sonnet: { engaged: 1, cleared: 1 } });
  assert.deepEqual(s.seen, [0, 1], 'floor 0 fought, floor 1 met before quitting');
  assert.deepEqual(s.kills, { 0: 1 });
});

test('typing-drill hits count as typed lines', async () => {
  let hit: ((d: number) => boolean) | undefined;
  const { deps } = makeFakeDeps(['x', '/quit']);
  deps.runTurn = async () => {
    hit?.(1);
    return { summary: 'ok', filesChanged: [], commandsRun: [] };
  };
  const summary = await runDungeon({ ...deps, bindExternalHit: (fn) => (hit = fn) });
  assert.equal(summary.runStats.typingLines, 1);
});

test('boss gimmicks: chapter 1 boss heals when a tool fails', async () => {
  const { deps, events } = makeFakeDeps(['x', '/quit']);
  deps.runTurn = scriptedTurn([{ type: 'command', value: 'ls', toolId: 't1' }, { type: 'toolResult', toolId: 't1', output: 'no', isError: true }]);
  await runDungeon({ ...deps, startFloor: 5 });
  const start = events.find((e) => e.type === 'floorStart');
  assert.ok(start && start.type === 'floorStart' && start.gimmick?.id === 'clean');
  assert.ok(events.some((e) => e.type === 'gimmickHeal'));
});

test('boss gimmicks: the chapter 2 boss only takes damage from a turn whose tests passed', async () => {
  const blocked = makeFakeDeps(['x'.repeat(150), '/quit']);
  blocked.deps.runTurn = scriptedTurn([{ type: 'file', value: 'a.ts', toolId: 't1' }, { type: 'toolResult', toolId: 't1', output: 'ok', isError: false }]);
  await runDungeon({ ...blocked.deps, startFloor: 11 });
  const start = blocked.events.find((e) => e.type === 'floorStart');
  assert.ok(start && start.type === 'floorStart' && start.gimmick?.id === 'tests');
  assert.ok(blocked.events.some((e) => e.type === 'gimmickBlocked'));
  assert.equal(blocked.events.filter((e) => e.type === 'attack').length, 0);
  const lastHp = blocked.events.filter((e) => e.type === 'hpChanged').at(-1);
  assert.ok(lastHp && lastHp.type === 'hpChanged' && lastHp.hp === lastHp.maxHp, 'the edit hit was undone');

  const passed = makeFakeDeps(['x'.repeat(150), '/quit']);
  passed.deps.runTurn = scriptedTurn([{ type: 'command', value: 'npm test', toolId: 't1' }, { type: 'toolResult', toolId: 't1', output: 'ok', isError: false }]);
  await runDungeon({ ...passed.deps, startFloor: 11 });
  assert.equal(passed.events.filter((e) => e.type === 'gimmickBlocked').length, 0);
  assert.equal(passed.events.filter((e) => e.type === 'attack').length, 1);
});

test('boss gimmicks: chapter 3 needs 3 edits, chapter 4 needs a short prompt', async () => {
  const edits = makeFakeDeps(['x', '/quit']);
  await runDungeon({ ...edits.deps, startFloor: 17 });
  assert.ok(edits.events.some((e) => e.type === 'floorStart' && e.gimmick?.id === 'files3'));
  assert.ok(edits.events.some((e) => e.type === 'gimmickBlocked'));

  const long = makeFakeDeps(['x'.repeat(200), '/quit']);
  await runDungeon({ ...long.deps, startFloor: 23 });
  assert.ok(long.events.some((e) => e.type === 'floorStart' && e.gimmick?.id === 'brief'));
  assert.ok(long.events.some((e) => e.type === 'gimmickBlocked'));
  const short = makeFakeDeps(['x'.repeat(50), '/quit']);
  await runDungeon({ ...short.deps, startFloor: 23 });
  assert.equal(short.events.filter((e) => e.type === 'gimmickBlocked').length, 0);
});

test('bestiary lists every monster with its first-meeting HP, counter damage and boss rule', () => {
  const all = bestiary();
  assert.equal(all[0].name, '버그 고블린');
  assert.equal(all[0].maxHp, 60);
  assert.equal(all[0].counter, 6);
  const boss = all[5];
  assert.equal(boss.isBoss, true);
  assert.equal(boss.maxHp, Math.round(550 * 1.5));
  assert.equal(boss.gimmick?.id, 'clean');
  assert.equal(all[11].gimmick?.id, 'tests');
});

test('traits: the bug goblin (thorns) hurts the hero for each failed tool result', async () => {
  const { deps, events } = makeFakeDeps(['x', '/quit']);
  deps.runTurn = scriptedTurn([{ type: 'command', value: 'ls', toolId: 't1' }, { type: 'toolResult', toolId: 't1', output: 'no', isError: true }]);
  await runDungeon(deps);
  const start = events.find((e) => e.type === 'floorStart');
  assert.ok(start && start.type === 'floorStart' && start.trait?.id === 'thorns');
  assert.ok(events.some((e) => e.type === 'traitThorns' && e.damage === 2));
});

test('traits: the type-error slime (armor) takes half work hits', async () => {
  const { deps, events } = makeFakeDeps(['x'.repeat(150), '/quit']); // 40 damage → 10 per action, halved
  deps.runTurn = scriptedTurn([{ type: 'command', value: 'ls', toolId: 't1' }, { type: 'toolResult', toolId: 't1', output: 'ok', isError: false }]);
  await runDungeon({ ...deps, startFloor: 1 });
  assert.deepEqual(events.filter((e) => e.type === 'partialHit').map((e) => (e.type === 'partialHit' ? e.damage : -1)), [5]);
});

test('traits: the merge-conflict hydra (regen) heals after each turn it survives', async () => {
  const { deps, events } = makeFakeDeps(['x', '/quit']);
  await runDungeon({ ...deps, startFloor: 4 });
  assert.ok(events.some((e) => e.type === 'traitRegen' && e.amount > 0));
});

test('traits: the race-condition phantom (fierce) counters 30% harder', async () => {
  const { deps, events } = makeFakeDeps(['x', '/quit']);
  await runDungeon({ ...deps, startFloor: 3 });
  const start = events.find((e) => e.type === 'floorStart');
  const counter = events.find((e) => e.type === 'monsterAttack');
  assert.ok(start && start.type === 'floorStart' && counter && counter.type === 'monsterAttack');
  assert.equal(counter.damage, Math.round(Math.max(3, Math.round(start.maxHp * 0.1)) * 1.3));
});

test('traits: the null-pointer wraith (frail) takes a 25% harder closing blow', async () => {
  const { deps, events } = makeFakeDeps(['x', '/quit']);
  await runDungeon({ ...deps, startFloor: 2 });
  const attack = events.find((e) => e.type === 'attack');
  assert.ok(attack && attack.type === 'attack' && attack.damage === Math.round(10 * 1.25));
});

test('traits: thorns that bring the hero to 0 HP end the run as a defeat', async () => {
  const { deps } = makeFakeDeps(['x', '/quit']);
  deps.runTurn = scriptedTurn([{ type: 'command', value: 'ls', toolId: 't1' }, { type: 'toolResult', toolId: 't1', output: 'no', isError: true }]);
  const summary = await runDungeon({ ...deps, playerHp: 2 });
  assert.equal(summary.defeated, true);
});

test('themes: demon-king bosses have 30% more HP and every floor pays 1.5x', async () => {
  const plain = makeFakeDeps(['/quit']);
  await runDungeon({ ...plain.deps, startFloor: 5 });
  const demon = makeFakeDeps(['/quit']);
  await runDungeon({ ...demon.deps, startFloor: 5, themeId: 'demon-king' });
  const hp = (evs: BattleEvent[]) => { const e = evs.find((x) => x.type === 'floorStart'); return e && e.type === 'floorStart' ? e.maxHp : -1; };
  assert.equal(hp(plain.events), Math.round(550 * 1.5), 'no theme: the plain boss multiplier');
  assert.equal(hp(demon.events), Math.round(700 * 1.5 * 1.3), '마왕 루트킷 (280 base x 2.5 = 700) with the demon-king boss bonus');
  const xp = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  const s = await runDungeon({ ...xp.deps, themeId: 'demon-king', getDamageMultiplier: () => 10 });
  assert.equal(s.xpGained, Math.round(20 * 1.5));
});

test('themes: debug-quest adds 25% to the closing blow of a turn whose tests passed', async () => {
  const { deps, events } = makeFakeDeps(['x', '/quit']);
  deps.runTurn = scriptedTurn([{ type: 'command', value: 'npm test', toolId: 't1' }, { type: 'toolResult', toolId: 't1', output: 'ok', isError: false }]);
  await runDungeon({ ...deps, themeId: 'debug-quest' });
  const attack = events.find((e) => e.type === 'attack');
  assert.ok(attack && attack.type === 'attack' && attack.damage === Math.round(10 * 1.25));
});

test('themes: each theme spawns its own roster', async () => {
  const { deps, events } = makeFakeDeps(['/quit']);
  await runDungeon({ ...deps, themeId: 'demon-king' });
  const start = events.find((e) => e.type === 'floorStart');
  assert.ok(start && start.type === 'floorStart' && start.monsterIndex === 36);
});

test('difficulty scales rewards: easy x0.7, hard x1.5 coins and XP', async () => {
  const run = async (difficulty: 'easy' | 'normal' | 'hard') => {
    const { deps } = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
    return runDungeon({ ...deps, difficulty, getDamageMultiplier: () => 10 });
  };
  const [easy, normal, hard] = [await run('easy'), await run('normal'), await run('hard')];
  assert.equal(normal.xpGained, 20);
  assert.equal(easy.xpGained, Math.round(20 * 0.7));
  assert.equal(hard.xpGained, Math.round(20 * 1.5));
  assert.equal(hard.coins, Math.round(10 * 1.5));
  assert.equal(easy.coins, Math.round(10 * 0.7));
});

test('treasure chest: the overkill of the killing blow picks the grade (goblin 60 HP, 225 blow = 165 → gold)', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  const summary = await runDungeon({ ...deps, chests: true });
  const chest = events.find((e) => e.type === 'chestOpened');
  assert.ok(chest && chest.type === 'chestOpened' && chest.grade === 'diamond' && chest.overkill === 165, '165 past a 60-HP goblin = 275% → diamond');
  assert.deepEqual(chest.items, [], 'no item on a 0.99 roll (gold drops 50% of the time)');
  assert.ok(summary.coins > 10, 'floor coins plus the chest');
  const lucky = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  await runDungeon({ ...lucky.deps, chests: true, random: seq(0, 0, 0.99) });
  const luckyChest = lucky.events.find((e) => e.type === 'chestOpened');
  assert.ok(luckyChest && luckyChest.type === 'chestOpened' && luckyChest.items.length === 1, 'a low roll drops an item');
});

test('prestige: each rebirth gives +10% damage and +10% coins', async () => {
  const plain = makeFakeDeps(['x', '/quit']);
  await runDungeon(plain.deps);
  const reborn = makeFakeDeps(['x', '/quit']);
  await runDungeon({ ...reborn.deps, prestige: 2 });
  const hit = (events: BattleEvent[]) => events.find((e) => e.type === 'attack');
  const a = hit(plain.events), b = hit(reborn.events);
  assert.ok(a?.type === 'attack' && b?.type === 'attack');
  assert.ok(Math.abs(b.damage - a.damage * 1.2) <= 1);
  const coins = await runDungeon({ ...makeFakeDeps([ONE_SHOT_PROMPT, '/quit']).deps, prestige: 2 });
  const base = await runDungeon(makeFakeDeps([ONE_SHOT_PROMPT, '/quit']).deps);
  assert.equal(coins.coins, Math.round(base.coins * 1.2));
});

test('pets: the slime heals 5% of max HP after every turn', async () => {
  const { deps, events } = makeFakeDeps(['x', '/quit']);
  await runDungeon({ ...deps, pet: 'slime', playerHp: 50 });
  const heal = events.find((e) => e.type === 'petHelped');
  assert.ok(heal?.type === 'petHelped' && heal.pet === 'slime' && heal.amount === 5);
});

test('pets: the drake breathes fire for 3% of the monster max HP after every turn', async () => {
  const { deps, events } = makeFakeDeps(['x', '/quit']);
  await runDungeon({ ...deps, pet: 'drake', startFloor: 10 });
  const start = events.find((e) => e.type === 'floorStart');
  const fire = events.find((e) => e.type === 'petHelped');
  assert.ok(start?.type === 'floorStart' && fire?.type === 'petHelped' && fire.pet === 'drake');
  assert.equal(fire.amount, Math.max(1, Math.round(start.maxHp * 0.03)));
});

test('pets: the owl gives +20% floor XP', async () => {
  const plain = await runDungeon(makeFakeDeps([ONE_SHOT_PROMPT, '/quit']).deps);
  const owl = await runDungeon({ ...makeFakeDeps([ONE_SHOT_PROMPT, '/quit']).deps, pet: 'owl' });
  assert.equal(owl.xpGained, Math.round(plain.xpGained * 1.2));
});

test('pets: a good chest can hold a pet you do not own yet', async () => {
  const found = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  const s1 = await runDungeon({ ...found.deps, chests: true, random: () => 0 });
  assert.deepEqual(s1.newPets, ['slime']);
  assert.ok(found.events.some((e) => e.type === 'petFound' && e.pet === 'slime'));
  const full = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  const s2 = await runDungeon({ ...full.deps, chests: true, random: () => 0, ownedPets: ['slime', 'drake', 'owl'] });
  assert.deepEqual(s2.newPets, []);
});

test('treasure chest: once the monster is down mid-turn, later work hits pile onto the chest', async () => {
  const { deps, events } = makeFakeDeps(['x'.repeat(150), '/quit']); // 40 damage → 10 per action; goblin has 60
  const calls = Array.from({ length: 7 }, (_, i) => [
    { type: 'command', value: `echo ${i}`, toolId: `t${i}` },
    { type: 'toolResult', toolId: `t${i}`, output: 'ok', isError: false },
  ]).flat();
  deps.runTurn = scriptedTurn(calls);
  await runDungeon({ ...deps, chests: true });
  const types = events.map((e) => e.type);
  assert.ok(types.indexOf('monsterDown') > -1 && types.indexOf('monsterDown') < types.indexOf('chestHit'), 'down after the 6th hit, then the chest takes the 7th');
  const hits = events.filter((e) => e.type === 'chestHit');
  assert.equal(hits.length, 1);
  const chest = events.find((e) => e.type === 'chestOpened');
  assert.ok(chest && chest.type === 'chestOpened' && chest.overkill === 50 && chest.grade === 'gold', '10 from the 7th hit + the whole 40 closing blow = 83% of 60 HP');
});

test('treasure chest: grades by overkill', async () => {
  const { chestFor } = await import('../src/battle.ts');
  // By overkill relative to the monster's max HP, so chests keep up with it.
  const grades = [[5, 'wood'], [15, 'iron'], [35, 'silver'], [70, 'gold'], [120, 'platinum'], [200, 'diamond'], [300, 'legend'], [500, 'mythic']] as const;
  for (const [overkill, id] of grades) assert.equal(chestFor(overkill, 100).id, id, `${overkill}% → ${id}`);
  assert.equal(chestFor(50, 1000).id, 'wood', 'the same 50 is nothing against a 1000-HP monster');
});

test('treasure chest: a boss with a conditional rule is not declared down mid-turn', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  deps.runTurn = scriptedTurn([{ type: 'command', value: 'npm test', toolId: 't1' }, { type: 'toolResult', toolId: 't1', output: 'ok', isError: false }]);
  await runDungeon({ ...deps, chests: true, startFloor: 11, getDamageMultiplier: () => 100 });
  assert.equal(events.filter((e) => e.type === 'monsterDown').length, 0);
});

test('contracts: a god contract adds +1 to the closing blow and is kept in the summary', async () => {
  const { deps, events } = makeFakeDeps(['/use contract', 'x', '/quit']);
  const summary = await runDungeon({ ...deps, bag: { contract: 1 }, random: seq(0.7, 0.99) }); // 0.7 → thunder (index 4)
  const signed = events.find((e) => e.type === 'contractSigned');
  assert.ok(signed && signed.type === 'contractSigned' && signed.kind === 'god' && signed.id === 'thunder' && signed.hpCost === 0);
  const attack = events.find((e) => e.type === 'attack');
  assert.ok(attack && attack.type === 'attack' && attack.damage === 11, '10 + 1');
  assert.deepEqual(summary.contract, { kind: 'god', id: 'thunder' });
});

test('breaking pacts costs 10%: of the run max HP now, and of the base max HP for good', async () => {
  const { deps, events } = makeFakeDeps(['/use contract', '/use contract', '/quit']);
  const summary = await runDungeon({ ...deps, playerMaxHp: 250, baseMaxHp: 90, bag: { contract: 2 } });
  assert.ok(events.some((e) => e.type === 'contractBroken' && e.penalty === 25 && e.maxHp === 225));
  assert.equal(summary.maxHpPenalty, 9, '10% of the base 90');
});

test('contracts: a demon costs max HP to sign; a second contract of any kind breaks them all (-10% max HP for good)', async () => {
  const { deps, events } = makeFakeDeps(['/use devilContract', '/use contract', '/quit']);
  const summary = await runDungeon({ ...deps, bag: { devilContract: 1, contract: 1 }, random: seq(0, 0.99) }); // 0 → pride (30%)
  const signed = events.find((e) => e.type === 'contractSigned');
  assert.ok(signed && signed.type === 'contractSigned' && signed.id === 'pride' && signed.hpCost === 30);
  assert.ok(events.some((e) => e.type === 'contractBroken' && e.penalty === 10 && e.maxHp === 90));
  assert.equal(summary.contract, null);
  assert.equal(summary.maxHpPenalty, 10);
  assert.equal(summary.playerMaxHp, 90);
});

test('contracts: an existing contract from the profile breaks on the next scroll too', async () => {
  const { deps } = makeFakeDeps(['/use contract', '/quit']);
  const summary = await runDungeon({ ...deps, bag: { contract: 1 }, contract: { kind: 'demon', id: 'greed' } });
  assert.equal(summary.contract, null);
  assert.equal(summary.maxHpPenalty, 10);
});

test('contracts: sloth removes work hits and doubles the closing blow; greed adds 50% coins', async () => {
  const sloth = makeFakeDeps(['x'.repeat(150), '/quit']);
  sloth.deps.runTurn = scriptedTurn([{ type: 'command', value: 'ls', toolId: 't1' }, { type: 'toolResult', toolId: 't1', output: 'ok', isError: false }]);
  await runDungeon({ ...sloth.deps, contract: { kind: 'demon', id: 'sloth' } });
  assert.equal(sloth.events.filter((e) => e.type === 'partialHit').length, 0);
  const attack = sloth.events.find((e) => e.type === 'attack');
  assert.ok(attack && attack.type === 'attack' && attack.damage === 80);
  const greed = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  const s = await runDungeon({ ...greed.deps, contract: { kind: 'demon', id: 'greed' } });
  assert.equal(s.coins, 15, '10 floor coins x1.5');
});

test('boss drops: each boss has its own relic, dropped 30% of the time, and it works from the bag', async () => {
  const { BOSS_ITEMS } = await import('../src/items.ts');
  assert.equal(BOSS_ITEMS.length, 17);
  assert.equal(new Set(BOSS_ITEMS.map((i) => i.id)).size, 17);
  // Kill the floor-5 boss (area 0) with a lucky loot roll.
  const kill = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  const s1 = await runDungeon({ ...kill.deps, startFloor: 5, getDamageMultiplier: () => 10, shopRandom: () => 0.1 });
  const drop = kill.events.find((e) => e.type === 'bossDrop');
  assert.ok(drop?.type === 'bossDrop' && drop.itemId === 'boss-0');
  assert.equal(s1.bag['boss-0'], 1);
  const unlucky = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  await runDungeon({ ...unlucky.deps, startFloor: 5, getDamageMultiplier: () => 10, shopRandom: () => 0.5 });
  assert.equal(unlucky.events.some((e) => e.type === 'bossDrop'), false);
  // boss-0: next attack x3.
  const plain = makeFakeDeps(['x', '/quit']);
  await runDungeon(plain.deps);
  const powered = makeFakeDeps(['/use boss-0', 'x', '/quit']);
  await runDungeon({ ...powered.deps, bag: { 'boss-0': 1 } });
  const hit = (ev: BattleEvent[]) => ev.find((e) => e.type === 'attack');
  const a = hit(plain.events), b = hit(powered.events);
  assert.ok(a?.type === 'attack' && b?.type === 'attack');
  assert.ok(Math.abs(b.damage - a.damage * 3) <= 2);
  // boss-1: blocks the next two counters.
  const shield = makeFakeDeps(['/use boss-1', 'x', 'x', 'x', '/quit']);
  await runDungeon({ ...shield.deps, bag: { 'boss-1': 1 } });
  assert.equal(shield.events.filter((e) => e.type === 'counterBlocked').length, 2);
  assert.equal(shield.events.filter((e) => e.type === 'monsterAttack').length, 1);
});

test('the life crystal raises max HP by 10% of the current max HP', async () => {
  // The crystal is on the second visit's shelf.
  const { deps } = makeFakeDeps([ONE_SHOT_PROMPT, '/leave', ONE_SHOT_PROMPT, '/buy crystal', '/leave', '/quit']);
  const summary = await runDungeon({ ...deps, coins: 1000, playerMaxHp: 250, random: seq(0.1, 0.1, 0.99) });
  assert.equal(summary.playerMaxHp, 275);
});

test('bandages and potions heal a share of max HP (15% / 40%)', async () => {
  const { deps, events } = makeFakeDeps(['/use bandage', '/use potion', '/quit']);
  await runDungeon({ ...deps, playerMaxHp: 300, playerHp: 10, bag: { bandage: 1, potion: 1 } });
  const hp = events.filter((e) => e.type === 'playerHpChanged').map((e) => (e.type === 'playerHpChanged' ? e.hp : 0));
  assert.deepEqual(hp.slice(-2), [10 + 45, 10 + 45 + 120]);
});

test('merchant: each item has its own purchase limit per visit', async () => {
  const { MERCHANT_LIMIT } = await import('../src/items.ts');
  assert.equal(MERCHANT_LIMIT.bandage, 5);
  assert.equal(MERCHANT_LIMIT.elixir, 1);
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, ...Array(7).fill('/buy bandage'), '/leave', '/quit']);
  const summary = await runDungeon({ ...deps, coins: 1000, random: seq(0.1, 0.99) });
  assert.equal(summary.bag.bandage, 5);
  const fails = events.filter((e) => e.type === 'purchaseFailed');
  assert.equal(fails.length, 2);
  assert.ok(fails.every((e) => e.type === 'purchaseFailed' && e.reason.includes('5개')));
  const open = events.find((e) => e.type === 'merchantOpen');
  assert.ok(open?.type === 'merchantOpen' && open.items.find((i) => i.id === 'bandage')?.limit === 5);
});

test('night market: a rare stop; each good sells once at its discount', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, 'BUY_FIRST', 'BUY_FIRST', '/leave', '/quit']);
  let offerFirst = '';
  const inputs = deps.readInput;
  deps.readInput = async () => {
    const v = await inputs();
    return v === 'BUY_FIRST' ? `/buy ${offerFirst}` : v;
  };
  deps.onBattleEvent = ((orig) => (e: BattleEvent) => {
    if (e.type === 'nightMarketOpen') offerFirst = e.items[0].id;
    orig(e);
  })(deps.onBattleEvent);
  const summary = await runDungeon({ ...deps, coins: 5000, random: seq(0.7, 0.99) });
  const open = events.find((e) => e.type === 'nightMarketOpen');
  assert.ok(open?.type === 'nightMarketOpen' && open.items.length === 4);
  const bought = events.filter((e) => e.type === 'purchased');
  assert.equal(bought.length, 1, 'only one of each');
  assert.ok(events.some((e) => e.type === 'purchaseFailed' && e.reason.includes('팔렸')));
  assert.equal(summary.coins, 5000 + events.filter((e) => e.type === 'coinsChanged').reduce((n, e) => n + (e.type === 'coinsChanged' ? e.gained ?? 0 : 0), 0) - open.items[0].price);
  assert.ok(events.some((e) => e.type === 'nightMarketClosed'));
});

test('encounter table after a clear: merchant, blacksmith, night market, spring, shrine (with a pact), else nothing', async () => {
  const { encounterTable } = await import('../src/battle.ts');
  const { themeRules } = await import('../src/themes.ts');
  const odds = (themeId: string | undefined, pact: boolean) => Object.fromEntries(encounterTable(themeRules(themeId), pact).map((e) => [e.kind, Math.round(e.chance * 100)]));
  assert.deepEqual(odds('demon-king', true), { merchant: 35, blacksmith: 30, nightMarket: 10, spring: 5, shrine: 10, nothing: 10 });
  assert.deepEqual(odds('demon-king', false), { merchant: 35, blacksmith: 30, nightMarket: 10, spring: 5, nothing: 20 });
  assert.deepEqual(odds('adventure', true), { merchant: 40, blacksmith: 30, nightMarket: 10, shrine: 10, nothing: 10 });
  assert.deepEqual(odds('adventure', false), { merchant: 40, blacksmith: 30, nightMarket: 10, nothing: 20 });
});

test('rest stop: the spring heals half of max HP once', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/drink', '/drink', '/leave', '/quit']);
  const summary = await runDungeon({ ...deps, playerHp: 20, random: seq(0.77, 0.99) });
  assert.ok(events.some((e) => e.type === 'springOpen'));
  const drinks = events.filter((e) => e.type === 'springDrank');
  assert.equal(drinks.length, 1, 'only once');
  assert.ok(events.some((e) => e.type === 'springFailed'));
  assert.ok(events.some((e) => e.type === 'springClosed'));
  assert.ok(summary.playerMaxHp === 100);
});

test('rest stop: the shrine lets you renounce your pact with no max-HP penalty; it only appears with a pact', async () => {
  const pact = makeFakeDeps([ONE_SHOT_PROMPT, '/renounce', '/leave', '/quit']);
  const s1 = await runDungeon({ ...pact.deps, contract: { kind: 'demon', id: 'greed' }, random: seq(0.85, 0.99) });
  assert.ok(pact.events.some((e) => e.type === 'shrineOpen'));
  assert.ok(pact.events.some((e) => e.type === 'contractRenounced'));
  assert.equal(s1.contract, null);
  assert.equal(s1.maxHpPenalty, 0);
  const none = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  await runDungeon({ ...none.deps, random: seq(0.85, 0.99) });
  assert.equal(none.events.some((e) => e.type === 'shrineOpen'), false);
});

test('shop prices climb with depth: +10% per floor; selling pays half the current price', async () => {
  const early = makeFakeDeps([ONE_SHOT_PROMPT, '/leave', '/quit']);
  await runDungeon({ ...early.deps, random: seq(0.1, 0.99) });
  const deep = makeFakeDeps(['/use bomb', '/use bomb', '/use bomb', '/use bomb', '/use bomb', '/use bomb', '/use bomb', '/use bomb', '/use bomb', '/use bomb', '/leave', '/quit']);
  await runDungeon({ ...deep.deps, startFloor: 9, bag: { bomb: 10 }, random: seq(0.1, 0.99) });
  const shelf = (events: BattleEvent[]) => events.find((e) => e.type === 'merchantOpen');
  const a = shelf(early.events), b = shelf(deep.events);
  assert.ok(a?.type === 'merchantOpen' && b?.type === 'merchantOpen');
  const bandage = a.items.find((i) => i.id === 'bandage');
  assert.equal(a.priceMult, 1.1, 'next floor 1');
  assert.equal(bandage?.price, Math.round(12 * 1.1));
  assert.equal(b.priceMult, 2, 'next floor 10');
  assert.ok(b.items.every((i) => i.price >= 2 * 10));
});

test('shop: 4 items per visit; the coin charm is a one-time relic that boosts coins', async () => {
  // The charm is on the third visit's shelf (10 items rotate 4 at a time, contracts aside).
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/leave', ONE_SHOT_PROMPT, '/leave', ONE_SHOT_PROMPT, '/buy coinCharm', '/buy coinCharm', '/leave', ONE_SHOT_PROMPT, '/quit']);
  const summary = await runDungeon({ ...deps, coins: 500, random: seq(0.1, 0.1, 0.1, 0.99), getDamageMultiplier: () => 10 });
  const shelves = events.filter((e) => e.type === 'merchantOpen');
  assert.ok(shelves.every((e) => e.type === 'merchantOpen' && e.items.length === 4));
  assert.ok(events.some((e) => e.type === 'relicGained' && e.itemId === 'coinCharm'));
  assert.ok(events.some((e) => e.type === 'purchaseFailed' && e.itemId === 'coinCharm'), 'only once');
  assert.deepEqual(summary.relics, ['coinCharm']);
  const gains = events.filter((e) => e.type === 'coinsChanged').map((e) => (e.type === 'coinsChanged' ? e.gained : 0));
  assert.equal(gains.at(-1), Math.round((10 + 2 * 3) * 1.25), 'the floor after buying (floor 4) pays 25% more');
});

test('save/load XP dupe: floors and scrolls already paid for this run line give no XP again', async () => {
  // First time through: floor 0 cleared and a scroll read, all paid.
  const first = makeFakeDeps([ONE_SHOT_PROMPT, '/use scroll', '/quit']);
  const s1 = await runDungeon({ ...first.deps, runId: 'r1', bag: { scroll: 1 } });
  assert.ok(s1.xpGained > 30);
  assert.equal(s1.runId, 'r1');
  assert.deepEqual(s1.paidXp, { floor: 0, scroll: 1 });
  // Reload the save from floor 0 (scroll back in the bag) with that claim: nothing new to earn.
  const again = makeFakeDeps([ONE_SHOT_PROMPT, '/use scroll', '/quit']);
  const s2 = await runDungeon({ ...again.deps, runId: 'r1', paidXp: s1.paidXp, bag: { scroll: 1 } });
  assert.equal(s2.xpGained, 0);
  assert.ok(again.events.some((e) => e.type === 'floorCleared' && e.xpGained === 0));
  assert.deepEqual(s2.paidXp, { floor: 0, scroll: 1 }, 'the claim never moves backwards');
});

test('the bomb scales with the monster: 20% of its max HP, never below 30', async () => {
  const { deps, events } = makeFakeDeps(['/use bomb', '/quit']);
  await runDungeon({ ...deps, startFloor: 10, bag: { bomb: 1 } });
  const start = events.find((e) => e.type === 'floorStart');
  const bomb = events.find((e) => e.type === 'bombHit');
  assert.ok(start?.type === 'floorStart' && bomb?.type === 'bombHit');
  assert.equal(bomb.damage, Math.max(30, Math.round(start.maxHp * 0.2)));
  assert.ok(bomb.damage > 30, 'deep floors get a bigger boom');
});

test('the bomb only does 5% of a boss max HP (still at least 30)', async () => {
  const { deps, events } = makeFakeDeps(['/use bomb', '/quit']);
  await runDungeon({ ...deps, startFloor: 11, bag: { bomb: 1 } });
  const start = events.find((e) => e.type === 'floorStart');
  const bomb = events.find((e) => e.type === 'bombHit');
  assert.ok(start?.type === 'floorStart' && start.isBoss && bomb?.type === 'bombHit');
  assert.equal(bomb.damage, Math.max(30, Math.round(start.maxHp * 0.05)));
});

test('items: the bomb hits the monster for 30, the scroll gives 30 XP, the elixir fully heals', async () => {
  const { deps, events } = makeFakeDeps(['x', '/use bomb', '/use scroll', '/use elixir', '/quit']);
  const summary = await runDungeon({ ...deps, bag: { bomb: 1, scroll: 1, elixir: 1 } });
  assert.ok(events.some((e) => e.type === 'bombHit' && e.damage === 30));
  assert.ok(events.some((e) => e.type === 'bonusXp' && e.amount === 30));
  assert.equal(summary.xpGained, 30);
  const hp = events.filter((e) => e.type === 'playerHpChanged').at(-1);
  assert.ok(hp && hp.type === 'playerHpChanged' && hp.hp === hp.maxHp);
});

test('using a bag item at the merchant keeps the shop open', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/use potion', '/buy bandage', '/leave', '/quit']);
  const summary = await runDungeon({ ...deps, coins: 50, bag: { potion: 1 }, random: seq(0.1, 0.99) });
  assert.ok(events.some((e) => e.type === 'itemUsed' && e.itemId === 'potion'));
  assert.ok(events.some((e) => e.type === 'purchased' && e.itemId === 'bandage'), 'still shopping after the potion');
  assert.equal(events.filter((e) => e.type === 'merchantClosed').length, 1);
  assert.equal(summary.bag.bandage, 1);
});

test('a bare /new at the merchant resets the session without leaving the shop', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/new', '/buy bandage', '/leave', '/quit']);
  await runDungeon({ ...deps, coins: 50, random: seq(0.1, 0.99) });
  assert.ok(events.some((e) => e.type === 'sessionReset' && e.reason === 'new'));
  assert.ok(events.some((e) => e.type === 'purchased' && e.itemId === 'bandage'), 'still shopping');
});

test('the merchant buys bag items back at half price', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/sell potion', '/sell potion', '/sell crystal', '/leave', '/quit']);
  const summary = await runDungeon({ ...deps, coins: 0, bag: { potion: 1 }, random: seq(0.1, 0.99) });
  assert.ok(events.some((e) => e.type === 'sold' && e.itemId === 'potion' && e.gained === 16), 'potion 33 today → 16');
  assert.equal(events.filter((e) => e.type === 'sellFailed').length, 2, 'none left / not in the bag');
  assert.equal(summary.bag.potion, undefined);
  assert.equal(summary.coins, 10 + 16);
});

test('one counterattack takes at most 90% of the hero max HP: a full-HP hero survives any single hit', async () => {
  const { deps, events } = makeFakeDeps(['x', '/quit']);
  await runDungeon({ ...deps, startFloor: 11, playerMaxHp: 100 });
  const start = events.find((e) => e.type === 'floorStart');
  const hit = events.find((e) => e.type === 'monsterAttack');
  assert.ok(start?.type === 'floorStart' && start.isBoss && hit?.type === 'monsterAttack');
  assert.ok(Math.round(start.maxHp * 0.1 * 1.1) > 90, 'uncapped it would one-shot');
  assert.equal(hit.damage, 90);
});

test('boss phase 2: at half HP or less a boss enrages once and its counters hit 30% harder', async () => {
  const calm = makeFakeDeps(['x', '/quit']);
  await runDungeon({ ...calm.deps, startFloor: 5, monsterHp: 500, playerMaxHp: 1000 });
  const angry = makeFakeDeps(['x', 'x', '/quit']);
  await runDungeon({ ...angry.deps, startFloor: 5, monsterHp: 200, playerMaxHp: 1000 });
  const c0 = calm.events.find((e) => e.type === 'monsterAttack');
  const hits = angry.events.filter((e) => e.type === 'monsterAttack');
  assert.ok(c0?.type === 'monsterAttack' && hits[0]?.type === 'monsterAttack');
  assert.equal(calm.events.some((e) => e.type === 'bossEnraged'), false);
  assert.equal(angry.events.filter((e) => e.type === 'bossEnraged').length, 1, 'only once');
  assert.ok(Math.abs(hits[0].damage - c0.damage * 1.3) <= 1);
});

// Floor 5 boss of a chosen area (rosters), wounded below half, sturdy hero.
async function awakenedBoss(roster: number, inputs = ['x', 'x', '/quit']) {
  const run = makeFakeDeps(inputs);
  const summary = await runDungeon({ ...run.deps, startFloor: 5, rosters: [roster], monsterHp: 200, playerMaxHp: 1000 });
  return { events: run.events, summary };
}

test('boss awakenings differ by boss: rage, regen, armor, frenzy, vampire', async () => {
  const kinds = [];
  for (let r = 0; r < 5; r++) {
    const { events } = await awakenedBoss(r);
    const e = events.find((x) => x.type === 'bossEnraged');
    assert.ok(e?.type === 'bossEnraged');
    kinds.push(e.awakening);
  }
  assert.deepEqual(kinds, ['rage', 'regen', 'armor', 'frenzy', 'vampire']);
});

test('awakening: regen heals 4% of max HP each turn after it wakes', async () => {
  const { events } = await awakenedBoss(1);
  const start = events.find((e) => e.type === 'floorStart');
  const heal = events.find((e) => e.type === 'traitRegen');
  assert.ok(start?.type === 'floorStart' && heal?.type === 'traitRegen');
  assert.equal(heal.amount, Math.round(start.maxHp * 0.04));
});

test('awakening: armor takes 25% less from the closing blow', async () => {
  const plain = await awakenedBoss(0); // rage: no armor
  const armored = await awakenedBoss(2);
  const second = (events: BattleEvent[]) => events.filter((e) => e.type === 'attack')[1];
  const a = second(plain.events), b = second(armored.events);
  assert.ok(a?.type === 'attack' && b?.type === 'attack');
  assert.ok(Math.abs(b.damage - a.damage * 0.75) <= 1);
});

test('awakening: frenzy counters twice at 60% each', async () => {
  const calm = makeFakeDeps(['x', '/quit']);
  await runDungeon({ ...calm.deps, startFloor: 5, rosters: [3], monsterHp: 800, playerMaxHp: 1000 });
  const one = calm.events.find((e) => e.type === 'monsterAttack');
  const { events } = await awakenedBoss(3, ['x', '/quit']);
  const hits = events.filter((e) => e.type === 'monsterAttack');
  assert.ok(one?.type === 'monsterAttack');
  assert.equal(hits.length, 2, 'awake: two hits a turn');
  for (const h of hits) assert.ok(h.type === 'monsterAttack' && Math.abs(h.damage - one.damage * 0.6) <= 1);
});

test('awakening: vampire heals by what its counter dealt', async () => {
  const { events } = await awakenedBoss(4);
  const i = events.findIndex((e) => e.type === 'bossEnraged');
  const after = events.slice(i);
  const hit = after.find((e) => e.type === 'monsterAttack');
  const drain = after.find((e) => e.type === 'bossDrain');
  assert.ok(hit?.type === 'monsterAttack' && drain?.type === 'bossDrain');
  assert.equal(drain.amount, hit.damage);
});

test('a regular monster never enrages', async () => {
  const { deps, events } = makeFakeDeps(['x', '/quit']);
  await runDungeon({ ...deps, startFloor: 4, monsterHp: 10 });
  assert.equal(events.some((e) => e.type === 'bossEnraged'), false);
});

test('counters grow +10% per chapter', async () => {
  const ch2 = makeFakeDeps(['x', '/quit']);
  await runDungeon({ ...ch2.deps, startFloor: 6 });
  const start = ch2.events.find((e) => e.type === 'floorStart');
  const counter = ch2.events.find((e) => e.type === 'monsterAttack');
  assert.ok(start && start.type === 'floorStart' && counter && counter.type === 'monsterAttack');
  const base = Math.max(3, Math.round(start.maxHp * 0.1));
  assert.equal(counter.damage, Math.round(base * 1.1), 'chapter 2: +10%');
});
