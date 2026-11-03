#!/usr/bin/env node
// Local author tool launcher. Reuse only an identified Liyun Vite server.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'http://127.0.0.1:5174';
const url = origin + '/?tool=calibration';
const noOpen = process.argv.slice(2).includes('--no-open');
if (process.argv.slice(2).some(arg => arg !== '--no-open')) throw Error('Usage: npm run calibrate [-- --no-open]');

function openBrowser() {
  const [command, args] = process.platform === 'win32'
    ? ['rundll32.exe', ['url.dll,FileProtocolHandler', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  const child = spawn(command, args, { stdio: 'ignore', windowsHide: true });
  child.on('error', () => console.error('Open this URL in your browser: ' + url));
  child.unref();
}

let existing = false;
try {
  const response = await fetch(origin, { signal: AbortSignal.timeout(1500) });
  const html = await response.text();
  if (!response.ok || !html.includes('/@vite/client') || !html.includes('/src/main.tsx') || !html.includes('理韵寻踪')) {
    throw Error('Port 5174 belongs to another service. It has not been stopped or reused.');
  }
  existing = true;
} catch (error) {
  if (error.cause?.code !== 'ECONNREFUSED') throw error;
}

console.log('Campus calibration editor: ' + url);
if (existing) {
  console.log('Reusing the running Liyun development server.');
  if (!noOpen) openBrowser();
} else {
  const require = createRequire(import.meta.url);
  const vite = path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js');
  if (!fs.statSync(vite).isFile()) throw Error('Vite is missing. Run npm ci in the app directory.');
  console.log('Keep this terminal open while editing. Press Ctrl+C to stop.');
  const child = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', '5174', '--strictPort', ...(!noOpen ? ['--open', '/?tool=calibration'] : [])], { cwd: root, stdio: 'inherit', windowsHide: true });
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
}
