import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { listSkills, saveSkill, deleteSkill, parseSkill } from '../src/skills.ts';

async function tmp() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pb-skills-'));
  const cwd = path.join(root, 'project');
  const home = path.join(root, 'home');
  await fs.mkdir(cwd, { recursive: true });
  return { cwd, home };
}

test('skillbook: save a project skill as SKILL.md, list it, edit it, delete it', async () => {
  const { cwd, home } = await tmp();
  assert.deepEqual(await saveSkill(cwd, { name: 'fix-tests', description: '실패한 테스트를\n고친다', body: '테스트를 돌리고 실패한 것만 고쳐줘.' }), { ok: true });
  const file = await fs.readFile(path.join(cwd, '.claude', 'skills', 'fix-tests', 'SKILL.md'), 'utf-8');
  assert.match(file, /^---\nname: fix-tests\ndescription: "실패한 테스트를 고친다"\n---\n\n테스트를 돌리고/);
  let skills = await listSkills(cwd, home);
  assert.deepEqual(skills, [{ name: 'fix-tests', description: '실패한 테스트를 고친다', body: '테스트를 돌리고 실패한 것만 고쳐줘.', scope: 'project' }]);
  await saveSkill(cwd, { name: 'fix-tests', description: 'v2', body: 'new body' });
  skills = await listSkills(cwd, home);
  assert.equal(skills[0].body, 'new body');
  assert.deepEqual(await deleteSkill(cwd, 'fix-tests'), { ok: true });
  assert.deepEqual(await listSkills(cwd, home), []);
});

test('skillbook: user skills are listed too; a project skill with the same name wins', async () => {
  const { cwd, home } = await tmp();
  await fs.mkdir(path.join(home, '.claude', 'skills', 'review'), { recursive: true });
  await fs.writeFile(path.join(home, '.claude', 'skills', 'review', 'SKILL.md'), '---\nname: review\ndescription: user review\n---\nbody');
  await fs.mkdir(path.join(home, '.claude', 'skills', 'deploy'), { recursive: true });
  await fs.writeFile(path.join(home, '.claude', 'skills', 'deploy', 'SKILL.md'), 'no frontmatter');
  await saveSkill(cwd, { name: 'review', description: 'project review', body: 'b' });
  const skills = await listSkills(cwd, home);
  assert.deepEqual(skills.map((s) => [s.name, s.scope, s.description]), [['review', 'project', 'project review'], ['deploy', 'user', '']]);
});

test('skillbook: bad names, empty fields and path tricks are refused', async () => {
  const { cwd } = await tmp();
  for (const name of ['../evil', 'Has Space', 'UPPER', '', 'a/b']) {
    assert.ok('error' in (await saveSkill(cwd, { name, description: 'd', body: 'b' })), name);
  }
  assert.ok('error' in (await saveSkill(cwd, { name: 'ok', description: ' ', body: 'b' })));
  assert.ok('error' in (await saveSkill(cwd, { name: 'ok', description: 'd', body: '' })));
  assert.ok('error' in (await deleteSkill(cwd, '../x')));
  assert.ok('error' in (await deleteSkill(cwd, 'missing')));
  assert.deepEqual(parseSkill('---\nname: x\ndescription: "quoted"\n---\nhi'), { name: 'x', description: 'quoted', body: 'hi' });
});
