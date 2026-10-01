import test from 'node:test';
import assert from 'node:assert/strict';
import { makeTranslator } from '../electron/renderer/i18n/translate.js';

const t = makeTranslator({
  '던전 입장': 'Enter the dungeon',
  '{0}의 피해를 받았다!': 'You took {0} damage!',
  '{0}이(가) 나타났다!': '{0} appears!',
  '버그 고블린': 'Bug Goblin',
  '{0}에게 {1}의 피해': '{1} damage to {0}',
  '코인': 'coins',
  '남은 {0}개': '{0} left',
  '{0} {1}': 'should never match',
});

test('i18n: exact text, keeping the surrounding whitespace', () => {
  assert.equal(t('던전 입장'), 'Enter the dungeon');
  assert.equal(t('  던전 입장\n'), '  Enter the dungeon\n');
});

test('i18n: templates fill their placeholders, translating Korean pieces too, in the target order', () => {
  assert.equal(t('12의 피해를 받았다!'), 'You took 12 damage!');
  assert.equal(t('버그 고블린이(가) 나타났다!'), 'Bug Goblin appears!');
  assert.equal(t('버그 고블린에게 30의 피해'), '30 damage to Bug Goblin');
  assert.equal(t('남은 3개'), '3 left');
});

test('i18n: text without Korean, or unknown text, is left alone; placeholder-only templates never match', () => {
  assert.equal(t('PROMPT BATTLE 30'), 'PROMPT BATTLE 30');
  assert.equal(t('처음 보는 문장'), '처음 보는 문장');
  assert.equal(t('a 처음'), 'a 처음');
});

test('i18n: glued text swaps the phrases it knows', () => {
  assert.equal(t('🪙 28 코인'), '🪙 28 coins');
});

test('i18n: text whose emoji were already swapped for icons still matches its key', () => {
  const tr = makeTranslator({ '🔄 업데이트': '🔄 Update', '💣 {0}을(를) 던졌다!': '💣 Threw {0}!', '폭탄': 'Bomb', '💾 {0}: {1}': '💾 {0}: {1}' });
  assert.equal(tr('업데이트'), 'Update');
  assert.equal(tr(' 업데이트'), ' Update');
  assert.equal(tr('폭탄을(를) 던졌다!'), 'Threw Bomb!');
});

test('i18n: placeholders right next to each other are filled as one piece', () => {
  const tr = makeTranslator({ '🎖 {0}{1} · 레벨 {2}': '🎖 {0}{1} · Level {2}', '견습 용사': 'Apprentice hero', '용사': 'hero' });
  assert.equal(tr('🎖 ★견습 용사 · 레벨 3'), '🎖 ★Apprentice hero · Level 3');
});

test('i18n: a line glued from pieces with " · " is translated piece by piece', () => {
  const tr = makeTranslator({ '모험을 떠나기': 'Off on an Adventure', '챕터 {0} · {1}층': 'Chapter {0} · floor {1}', '{0}층': 'floor {0}', '챕터 {0}': 'Chapter {0}', '· {0} 초기화': '· {0} reset' });
  assert.equal(tr('모험을 떠나기 · 챕터 1 · 1층'), 'Off on an Adventure · Chapter 1 · floor 1');
  assert.equal(tr('세션 3% · 14:00 초기화'), '세션 3% · 14:00 reset');
});
