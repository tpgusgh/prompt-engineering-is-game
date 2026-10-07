import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDamage } from '../src/damage.ts';

test('short prompt deals minimum damage, no criteria', () => {
  const result = calculateDamage('ok');
  assert.equal(result.damage, 10);
  assert.equal(result.crit, false);
  assert.deepEqual(result.matchedKeywords, []);
});

test('length counts less than before: 10 + 1 per 8 characters, capped at 40', () => {
  assert.equal(calculateDamage('x'.repeat(160)).damage, 30);
  assert.equal(calculateDamage('x'.repeat(10000)).damage, 40);
});

test('each criterion met adds +50%; the met ones are reported by name', () => {
  const p = 'x'.repeat(149) + ' src/app.ts'; // 160 chars: base 30, one criterion
  const r = calculateDamage(p);
  assert.deepEqual(r.matchedKeywords, ['대상']);
  assert.equal(r.damage, Math.round(30 * 1.5));
  assert.equal(r.crit, false);
  const two = calculateDamage('src/app.ts 고쳐줘, 테스트로 확인해');
  assert.deepEqual(two.matchedKeywords, ['대상', '검증']);
  assert.equal(two.crit, false);
});

test('three or more criteria crit (x1.5)', () => {
  const prompt = 'src/login.ts의 login()이 빈 값이면 터진다. 다른 파일은 건드리지 말고, 왜 그런지 설명한 뒤 단계별로 고치고 테스트로 확인해줘. 예: 빈 문자열이면 에러 메시지';
  const r = calculateDamage(prompt);
  assert.deepEqual(r.matchedKeywords, ['대상', '제약', '검증', '단계', '이유', '예시', '엣지 케이스']);
  assert.equal(r.crit, true);
  const base = Math.min(40, 10 + Math.floor(prompt.length / 8));
  assert.equal(r.damage, Math.round(base * (1 + 7 * 0.5) * 1.5));
});

test('a good prompt now beats a long vague one', () => {
  const vague = calculateDamage('이거 좀 잘 고쳐줘 '.repeat(30));
  const good = calculateDamage('src/cart.ts의 total()이 할인 후 음수가 된다. 경계값(0원) 처리하고 테스트로 확인해줘');
  assert.ok(good.damage > vague.damage, `${good.damage} > ${vague.damage}`);
});

test('a numbered list counts as steps; English forms work too', () => {
  assert.deepEqual(calculateDamage('1. read it\n2. fix it').matchedKeywords, ['단계']);
  assert.deepEqual(calculateDamage('fix it step by step and verify with tests, because it breaks').matchedKeywords, ['검증', '단계', '이유']);
});

test('under 50 characters the criteria count half and never crit (no keyword stuffing)', () => {
  const stuffed = calculateDamage('src/a.ts 테스트 왜 예시'); // 18 chars, 4 criteria
  assert.equal(stuffed.matchedKeywords.length, 4);
  assert.equal(stuffed.crit, false);
  assert.equal(stuffed.damage, Math.round(12 * (1 + 4 * 0.25)));
  assert.equal(stuffed.short, true);
});

test('Japanese prompts meet the criteria too', () => {
  const r = calculateDamage('src/app.tsのlogin()が空の値で落ちる。他のファイルは触らずに、なぜそうなるか説明してから段階的に直して、テストで確認して。例えば空文字ならエラーメッセージ');
  assert.deepEqual(r.matchedKeywords, ['대상', '제약', '검증', '단계', '이유', '예시', '엣지 케이스']);
  assert.deepEqual(calculateDamage('まず原因を調べて、次に修正してください。必ず既存の動作は維持すること').matchedKeywords, ['제약', '단계']);
  assert.deepEqual(calculateDamage('境界値と例外処理、nullのケースも見て').matchedKeywords, ['엣지 케이스']);
});
