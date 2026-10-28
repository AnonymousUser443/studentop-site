import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EndlessRoad, roadFormation } from '../src/road.js';

for (let row = 0; row < 20; row++) {
  for (let column = -2; column <= 2; column++) {
    let previous = -Infinity;
    for (let d = 64; d >= 16; d -= 0.25) {
      const f = roadFormation(d, column, row);
      assert(f.lift >= previous && f.lift <= 0 && f.lift >= -8);
      assert.equal(f.offsetX, 0); assert.equal(f.offsetZ, 0);
      assert.equal(f.tiltX, 0); assert.equal(f.tiltZ, 0);
      if (f.visible) assert.equal(f.scale, 1);
      previous = f.lift;
    }
    assert.equal(roadFormation(18, column, row).lift, 0);
  }
}

// Compare rendered instance transforms in absolute world coordinates, cancelling
// the camera's forward movement and the origin shift used by the endless world.
const pathX = (s) => Math.sin(s * 0.0035) * 12;
const pathY = (s) => s * 0.032;
const road = new EndlessRoad(new THREE.Scene(), { pathX, pathY });
const matrix = new THREE.Matrix4();
function slab(travel, absoluteRow, column) {
  road.update(travel, 0);
  const slot = absoluteRow - (Math.floor(travel / 2.9) - 10);
  road.stones.getMatrixAt(slot * 7 + column, matrix);
  const position = new THREE.Vector3().setFromMatrixPosition(matrix);
  position.x += pathX(travel); position.y += pathY(travel); position.z -= travel;
  return { position, basis: matrix.elements.slice(0, 12) };
}
for (let column = 0; column < 3; column++) {
  const a = slab(0, 12, column);
  const b = slab(12, 12, column);
  assert(Math.abs(a.position.x - b.position.x) < 1e-5);
  assert(Math.abs(a.position.z - b.position.z) < 1e-5);
  assert(b.position.y > a.position.y);
  for (let i = 0; i < 12; i++) assert(Math.abs(a.basis[i] - b.basis[i]) < 1e-5);
}
road.dispose();
console.log('Vertical rise, fixed horizontal position, fixed orientation and flush settlement passed.');
