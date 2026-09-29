import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractNotes } from '../scripts/release.mjs';

test('extractNotes returns just the requested version section', () => {
  const log = '# Log\n\n## v0.3.0 — x\n- new\n\n## v0.2.0 — y\n- old\n';
  assert.equal(extractNotes(log, '0.3.0'), '- new');
  assert.equal(extractNotes(log, '0.2.0'), '- old');
  assert.equal(extractNotes(log, '9.9.9'), null);
});

test('the current package.json version has CHANGELOG notes (a release can be cut)', () => {
  const { version } = JSON.parse(readFileSync('package.json', 'utf-8'));
  assert.ok(extractNotes(readFileSync('CHANGELOG.md', 'utf-8'), version), `CHANGELOG.md needs a "## v${version}" section`);
});
