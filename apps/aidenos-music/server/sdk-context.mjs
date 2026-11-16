import { AsyncLocalStorage } from "node:async_hooks";

// This pinned SDK logs whole failed responses, including Set-Cookie. Suppress its
// own async console context before it can reach stdout/stderr; application logs
// outside SDK calls are unchanged. No request/cookie values are logged here.
const quietSdk = new AsyncLocalStorage();
let installed = false;
function install() {
  if (installed) return;
  installed = true;
  for (const name of ["log", "info", "warn", "error", "debug"]) {
    const original = console[name].bind(console);
    console[name] = (...args) => {
      if (!quietSdk.getStore()) original(...args);
    };
  }
}
export function withQuietSdk(work) {
  install();
  return quietSdk.run(true, work);
}
