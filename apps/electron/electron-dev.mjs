/**
 * Dev launcher — waits for both the compiled main process and the renderer
 * dev server to be ready before starting Electron.
 */
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { setTimeout as sleep } from 'timers/promises';

const ROOT         = new URL('../..', import.meta.url).pathname;
const RENDERER_URL = 'http://localhost:4000';

async function waitForFile(filePath, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (!existsSync(filePath)) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${filePath}`);
    await sleep(500);
  }
}

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error(`Timed out waiting for ${url}`);
}

console.log('Waiting for main process build...');
await waitForFile(`${ROOT}/dist/apps/electron/main.js`);

console.log('Waiting for renderer dev server...');
await waitForServer(RENDERER_URL);

console.log('Starting Electron...');
const proc = spawn('electron', [`${ROOT}/dist/apps/electron/main.js`], {
  env:   { ...process.env, NODE_ENV: 'development' },
  stdio: 'inherit',
  shell: true,
});

proc.on('close', (code) => process.exit(code ?? 0));
