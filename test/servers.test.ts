import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLsofListen, parseLsofCwd, parseWindowsListen, insideFolder, serversIn } from '../src/servers.ts';

test('lsof: listening sockets grouped by process, ports deduped and sorted', () => {
  const out = ['p501', 'cnode', 'n*:5173', 'n[::1]:5173', 'n127.0.0.1:24678', 'p777', 'cpython3.12', 'n*:8000', ''].join('\n');
  assert.deepEqual(parseLsofListen(out), [
    { pid: 501, name: 'node', ports: [5173, 24678] },
    { pid: 777, name: 'python3.12', ports: [8000] },
  ]);
  assert.deepEqual(parseLsofCwd(['p501', 'fcwd', 'n/Users/me/app', 'p777', 'fcwd', 'n/tmp'].join('\n')), new Map([[501, '/Users/me/app'], [777, '/tmp']]));
});

test('a server belongs to the project when it runs inside the folder (not a sibling with the same prefix)', () => {
  assert.ok(insideFolder('/Users/me/app', '/Users/me/app'));
  assert.ok(insideFolder('/Users/me/app/web', '/Users/me/app/'));
  assert.ok(!insideFolder('/Users/me/app2', '/Users/me/app'));
  assert.ok(insideFolder('C:\\Code\\App\\web', 'c:/code/app'), 'Windows: case and slashes do not matter');
  const listening = [{ pid: 1, name: 'node', ports: [3000] }, { pid: 2, name: 'postgres', ports: [5432] }];
  assert.deepEqual(serversIn(listening, new Map([[1, '/p/app'], [2, '/']]), '/p/app').map((s) => s.pid), [1]);
});

test('Windows: listening ports matched to processes whose command line points into the folder', () => {
  const json = JSON.stringify({
    conns: [{ LocalPort: 5173, OwningProcess: 40 }, { LocalPort: 5173, OwningProcess: 40 }, { LocalPort: 135, OwningProcess: 8 }],
    procs: [{ ProcessId: 40, Name: 'node.exe', CommandLine: '"node" C:\\Code\\App\\node_modules\\vite\\bin\\vite.js' }, { ProcessId: 8, Name: 'svchost.exe', CommandLine: 'svchost -k rpc' }],
  });
  assert.deepEqual(parseWindowsListen(json, 'c:/code/app'), [{ pid: 40, name: 'node.exe', ports: [5173], command: '"node" C:\\Code\\App\\node_modules\\vite\\bin\\vite.js' }]);
  assert.deepEqual(parseWindowsListen('not json', 'c:/x'), []);
});
