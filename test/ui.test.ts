import test from 'node:test';
import assert from 'node:assert/strict';
import { colorize, renderHpBar } from '../src/ui.ts';

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

test('colorize wraps text in ansi codes and resets', () => {
  const result = colorize('hi', 'red');
  assert.ok(result.includes('hi'));
  assert.ok(result.startsWith('\x1b['));
  assert.ok(result.endsWith('\x1b[0m'));
  assert.equal(stripAnsi(result), 'hi');
});

test('renderHpBar shows a full bar at max health', () => {
  const bar = stripAnsi(renderHpBar(100, 100, 10));
  assert.equal(bar, '[██████████] 100/100');
});

test('renderHpBar shows an empty bar at zero health', () => {
  const bar = stripAnsi(renderHpBar(0, 100, 10));
  assert.equal(bar, '[----------] 0/100');
});

test('renderHpBar clamps current above max and below zero', () => {
  const over = stripAnsi(renderHpBar(500, 100, 10));
  assert.equal(over, '[██████████] 100/100');
  const under = stripAnsi(renderHpBar(-50, 100, 10));
  assert.equal(under, '[----------] 0/100');
});

test('renderHpBar never divides by zero when max is 0', () => {
  const bar = stripAnsi(renderHpBar(0, 0, 10));
  assert.equal(bar, '[----------] 0/1');
});
