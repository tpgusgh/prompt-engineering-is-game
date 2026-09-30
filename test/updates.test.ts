import test from 'node:test';
import assert from 'node:assert/strict';
import { isNewerVersion, updateMode, RELEASES_URL } from '../src/updates.ts';

test('isNewerVersion compares numerically, tolerating a leading v', () => {
  assert.equal(isNewerVersion('v0.16.0', '0.15.1'), true);
  assert.equal(isNewerVersion('0.10.0', '0.9.9'), true);
  assert.equal(isNewerVersion('v0.15.1', '0.15.1'), false);
  assert.equal(isNewerVersion('0.15.0', '0.15.1'), false);
  assert.equal(isNewerVersion('garbage', '0.15.1'), false);
});

test('updateMode: installers self-update, everything else only notifies', () => {
  assert.equal(updateMode('win32', {}), 'install');
  assert.equal(updateMode('linux', { APPIMAGE: '/home/me/Prompt.AppImage' }), 'install');
  assert.equal(updateMode('linux', {}), 'notify');
  assert.equal(updateMode('darwin', {}), 'notify');
});

test('release links stay on this repo', () => {
  assert.ok(RELEASES_URL.startsWith('https://github.com/tpgusgh/prompt-engineering-is-game/releases'));
});
