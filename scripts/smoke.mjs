#!/usr/bin/env node
// Launch check for a packaged build (`electron-builder --dir`): the bundled
// claude binary runs, and the app opens its window with the start screen and
// no page errors. Used by .github/workflows/smoke.yml on Mac, Linux and
// Windows; run locally with `node scripts/smoke.mjs` after a --dir build.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const PORT = 9335;
const plat = process.platform;
const arch = process.arch;
const appDir = {
  darwin: `release/mac${arch === 'arm64' ? '-arm64' : ''}/Prompt Battle.app`,
  linux: 'release/linux-unpacked',
  win32: 'release/win-unpacked',
}[plat];
const exe = {
  darwin: path.join(appDir, 'Contents/MacOS/Prompt Battle'),
  linux: path.join(appDir, 'prompt-engineering-is-game'),
  win32: path.join(appDir, 'Prompt Battle.exe'),
}[plat];
const resources = plat === 'darwin' ? path.join(appDir, 'Contents/Resources') : path.join(appDir, 'resources');
const claude = path.join(
  resources,
  'app.asar.unpacked/node_modules/@anthropic-ai',
  `claude-agent-sdk-${plat}-${arch}`,
  plat === 'win32' ? 'claude.exe' : 'claude',
);

const fail = (msg) => {
  console.error(`SMOKE FAIL: ${msg}`);
  process.exit(1);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!existsSync(exe)) fail(`${exe} not found — run \`npx electron-builder --dir\` first`);
if (!existsSync(claude)) fail(`bundled claude binary missing at ${claude}`);
console.log('claude --version:', execFileSync(claude, ['--version'], { encoding: 'utf-8' }).trim());

// CI Linux runners can't use Chromium's SUID sandbox helper from an unpacked dir.
const args = [`--remote-debugging-port=${PORT}`, ...(plat === 'linux' ? ['--no-sandbox'] : [])];
// The release build refuses remote debugging unless asked for explicitly.
const child = spawn(exe, args, { stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, PROMPTBATTLE_DEBUG: '1' } });
let exited = null;
child.on('exit', (code) => (exited = code));
const done = (code) => {
  child.kill();
  process.exit(code);
};

let page;
for (let i = 0; i < 60 && !page; i++) {
  if (exited !== null) fail(`app exited early with code ${exited}`);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    page = list.find((p) => p.type === 'page');
  } catch {}
  if (!page) await sleep(500);
}
if (!page) {
  child.kill();
  fail('no app window within 30s');
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
const errors = [];
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) pending.get(m.id)(m);
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const n = ++id;
    pending.set(n, resolve);
    ws.send(JSON.stringify({ id: n, method, params }));
  });
await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable');
await send('Page.reload'); // catch errors from the very first script run too
await sleep(4000);
// The page may still be (re)loading: retry, and report CDP errors verbatim.
let shown = false;
for (let i = 0; i < 10 && !shown; i++) {
  const reply = await send('Runtime.evaluate', {
    expression: "Boolean(document.getElementById('start-btn') && document.getElementById('setup-screen') && !document.getElementById('setup-screen').hidden)",
  });
  if (reply.error) console.log('evaluate error:', JSON.stringify(reply.error));
  shown = reply.result?.result?.value === true;
  if (!shown) await sleep(1000);
}
ws.close();
if (!shown) {
  console.error('SMOKE FAIL: start screen not shown');
  done(1);
}
if (errors.length) {
  console.error('SMOKE FAIL: page errors:\n' + errors.join('\n'));
  done(1);
}
console.log(`SMOKE OK (${plat}-${arch})`);
done(0);
