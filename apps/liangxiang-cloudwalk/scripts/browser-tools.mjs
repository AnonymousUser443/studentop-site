import { createRequire } from 'node:module';
import path from 'node:path';

const projectRequire = createRequire(new URL('../package.json', import.meta.url));
const repositoryRequire = createRequire(new URL('../../../package.json', import.meta.url));
const validate = (value) => {
  const api = value?.chromium ? value : value?.default;
  if (!api?.chromium || typeof api.chromium.launch !== 'function') throw new Error('Resolved module does not expose Playwright chromium.launch().');
  return api;
};

/** Optional QA dependency only: never install packages or fall back to a machine account cache. */
export function loadPlaywright() {
  const explicit = process.env.PLAYWRIGHT_MODULE?.trim();
  if (explicit) {
    const specifier = explicit.startsWith('.') ? path.resolve(explicit) : explicit;
    try { return validate(projectRequire(projectRequire.resolve(specifier))); }
    catch (cause) { throw new Error('Cannot load PLAYWRIGHT_MODULE. Point it to an already-installed Playwright package or module. This script does not install dependencies.', { cause }); }
  }
  for (const require of [projectRequire, repositoryRequire]) {
    try { return validate(require(require.resolve('playwright'))); }
    catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw new Error('Optional Playwright dependency was not found in the application or repository. Set PLAYWRIGHT_MODULE to an existing installation, or ask the project owner to prepare QA dependencies. No installation was attempted.');
}

/** Use an explicitly selected installed browser, otherwise Playwright's existing browser installation. */
export async function launchChromium(playwright, options = {}) {
  const executable = process.env.BROWSER_EXECUTABLE?.trim();
  const configured = executable ? { ...options, executablePath: path.resolve(executable) } : options;
  try { return await playwright.chromium.launch(configured); }
  catch (cause) { throw new Error('Cannot launch the configured installed browser. Set BROWSER_EXECUTABLE to an existing Chromium/Edge executable or prepare Playwright browsers through the project owner. This script does not download browsers.', { cause }); }
}
