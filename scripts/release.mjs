#!/usr/bin/env node
// Publishes the current package.json version: runs the tests, checks the
// CHANGELOG section and tag, and pushes the vX.Y.Z tag. The Release workflow
// (.github/workflows/release.yml) then builds Mac, Linux and Windows on
// GitHub and attaches them to the release with the CHANGELOG notes.
// Run `npm version <patch|minor|major>` first (bumps and tags).
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

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
  if (!extractNotes(readFileSync('CHANGELOG.md', 'utf-8'), version)) throw new Error(`CHANGELOG.md has no "## ${tag}" section`);
  const tags = execFileSync('git', ['tag', '--list', tag], { encoding: 'utf-8' }).trim();
  if (tags !== tag) throw new Error(`tag ${tag} not found — run \`npm version ...\` (or git tag ${tag}) first`);

  run('npm', ['test']);
  run('git', ['push', 'origin', 'HEAD', tag]);
  console.log(`Pushed ${tag}: GitHub Actions builds and publishes it — watch with \`gh run watch\`.`);
}
