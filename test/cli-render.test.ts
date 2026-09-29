import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBattleEvent } from '../src/cli-render.ts';
import type { BattleEvent } from '../src/battle.ts';

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

test('floorStart prints the floor header, art, and a full HP bar', () => {
  const event: BattleEvent = { type: 'floorStart', floor: 0, monsterName: 'Bug Goblin', monsterArt: '(o_o)', maxHp: 60 };
  const out = stripAnsi(formatBattleEvent(event));
  assert.equal(out, '\nFloor 1: Bug Goblin appears!\n(o_o)\n[████████████████████] 60/60\n');
});

test('hesitate prints the hesitate line', () => {
  const out = stripAnsi(formatBattleEvent({ type: 'hesitate' }));
  assert.equal(out, 'You hesitate. No attack this turn.\n');
});

test('turnStart prints a working indicator', () => {
  const out = stripAnsi(formatBattleEvent({ type: 'turnStart', prompt: 'fix it' }));
  assert.equal(out, 'Focusing your attack...\n');
});

test('partialHit prints the incremental damage', () => {
  const out = stripAnsi(
    formatBattleEvent({ type: 'partialHit', damage: 16, agentEvent: { type: 'command', value: 'npm test' } }),
  );
  assert.equal(out, '  hit for 16!\n');
});

test('agentEvent formats a command differently from a file', () => {
  assert.equal(
    stripAnsi(formatBattleEvent({ type: 'agentEvent', agentEvent: { type: 'command', value: 'npm test' } })),
    '  → running: npm test\n',
  );
  assert.equal(
    stripAnsi(formatBattleEvent({ type: 'agentEvent', agentEvent: { type: 'file', value: 'src/foo.ts' } })),
    '  → editing: src/foo.ts\n',
  );
});

test('agentError prints the fizzle line with the real error text', () => {
  const out = stripAnsi(formatBattleEvent({ type: 'agentError', error: 'invalid API key' }));
  assert.equal(out, 'Your attack misses! The spell fizzles: invalid API key\n');
});

test('attack prints damage, crit label, and matched keywords', () => {
  const plain = stripAnsi(formatBattleEvent({ type: 'attack', damage: 42, crit: false, matchedKeywords: [] }));
  assert.equal(plain, 'You attack for 42 damage!\n');
  const crit = stripAnsi(formatBattleEvent({ type: 'attack', damage: 225, crit: true, matchedKeywords: ['test', 'refactor'] }));
  assert.equal(crit, 'You attack for 225 damage! CRITICAL HIT!\n(keywords: test, refactor)\n');
});

test('an attack whose closing chunk is 0 reads as the monster dodging, not "0 damage"', () => {
  const out = stripAnsi(formatBattleEvent({ type: 'attack', damage: 0, crit: false, matchedKeywords: [] }));
  assert.equal(out, 'The monster dodged your final blow!\n');
});

test('every event type formats to a string (never undefined, which would crash stdout.write)', () => {
  const events: BattleEvent[] = [
    { type: 'runStart', playerHp: 100, playerMaxHp: 100 },
    { type: 'monsterAttack', damage: 6 },
    { type: 'playerHpChanged', hp: 94, maxHp: 100 },
    { type: 'playerDefeated' },
    { type: 'chapterCleared', chapter: 1 },
    { type: 'sessionReset' },
    { type: 'sessionNearlyFull', usedTokens: 170000, contextWindow: 200000 },
    { type: 'sessionSaved', sessionId: 's1' },
    { type: 'fleeAttempt', success: true },
    { type: 'fleeBlocked' },
    { type: 'coinsChanged', coins: 20, gained: 10 },
    { type: 'merchantOpen', coins: 20, items: [] },
    { type: 'purchased', itemId: 'potion', coins: 0 },
    { type: 'purchaseFailed', itemId: 'crystal', reason: 'poor' },
    { type: 'merchantClosed' },
    { type: 'betResult', choice: 'odd', roll: 3, won: true, amount: 5, coins: 15 },
    { type: 'betFailed', reason: 'x' },
    { type: 'bagChanged', bag: { potion: 1 } },
    { type: 'itemUsed', itemId: 'potion' },
    { type: 'itemUseFailed', itemId: 'potion' },
    { type: 'counterBlocked' },
    { type: 'typingHit', damage: 1 },
    { type: 'turnInterrupted' },
    { type: 'contextUsage', usedTokens: 1, contextWindow: 2 },
    { type: 'statPointsChanged', points: 1, stats: { attack: 0, defense: 0, vitality: 0 } },
    { type: 'statRaised', stat: 'attack', stats: { attack: 1, defense: 0, vitality: 0 }, points: 0 },
    { type: 'statRaiseFailed', reason: 'x' },
    { type: 'blacksmithOpen', swordLevel: 0, coins: 10, odds: { cost: 20, successChance: 0.95, breakChance: 0 }, maxLevel: 10 },
    { type: 'enhanceResult', outcome: 'broken', swordLevel: 0, coins: 0, odds: { cost: 20, successChance: 0.95, breakChance: 0 } },
    { type: 'enhanceFailed', reason: 'x' },
    { type: 'blacksmithClosed' },
    { type: 'saveFailed', reason: 'x' },
    { type: 'agentEvent', agentEvent: { type: 'text', value: 'hi' } },
    { type: 'agentEvent', agentEvent: { type: 'agentStart', id: 'a', agentType: 'wizard', description: 'scout' } },
    { type: 'agentEvent', agentEvent: { type: 'agentEnd', id: 'a' } },
    { type: 'sessionSwitched', sessionId: 's' },
  ];
  for (const event of events) assert.equal(typeof formatBattleEvent(event), 'string', event.type);
});

test('monsterAttack and playerHpChanged report the counterattack and player HP', () => {
  assert.equal(stripAnsi(formatBattleEvent({ type: 'monsterAttack', damage: 6 })), 'The monster strikes back for 6!\n');
  assert.equal(stripAnsi(formatBattleEvent({ type: 'playerHpChanged', hp: 94, maxHp: 100 })), 'Your HP: 94/100\n');
});

test('agentSummary prints the summary text', () => {
  assert.equal(formatBattleEvent({ type: 'agentSummary', summary: 'Fixed the bug.' }), 'Fixed the bug.\n');
});

test('hpChanged prints the HP bar', () => {
  const out = stripAnsi(formatBattleEvent({ type: 'hpChanged', hp: 30, maxHp: 60 }));
  assert.equal(out, '[██████████----------] 30/60\n');
});

test('floorCleared prints the victory line with XP', () => {
  const out = stripAnsi(formatBattleEvent({ type: 'floorCleared', monsterName: 'Bug Goblin', xpGained: 20 }));
  assert.equal(out, '\nBug Goblin defeated! +20 XP\n');
});

test('runEnded prints nothing (cli.ts prints its own final summary from the returned BattleSummary)', () => {
  assert.equal(formatBattleEvent({ type: 'runEnded', floorsCleared: 3, floorsEngaged: 3, xpGained: 75 }), '');
});

test('merchantOpen lists every item with its /buy id and price', () => {
  const out = stripAnsi(
    formatBattleEvent({ type: 'merchantOpen', coins: 40, items: [{ id: 'potion', name: '회복 물약', price: 30, description: 'HP 40 회복' }] }),
  );
  assert.match(out, /\/buy potion/);
  assert.match(out, /30/);
  assert.match(out, /40 coins/);
});

test('fleeAttempt reports success and failure differently', () => {
  assert.notEqual(
    stripAnsi(formatBattleEvent({ type: 'fleeAttempt', success: true })),
    stripAnsi(formatBattleEvent({ type: 'fleeAttempt', success: false })),
  );
});
