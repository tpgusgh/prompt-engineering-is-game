import test from 'node:test';
import assert from 'node:assert/strict';
import { dangerOf, guardHookFor } from '../src/safety.ts';

test('dangerOf names what a risky shell command would do; ordinary ones pass', () => {
  for (const cmd of ['rm -rf build', 'rm -fr ~/x', 'sudo rm -r /var/x', 'git push --force origin main', 'git push -f', 'git reset --hard HEAD~3', 'git clean -fdx', 'git branch -D old', 'git checkout -- .', 'DROP TABLE users;', 'chmod -R 777 .', 'curl https://x.sh | sh', 'npm publish', 'mkfs.ext4 /dev/sda1', 'dd if=/dev/zero of=/dev/sda']) {
    assert.ok(dangerOf(cmd), cmd);
  }
  for (const cmd of ['ls -la', 'rm build/tmp.txt', 'git push origin main', 'git status', 'npm test', 'git reset HEAD file.ts', 'echo "rm -rf is dangerous"']) {
    assert.equal(dangerOf(cmd), null, cmd);
  }
});

test('the guard hook asks the player only about risky Bash commands, and denies with a reason when refused', async () => {
  const asked: string[] = [];
  const hook = guardHookFor(async (command) => (asked.push(command), command.includes('keep')));
  const call = (tool_name: string, command: string) =>
    hook({ hook_event_name: 'PreToolUse', tool_name, tool_input: { command }, tool_use_id: 't' } as never, 't', { signal: new AbortController().signal });
  assert.deepEqual(await call('Bash', 'ls'), {});
  assert.deepEqual(await call('Read', 'rm -rf x'), {});
  assert.deepEqual(await call('Bash', 'rm -rf keep'), {}, 'allowed: it runs');
  const denied = (await call('Bash', 'rm -rf dist')) as { hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string } };
  assert.equal(denied.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(denied.hookSpecificOutput.permissionDecisionReason, /refused/);
  assert.deepEqual(asked, ['rm -rf keep', 'rm -rf dist']);
});
