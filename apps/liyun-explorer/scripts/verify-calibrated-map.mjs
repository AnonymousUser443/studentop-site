import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(resolve(root, path));
const sha = path => createHash('sha256').update(read(path)).digest('hex');
const expected = {
  'src/location/vendor/coordinates.mjs':'df79a77de465e34e0622a94398dd638731b81179a07e084a088748f10f261f0c',
  'src/location/vendor/model-transform.mjs':'b9e950c4aced553109ae85af8e0e4a3df500ef050219328262d9507e63eb3be6',
  'src/location/data/map.json':'2998857bea6918e6b4bc8ca6a54f7c58f9be22012fa3e5e576962e9ae5014907',
  'src/location/data/selected_model.json':'b9daad2e079047fa0601b462b5516ab187bc3505ac86733ee953267160abc465',
  'public/assets/maps/calibrated/campus_no_labels.webp':'bc5f8dd0c07b6a296152cade00a11d9c32055ea01a06a837a559ab0d8a37c474',
  'public/assets/maps/calibrated/campus_no_labels.png':'ed9fae1e1ef6fea0d0998abf7a2d586d1a15bd3058411c06cd1b9268be5e447f',
};
for (const [path, hash] of Object.entries(expected)) assert.equal(sha(path), hash, `Calibrated source changed: ${path}`);
const metadata = JSON.parse(read('src/location/data/map.json'));
assert.equal(metadata.map_id, 'campus-v04-eaa124716c51375f');
assert.deepEqual(metadata.view_box, [0, 0, 1000.56, 1240.28003]);
assert.equal(metadata.gps_coordinate_system, 'WGS84');
console.log(JSON.stringify({ passed:true, unchanged_files:Object.keys(expected).length, map_id:metadata.map_id, canvas:[4000,4958], coordinate_system:'WGS84' }));
