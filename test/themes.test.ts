import test from 'node:test';
import assert from 'node:assert/strict';
import { THEME_RULES } from '../src/themes.ts';
import { THEMES } from '../electron/renderer/story.js';

test('every theme has rules and a written chapter for each roster in its cycle', () => {
  assert.deepEqual(THEMES.map((t) => t.id), THEME_RULES.map((t) => t.id));
  for (const rules of THEME_RULES) {
    const story = THEMES.find((t) => t.id === rules.id);
    assert.equal(story.chapters.length, rules.rosters.length, rules.id);
    assert.ok(rules.perks.length > 0 && rules.stars >= 1 && rules.stars <= 3, rules.id);
  }
});
