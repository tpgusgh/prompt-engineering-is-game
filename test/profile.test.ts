import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadProfile, saveProfile, levelForXp, addXp, applyRun, type Profile } from '../src/profile.ts';
import type { BattleSummary } from '../src/battle.ts';
import { emptyRecords, emptyRunStats } from '../src/progress.ts';

const EXTRA = { storyFloors: {}, coins: 0, bag: {}, maxHp: 100, swordLevel: 0, heroClass: 'swordsman' as const, claude: { effort: 'high' as const, skillsMode: 'all' as const, enabledSkills: [], disabledMcp: [], auth: 'cli' as const }, records: emptyRecords(), achievements: [], relics: [], maxHpPenalty: 0 };

test('loadProfile returns defaults when no file exists', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  const profile = await loadProfile(dir);
  assert.deepEqual(profile, { level: 1, xp: 0, totalWins: 0, totalBattles: 0, ...EXTRA });
});

test('saveProfile then loadProfile round-trips', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  await saveProfile({ level: 3, xp: 250, totalWins: 5, totalBattles: 6, storyFloors: { adventure: 8 }, coins: 42, bag: { potion: 2 }, maxHp: 100, swordLevel: 3, heroClass: 'wizard', claude: { effort: 'low', skillsMode: 'custom', enabledSkills: ['pdf'], disabledMcp: ['fusion360'], auth: 'api' }, records: { ...emptyRecords(), turns: 7, seen: [3] }, achievements: ['first-win'], daily: { date: '2026-09-30', questId: 'tests-3', progress: 1, done: false }, contract: { kind: 'god', id: 'fire' }, relics: ['coinCharm'], maxHpPenalty: 0 }, dir);
  const profile = await loadProfile(dir);
  assert.deepEqual(profile, { level: 3, xp: 250, totalWins: 5, totalBattles: 6, storyFloors: { adventure: 8 }, coins: 42, bag: { potion: 2 }, maxHp: 100, swordLevel: 3, heroClass: 'wizard', claude: { effort: 'low', skillsMode: 'custom', enabledSkills: ['pdf'], disabledMcp: ['fusion360'], auth: 'api' }, records: { ...emptyRecords(), turns: 7, seen: [3] }, achievements: ['first-win'], daily: { date: '2026-09-30', questId: 'tests-3', progress: 1, done: false }, contract: { kind: 'god', id: 'fire' }, relics: ['coinCharm'], maxHpPenalty: 0 });
});

test('loadProfile falls back to defaults on corrupted JSON', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  await mkdir(path.join(dir, '.promptbattle'), { recursive: true });
  await writeFile(path.join(dir, '.promptbattle', 'profile.json'), '{ not valid json', 'utf-8');
  const profile = await loadProfile(dir);
  assert.deepEqual(profile, { level: 1, xp: 0, totalWins: 0, totalBattles: 0, ...EXTRA });
});

test('loadProfile coerces a field with the wrong type back to its default instead of trusting it', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  await mkdir(path.join(dir, '.promptbattle'), { recursive: true });
  await writeFile(
    path.join(dir, '.promptbattle', 'profile.json'),
    JSON.stringify({ level: 5, xp: '50', totalWins: null, totalBattles: 12 }),
    'utf-8',
  );
  const profile = await loadProfile(dir);
  assert.deepEqual(profile, { level: 5, xp: 0, totalWins: 0, totalBattles: 12, ...EXTRA, records: { ...emptyRecords(), maxLevel: 5, seen: [0] } }, 'good fields kept, bad-typed fields fall back individually');
});

test('loadProfile rejects negative, fractional, and non-finite counts, not just wrong types', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  await mkdir(path.join(dir, '.promptbattle'), { recursive: true });
  await writeFile(
    path.join(dir, '.promptbattle', 'profile.json'),
    JSON.stringify({ level: 0, xp: -5, totalWins: 2.5, totalBattles: Infinity }),
    'utf-8',
  );
  const profile = await loadProfile(dir);
  assert.deepEqual(profile, { level: 1, xp: 0, totalWins: 0, totalBattles: 0, ...EXTRA, records: { ...emptyRecords(), seen: [0] } });
});

test('storyFloors keeps only valid entries; legacy storyChapters migrate to chapter-start floors', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  await mkdir(path.join(dir, '.promptbattle'), { recursive: true });
  await writeFile(
    path.join(dir, '.promptbattle', 'profile.json'),
    JSON.stringify({ level: 2, xp: 120, totalWins: 3, totalBattles: 4, storyChapters: { 'demon-king': 2, bad: -1, worse: 'x' }, storyFloors: { adventure: 3, nope: 1.5 } }),
    'utf-8',
  );
  const profile = await loadProfile(dir);
  assert.deepEqual(profile.storyFloors, { 'demon-king': 12, adventure: 3 });
});

test('levelForXp follows a flat 100-xp-per-level curve', () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(99), 1);
  assert.equal(levelForXp(100), 2);
  assert.equal(levelForXp(349), 4);
});

test('addXp updates both xp and level', () => {
  const updated = addXp({ level: 1, xp: 80, totalWins: 0, totalBattles: 0, ...EXTRA }, 30);
  assert.equal(updated.xp, 110);
  assert.equal(updated.level, 2);
});

test('bad coins/bag/maxHp fall back', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  await mkdir(path.join(dir, '.promptbattle'), { recursive: true });
  await writeFile(
    path.join(dir, '.promptbattle', 'profile.json'),
    JSON.stringify({ coins: -3, bag: { potion: 2, smoke: -1, amulet: 'x' }, maxHp: 50 }),
    'utf-8',
  );
  const profile = await loadProfile(dir);
  assert.equal(profile.coins, 0);
  assert.deepEqual(profile.bag, { potion: 2 });
  assert.equal(profile.maxHp, 100);
});

function summary(overrides: Partial<BattleSummary>): BattleSummary {
  return {
    floorsCleared: 2, floorsEngaged: 3, xpGained: 45, defeated: false, nextFloor: 9, chaptersCleared: 1,
    coins: 70, bag: { potion: 1 }, playerMaxHp: 110, stats: { attack: 1, defense: 0, vitality: 1 }, statPoints: 2, swordLevel: 4, ...overrides,
  };
}
const base: Profile = { level: 1, xp: 80, totalWins: 1, totalBattles: 1, ...EXTRA };

test('applyRun records xp, stats, coins, bag, max HP and the exact floor to resume from', () => {
  const p = applyRun(base, summary({}), 'adventure');
  assert.equal(p.xp, 125);
  assert.equal(p.level, 2);
  assert.equal(p.totalWins, 3);
  assert.equal(p.totalBattles, 4);
  assert.equal(p.coins, 70);
  assert.deepEqual(p.bag, { potion: 1 });
  assert.deepEqual(p.storyFloors, { adventure: 9 });
  assert.equal(p.swordLevel, 4);
  assert.equal('stats' in p, false, 'stats are per-run, never saved to the profile');
  assert.equal(p.maxHp, 100, 'max HP bonuses from the run are not kept');
});

test('applyRun keeps what XP each run line was paid, so a reloaded save cannot be paid twice', () => {
  const p = applyRun(base, summary({ runId: 'r1', paidXp: { floor: 4, scroll: 4 } }), 'adventure');
  assert.deepEqual(p.xpClaims, { r1: { floor: 4, scroll: 4 } });
  const q = applyRun(p, summary({ runId: 'r1', paidXp: { floor: 2, scroll: -1 } }), 'adventure');
  assert.deepEqual(q.xpClaims?.r1, { floor: 4, scroll: 4 }, 'never backwards');
  let many = base;
  for (let i = 0; i < 60; i++) many = applyRun(many, summary({ runId: `r${i}`, paidXp: { floor: i, scroll: -1 } }), 'adventure');
  assert.equal(Object.keys(many.xpClaims ?? {}).length, 50, 'only the latest run lines are kept');
  assert.ok(many.xpClaims?.r59 && !many.xpClaims?.r0);
});

test('applyRun: defeat rewinds to the chapter start; progress never goes backwards', () => {
  assert.deepEqual(applyRun(base, summary({ defeated: true, nextFloor: 9 }), 'adventure').storyFloors, { adventure: 6 });
  const ahead = { ...base, storyFloors: { adventure: 14 } };
  assert.deepEqual(applyRun(ahead, summary({ nextFloor: 3 }), 'adventure').storyFloors, { adventure: 14 });
  assert.deepEqual(applyRun(base, summary({}), undefined).storyFloors, {}, 'CLI runs have no theme');
});

test('XP_PER_LEVEL is the level step the XP bar fills toward', async () => {
  const { XP_PER_LEVEL } = await import('../src/profile.ts');
  assert.equal(XP_PER_LEVEL, 100);
  assert.equal(levelForXp(XP_PER_LEVEL * 3 - 1), 3);
  assert.equal(levelForXp(XP_PER_LEVEL * 3), 4);
});

test('a new run starts with as many stat points as the hero level', async () => {
  const { startingStatPoints } = await import('../src/profile.ts');
  assert.equal(startingStatPoints({ ...base, level: 1 }), 1);
  assert.equal(startingStatPoints({ ...base, level: 5, xp: 450 }), 5);
});

test('titles by level: the highest unlocked one applies', async () => {
  const { titleForLevel, TITLES } = await import('../src/profile.ts');
  assert.equal(titleForLevel(1), TITLES[0].title);
  assert.equal(titleForLevel(4), TITLES.filter((t) => t.level <= 4).pop()!.title);
  assert.equal(titleForLevel(999), TITLES[TITLES.length - 1].title);
  assert.deepEqual(TITLES.map((t) => t.level), [...TITLES.map((t) => t.level)].sort((a, b) => a - b), 'ascending');
});

test('an unreadable profile is kept as a .broken copy before falling back to defaults', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  await mkdir(path.join(dir, '.promptbattle'), { recursive: true });
  await writeFile(path.join(dir, '.promptbattle', 'profile.json'), '');
  const profile = await loadProfile(dir);
  assert.equal(profile.level, 1);
  const { readdir } = await import('node:fs/promises');
  assert.ok((await readdir(path.join(dir, '.promptbattle'))).some((f) => f.startsWith('profile.json.broken-')));
});

test('finishRun folds run stats into records and pays achievement coins', async () => {
  const { finishRun } = await import('../src/profile.ts');
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  const profile = await loadProfile(dir);
  const summary = { floorsCleared: 1, floorsEngaged: 1, xpGained: 20, defeated: false, nextFloor: 1, chaptersCleared: 0, coins: 10, bag: {}, playerMaxHp: 100, stats: { attack: 0, defense: 0, vitality: 0 }, statPoints: 0, swordLevel: 0, runStats: { ...emptyRunStats(), floorsCleared: 1, turns: 1 } } as BattleSummary;
  const { profile: updated, progress } = finishRun(profile, summary, 'adventure', '2026-09-30');
  assert.equal(updated.records.turns, 1);
  assert.ok(updated.achievements.includes('first-win'));
  assert.equal(updated.coins, 10 + progress.rewardCoins);
});

test('applyRun: life crystals only last for the run they were bought in', () => {
  const p = applyRun(base, summary({ playerMaxHp: 120, stats: { attack: 0, defense: 0, vitality: 0 } }), 'adventure');
  assert.equal(p.maxHp, 100);
});

test('older profiles fill the bestiary from the story floors already reached', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  await mkdir(path.join(dir, '.promptbattle'), { recursive: true });
  await writeFile(path.join(dir, '.promptbattle', 'profile.json'), JSON.stringify({ level: 2, storyFloors: { adventure: 5 }, records: { turns: 3 } }));
  const profile = await loadProfile(dir);
  assert.deepEqual(profile.records.seen, [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(profile.records.kills, { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 });
  assert.equal(profile.records.turns, 3);
});

test('applyRun keeps the contract, relics and broken-contract max HP penalty', () => {
  const p = applyRun(base, summary({ contract: { kind: 'demon', id: 'greed' }, relics: ['coinCharm'], maxHpPenalty: 10 }), 'adventure');
  assert.deepEqual(p.contract, { kind: 'demon', id: 'greed' });
  assert.deepEqual(p.relics, ['coinCharm']);
  assert.equal(p.maxHpPenalty, 10);
  assert.equal(p.maxHp, 90);
  const broken = applyRun(p, summary({ contract: null, relics: ['coinCharm'], maxHpPenalty: 10 }), 'adventure');
  assert.equal(broken.contract, undefined);
  assert.equal(broken.maxHp, 80);
});
