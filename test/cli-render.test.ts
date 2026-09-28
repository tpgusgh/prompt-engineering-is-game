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
