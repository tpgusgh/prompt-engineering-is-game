#!/usr/bin/env node
// Publishes the current package.json version as a GitHub release:
// tests → .dmg build → push the vX.Y.Z tag → `gh release create` with the
// .dmg attached and the matching CHANGELOG.md section as the notes.
// Run `npm version <patch|minor|major>` first (bumps and tags).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

// The "## vX.Y.Z" section of a changelog, without its heading.
export function extractNotes(changelog, version) {
  const lines = changelog.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`## v${version}`));
  if (start === -1) return null;
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  return lines.slice(start + 1, end === -1 ? undefined : end).join('\n').trim();
}

function run(cmd, args, env) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { stdio: 'inherit', env: env ?? process.env });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { version } = JSON.parse(readFileSync('package.json', 'utf-8'));
  const tag = `v${version}`;
  const notes = extractNotes(readFileSync('CHANGELOG.md', 'utf-8'), version);
  if (!notes) throw new Error(`CHANGELOG.md has no "## ${tag}" section`);
  const tags = execFileSync('git', ['tag', '--list', tag], { encoding: 'utf-8' }).trim();
  if (tags !== tag) throw new Error(`tag ${tag} not found — run \`npm version ...\` (or git tag ${tag}) first`);

  run('npm', ['test']);
  // Build outside any ELECTRON_RUN_AS_NODE environment (e.g. an editor terminal).
  const buildEnv = { ...process.env };
  delete buildEnv.ELECTRON_RUN_AS_NODE;
  run('npx', ['electron-builder'], buildEnv);
  const dmg = path.join('release', `Prompt Battle-${version}-arm64.dmg`);
  if (!existsSync(dmg)) throw new Error(`${dmg} was not built`);

  run('git', ['push', 'origin', 'HEAD', tag]);
  const notesFile = path.join(os.tmpdir(), `promptbattle-${tag}-notes.md`);
  writeFileSync(notesFile, notes);
  run('gh', ['release', 'create', tag, dmg, '--title', `Prompt Battle ${tag}`, '--notes-file', notesFile]);
}
