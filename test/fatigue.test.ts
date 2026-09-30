import test from 'node:test';
import assert from 'node:assert/strict';
import { fatigueOf } from '../electron/renderer/fatigue.js';

test('fatigue follows the busier usage window: danger at 90%+, tired at 75%+', () => {
  assert.deepEqual(fatigueOf({ session: { usedPercent: 92.4 }, weekly: { usedPercent: 40 } }), { level: 'danger', percent: 92, window: '5시간' });
  assert.deepEqual(fatigueOf({ session: { usedPercent: 10 }, weekly: { usedPercent: 80 } }), { level: 'tired', percent: 80, window: '주간' });
  assert.equal(fatigueOf({ session: { usedPercent: 30 }, weekly: null }).level, 'ok');
  assert.equal(fatigueOf(null), null);
  assert.equal(fatigueOf('loading'), null);
});
