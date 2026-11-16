import { createRequire } from "node:module";
import { withQuietSdk } from "./sdk-context.mjs";
const require = createRequire(import.meta.url),
  sdk = withQuietSdk(() => require("@neteasecloudmusicapienhanced/api"));
for (const [name, params] of [
  ["song_url_v1", { level: "standard" }],
  ["song_url_v1", { level: "standard", crypto: "eapi" }],
  ["song_url", { br: 128000 }],
]) {
  try {
    const result = await withQuietSdk(() =>
      sdk[name]({
        id: "1357375695",
        cookie: { os: "pc" },
        unblock: false,
        timeout: 6000,
        ...params,
      }),
    );
    const row = result.body?.data?.[0];
    console.log(
      JSON.stringify({
        name,
        crypto: params.crypto ?? "default",
        status: result.status,
        code: result.body?.code,
        hasUrl: !!row?.url,
        hasPreview: !!row?.freeTrialInfo,
        br: row?.br,
        type: row?.type,
      }),
    );
  } catch (e) {
    const msg = String(e?.body?.msg ?? e?.message ?? "");
    console.log(
      JSON.stringify({
        name,
        crypto: params.crypto ?? "default",
        status: e.status,
        code: e.body?.code,
        type: e.name,
        fields: Object.keys(e.body ?? {}),
        category: /key/i.test(msg)
          ? "key"
          : /connect|network|socket|timed out|timeout/i.test(msg)
            ? "network"
            : /cookie/i.test(msg)
              ? "cookie"
              : /decrypt|encrypt/i.test(msg)
                ? "crypto"
                : "other",
      }),
    );
  }
}
