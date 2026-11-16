/** Execute pinned official module wrappers against a recording transport, without account/network calls. */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const sdkRoot = path.dirname(require.resolve("@neteasecloudmusicapienhanced/api/package.json"));
const cookie = { MUSIC_U: "isolated-sdk-contract-fixture", os: "pc" };
async function invoke(name, params) {
  const module = require(path.join(sdkRoot, "module", name + ".js"));
  return module({ ...params, cookie, unblock: false }, async (url, data, options) => ({ url, data, options }));
}

test("fixed SDK 4.41.1 cloud and create-list wrappers expose official paginated read endpoints", async () => {
  assert.equal(require(path.join(sdkRoot, "package.json")).version, "4.41.1");
  const cloud = await invoke("user_cloud", { limit: 50, offset: 100 });
  assert.equal(cloud.url, "/api/v1/cloud/get");assert.deepEqual(cloud.data, { limit: 50, offset: 100 });assert.equal(cloud.options.crypto, "weapi");
  const created = await invoke("user_playlist_create", { uid: "11", limit: 100, offset: 200 });
  assert.equal(created.url, "/api/user/playlist/create");assert.equal(created.data.userId, "11");assert.equal(created.data.offset, 200);
  assert.equal(created.options.cookie, cookie);
});

test("fixed SDK song comment wrappers preserve the song resource type, cursor and explicit add/reply/like verbs", async () => {
  const read = await invoke("comment_music", { id: "1", limit: 20, offset: 0, before: 1700000000000 });
  assert.equal(read.url, "/api/v1/resource/comments/R_SO_4_1");assert.equal(read.data.beforeTime, 1700000000000);
  const like = await invoke("comment_like", { id: "1", cid: "701", type: 0, t: 1 });
  assert.equal(like.url, "/api/v1/comment/like");assert.deepEqual(like.data, { threadId: "R_SO_4_1", commentId: "701" });
  const unlike = await invoke("comment_like", { id: "1", cid: "701", type: 0, t: 0 });assert.equal(unlike.url, "/api/v1/comment/unlike");
  const send = await invoke("comment", { id: "1", content: "isolated fixture", type: 0, t: 1 });
  assert.equal(send.url, "/api/resource/comments/add");assert.equal(send.data.threadId, "R_SO_4_1");assert.equal(send.options.crypto, "eapi");
  const reply = await invoke("comment", { id: "1", content: "isolated reply", commentId: "701", type: 0, t: 2 });
  assert.equal(reply.url, "/api/resource/comments/reply");assert.equal(reply.data.commentId, "701");
});

test("fixed SDK heart-mode wrapper supports only the official seed and playlist context contract", async () => {
  const result = await invoke("playmode_intelligence_list", { id: "1", pid: "101", sid: "1", count: 30 });
  assert.equal(result.url, "/api/playmode/intelligence/list");
  assert.deepEqual(result.data, { songId: "1", type: "fromPlayOne", playlistId: "101", startMusicId: "1", count: 30 });
  assert.equal(result.options.cookie, cookie);
});
