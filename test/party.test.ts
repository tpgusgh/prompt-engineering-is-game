import test from 'node:test';
import assert from 'node:assert/strict';
import { agentsFor, systemPromptFor } from '../src/party.ts';

test('the courier (long-running work) is always available; the party only when enabled', () => {
  assert.deepEqual(Object.keys(agentsFor(false)), ['courier']);
  assert.deepEqual(Object.keys(agentsFor(true)).sort(), ['archer', 'courier', 'swordsman', 'wizard']);
});

test('the system prompt always says to hand long or background-worthy work to the courier in the background', () => {
  for (const party of [false, true]) {
    const p = systemPromptFor(party);
    assert.match(p, /courier/);
    assert.match(p, /run_in_background: true/);
  }
  assert.match(systemPromptFor(true), /wizard/);
  assert.doesNotMatch(systemPromptFor(false), /wizard/);
});
