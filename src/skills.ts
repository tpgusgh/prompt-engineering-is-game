// 스킬북: Claude Code skills as files — `.claude/skills/<name>/SKILL.md` in
// the project (editable here) and `~/.claude/skills/<name>/SKILL.md` for the
// user (listed, load-only). Loading one puts `/<name>` in front of the prompt;
// Claude Code reads skill files fresh for every turn's session.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export interface Skill {
  name: string;
  description: string;
  body: string;
  scope: 'project' | 'user';
}

export const SKILL_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_BODY = 20_000;

export function parseSkill(text: string): { name?: string; description: string; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { description: '', body: text.trim() };
  const field = (key: string) => {
    const line = m[1].split(/\r?\n/).find((l) => l.startsWith(`${key}:`));
    return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '') : undefined;
  };
  return { name: field('name'), description: field('description') ?? '', body: m[2].trim() };
}

export function formatSkill(name: string, description: string, body: string): string {
  const oneLine = description.replace(/\s+/g, ' ').trim();
  return `---\nname: ${name}\ndescription: ${JSON.stringify(oneLine)}\n---\n\n${body.trim()}\n`;
}

async function scan(dir: string, scope: Skill['scope']): Promise<Skill[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const out: Skill[] = [];
  for (const e of entries) {
    if (!e.isDirectory() || !SKILL_NAME.test(e.name)) continue;
    const text = await fs.readFile(path.join(dir, e.name, 'SKILL.md'), 'utf-8').catch(() => null);
    if (text === null) continue;
    const parsed = parseSkill(text);
    out.push({ name: e.name, description: parsed.description, body: parsed.body, scope });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

const projectDir = (cwd: string) => path.join(cwd, '.claude', 'skills');

export async function listSkills(cwd: string, home: string = os.homedir()): Promise<Skill[]> {
  const project = await scan(projectDir(cwd), 'project');
  const user = (await scan(path.join(home, '.claude', 'skills'), 'user')).filter((u) => !project.some((p) => p.name === u.name));
  return [...project, ...user];
}

export async function saveSkill(cwd: string, skill: { name: string; description: string; body: string }): Promise<{ ok: true } | { error: string }> {
  const name = skill.name.trim();
  if (!SKILL_NAME.test(name)) return { error: '이름은 영어 소문자·숫자·하이픈(-)만, 64자까지 (예: fix-tests)' };
  if (!skill.description.trim()) return { error: '설명을 적어 줘 — Claude가 언제 쓸지 고르는 기준이다' };
  if (!skill.body.trim()) return { error: '스킬 내용(프롬프트)을 적어 줘' };
  if (skill.body.length > MAX_BODY) return { error: `내용은 ${MAX_BODY}자까지` };
  const dir = path.join(projectDir(cwd), name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'SKILL.md'), formatSkill(name, skill.description, skill.body), 'utf-8');
  return { ok: true };
}

// Project skills only; removes just SKILL.md and the folder if it's then empty.
export async function deleteSkill(cwd: string, name: string): Promise<{ ok: true } | { error: string }> {
  if (!SKILL_NAME.test(name)) return { error: '그런 스킬은 없다' };
  const dir = path.join(projectDir(cwd), name);
  try {
    await fs.rm(path.join(dir, 'SKILL.md'));
  } catch {
    return { error: '그런 스킬은 없다' };
  }
  await fs.rmdir(dir).catch(() => {}); // keeps the folder if it holds other files
  return { ok: true };
}
