#!/usr/bin/env node
import { createMusicServer } from "./app.mjs";

const port = Number(process.env.MUSIC_PORT || 8901);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535)
  throw new Error("MUSIC_PORT must be an unprivileged TCP port.");
const app = createMusicServer();
app.server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
  console.log(`AidenOS Music ready on loopback:${port}`);
  if (process.connected) process.send?.({ type: "ready", id: "music", port });
});
let closing = false;
function stop() {
  if (closing) return;
  closing = true;
  void app
    .close()
    .catch(() => {
      process.exitCode = 1;
    })
    .finally(() => {
      if (process.connected) process.disconnect();
    });
}
app.server.on("error", () => {
  console.error("AidenOS Music listener unavailable.");
  process.exitCode = 1;
  stop();
});
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
process.on("message", (message) => {
  if (message?.type === "shutdown") stop();
});
process.once("disconnect", stop);
