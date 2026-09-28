import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDamage } from '../src/damage.ts';

test('short prompt deals minimum damage', () => {
  const result = calculateDamage('ok');
  assert.equal(result.damage, 10);
  assert.equal(result.crit, false);
  assert.deepEqual(result.matchedKeywords, []);
});

test('damage scales with length up to the cap', () => {
  const medium = calculateDamage('x'.repeat(100));
  assert.equal(medium.damage, 10 + Math.floor(100 / 5));

  const huge = calculateDamage('x'.repeat(10000));
  assert.equal(huge.damage, 150, 'damage must clamp at 150 for non-crit prompts');
});

test('two or more matched keywords trigger a 1.5x crit', () => {
  const prompt = 'please refactor this step by step and add a test for the edge case';
  const result = calculateDamage(prompt);
  assert.equal(result.crit, true);
  assert.ok(result.matchedKeywords.includes('refactor'));
  assert.ok(result.matchedKeywords.includes('test'));
  const base = Math.min(150, Math.max(10, 10 + Math.floor(prompt.length / 5)));
  assert.equal(result.damage, Math.round(base * 1.5));
});

test('a single matched keyword does not crit', () => {
  const result = calculateDamage('please refactor this quickly');
  assert.equal(result.matchedKeywords.length, 1);
  assert.equal(result.crit, false);
});

test('an extremely long prompt with keywords still clamps before the crit multiplier, never exceeding 225', () => {
  const prompt = 'test refactor ' + 'x'.repeat(50000);
  const result = calculateDamage(prompt);
  assert.equal(result.crit, true);
  assert.equal(result.damage, 225);
});
