import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDifficulty } from '../src/args.ts';

test('defaults to normal with no flag', () => {
  assert.equal(parseDifficulty([]), 'normal');
});

test('reads a valid --difficulty value', () => {
  assert.equal(parseDifficulty(['--difficulty', 'hard']), 'hard');
  assert.equal(parseDifficulty(['--difficulty', 'easy']), 'easy');
});

test('falls back to normal for an unknown value', () => {
  assert.equal(parseDifficulty(['--difficulty', 'nightmare']), 'normal');
});

test('falls back to normal when --difficulty has no value', () => {
  assert.equal(parseDifficulty(['--difficulty']), 'normal');
});
