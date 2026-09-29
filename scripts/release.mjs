#!/usr/bin/env node
// Publishes the current package.json version as a GitHub release:
// tests → Mac .dmg / Linux .AppImage builds → push the vX.Y.Z tag →
// `gh release create` with both attached and the matching CHANGELOG.md
// section as the notes. The Windows installer is built and attached by
// .github/workflows/windows-release.yml once the release is published.
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
  // npm only installs this machine's native claude binary; fetch the other
  // targets' packages (not saved) so each build can bundle its own.
  const sdkVersion = JSON.parse(readFileSync('node_modules/@anthropic-ai/claude-agent-sdk/package.json', 'utf-8')).version;
  run('npm', ['install', '--no-save', '--force', ...['linux-x64'].map((t) => `@anthropic-ai/claude-agent-sdk-${t}@${sdkVersion}`)]);
  run('npx', ['electron-builder', '--mac', '--arm64'], buildEnv);
  run('npx', ['electron-builder', '--linux', '--x64'], buildEnv);
  const artifacts = [`mac-arm64.dmg`, `linux-x86_64.AppImage`].map((a) => path.join('release', `Prompt Battle-${version}-${a}`));
  for (const a of artifacts) if (!existsSync(a)) throw new Error(`${a} was not built`);

  run('git', ['push', 'origin', 'HEAD', tag]);
  const notesFile = path.join(os.tmpdir(), `promptbattle-${tag}-notes.md`);
  writeFileSync(notesFile, notes);
  run('gh', ['release', 'create', tag, ...artifacts, '--title', `Prompt Battle ${tag}`, '--notes-file', notesFile]);
}
