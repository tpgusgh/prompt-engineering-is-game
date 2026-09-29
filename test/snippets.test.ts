import test from 'node:test';
import assert from 'node:assert/strict';
import { SNIPPETS } from '../electron/renderer/typing-snippets.js';

test('a large, varied pool of typing drills', () => {
  assert.ok(SNIPPETS.length >= 80, `${SNIPPETS.length} snippets`);
  assert.ok(new Set(SNIPPETS.map((s) => s.lang)).size >= 15, 'many languages/tools');
  assert.equal(new Set(SNIPPETS.map((s) => s.code)).size, SNIPPETS.length, 'no duplicate code');
});

test('every drill is one typeable ASCII line with a title and short + long explanations', () => {
  for (const s of SNIPPETS) {
    assert.match(s.code, /^[\x20-\x7e]+$/, `ASCII single line: ${s.code}`);
    assert.ok(s.code.length <= 80, `fits the box: ${s.code}`);
    assert.ok(s.title && s.short && s.long && s.lang, s.code);
  }
});

test('C and C++ each have a solid set of drills', () => {
  assert.ok(SNIPPETS.filter((s) => s.lang === 'C').length >= 12, 'C');
  assert.ok(SNIPPETS.filter((s) => s.lang === 'C++').length >= 12, 'C++');
});
