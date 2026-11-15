#!/usr/bin/env node
/** Read-only real-upstream diagnostic. Creates only an ephemeral local guest session. */
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { createMusicServer, PREFIX } from "./app.mjs";
import { MusicStore } from "./store.mjs";

const gatewayKey = randomBytes(32).toString("hex"),
  cookieKey = randomBytes(32).toString("hex");
const store = new MusicStore({ file: ":memory:", cookieKey });
const app = createMusicServer({
  store,
  gatewayKey,
  publicOrigin: "http://127.0.0.1:8899",
  secureCookies: false,
});
const checks = [],
  jar = new Map();
try {
  await new Promise((resolve) =>
    app.server.listen({ host: "127.0.0.1", port: 0 }, resolve),
  );
  const base = "http://127.0.0.1:" + app.server.address().port + PREFIX;
  async function request(route, body, extra = {}) {
    const response = await fetch(base + route, {
      method: body ? "POST" : "GET",
      headers: {
        "X-Music-Gateway": gatewayKey,
        "X-Music-Access": "desktop",
        Cookie: [...jar].map(([key, value]) => key + "=" + value).join("; "),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...extra,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0],
        index = pair.indexOf("=");
      jar.set(pair.slice(0, index), pair.slice(index + 1));
    }
    const envelope = await response.json();
    checks.push({
      route: route.split("?")[0].replace(/\/[a-f0-9]{64}$/, "/:challenge"),
      status: response.status,
      ok: response.ok && envelope.ok === true,
      ...(!envelope.ok ? { error: envelope.error?.code } : {}),
    });
    return envelope;
  }
  await request("session");
  const qr = await request("auth/qr", {});
  if (qr.ok) {
    checks.push({
      name: "qr-image-generated",
      ok: qr.data.imageUrl.startsWith("data:image/png;base64,"),
    });
    const pending = await request("auth/qr/" + qr.data.id);
    if (pending.ok)
      checks.push({
        name: "unscanned-qr-waiting",
        ok: pending.data.status === "waiting",
      });
  }
  const home = await request("home");
  if (home.ok)
    checks.push({
      name: "nonempty-home",
      ok:
        home.data.featured.length +
          home.data.recommended.length +
          home.data.tracks.length >
        0,
    });
  const search = await request(
    "search?" +
      new URLSearchParams({ q: "海阔天空", type: "tracks", offset: "0" }),
  );
  if (search.ok) {
    const first = search.data.tracks[0];
    checks.push({ name: "nonempty-search", ok: !!first });
    if (first) {
      await request("lyrics/" + first.id);
      const lease = await request("playback/lease", {});
      if (lease.ok)
        await request(
          "playback/resolve",
          { id: first.id, quality: "standard" },
          { "X-Music-Playback-CSRF": lease.data.csrfToken },
        );
    }
  }
  const require = createRequire(import.meta.url);
  const version =
    require("@neteasecloudmusicapienhanced/api/package.json").version;
  const result = {
    ok: checks.every((item) => item.ok),
    sdkVersion: version,
    checks,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} finally {
  await app.close();
  store.close();
}
