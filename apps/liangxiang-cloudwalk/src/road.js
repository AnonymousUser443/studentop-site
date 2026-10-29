import * as THREE from 'three';

const ROW_LENGTH = 2.9;
const ROW_COUNT = 92;
const SETTLED_DISTANCE = 18;
const REVEAL_DISTANCE = 62;
const WIDTH = 9.56;
const BORDER = 0.62;
const MAIN_WIDTH = (WIDTH - BORDER * 2) / 3;
const STONE_PER_ROW = 7;
const GOLD_PER_ROW = 8;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => v * v * (3 - 2 * v);

function hash(seed) {
  let n = Math.imul((seed | 0) ^ 0x45d9f3b, 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/**
 * A deterministic approach animation in camera-relative metres. The same slab
 * remains fully joined once it is within 18 m, and does not exist beyond 62 m.
 * Each column rises directly below its final position; only its arrival time varies.
 */
export function roadFormation(distance, column = 0, rowPhase = 0, result = {}) {
  const random = hash(rowPhase * 31 + column * 119);
  const start = REVEAL_DISTANCE - random * 8 - Math.abs(column) * 1.7;
  let progress = clamp01((start - distance) / (start - SETTLED_DISTANCE));
  progress = clamp01(progress + Math.sin(progress * Math.PI) * (random - 0.5) * 0.16);
  // Keep the last part of the approach in view instead of completing the lift
  // near the horizon. The smooth endpoint still meets the next row without a snap.
  const eased = smooth(Math.pow(progress, 1.2));
  const unformed = 1 - eased;
  const drop = 5 + random * 3;
  // Rise vertically from underneath, slowing into the road without overshooting.
  // The faster initial lift lets the last few rows emerge near the front edge.
  const lift = -drop * Math.pow(unformed, 3);
  return Object.assign(result, {
    progress,
    visible: progress > 0,
    scale: progress > 0 ? 1 : 0,
    lift: unformed === 0 ? 0 : lift,
    offsetX: 0,
    offsetZ: 0,
    tiltX: 0,
    tiltZ: 0,
  });
}

/**
 * A small fixed pool, recalculated from absolute row numbers after any jump.
 * No allocations, material creation, or texture creation happen during travel.
 */
export class EndlessRoad {
  constructor(scene, { pathX = () => 0, pathY = (s) => s * 0.032 } = {}) {
    this.scene = scene;
    this.pathX = pathX;
    this.pathY = pathY;
    this.group = new THREE.Group();
    this.group.name = 'endless-assembling-road';
    this.geometry = new THREE.BoxGeometry(1, 1, 1);
    this.stoneMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.84, metalness: 0.025 });
    this.goldMaterial = new THREE.MeshStandardMaterial({ color: '#b59d68', emissive: '#d7b268', emissiveIntensity: 0.06, roughness: 0.45, metalness: 0.43 });
    this.stones = new THREE.InstancedMesh(this.geometry, this.stoneMaterial, ROW_COUNT * STONE_PER_ROW);
    this.gold = new THREE.InstancedMesh(this.geometry, this.goldMaterial, ROW_COUNT * GOLD_PER_ROW);
    for (const mesh of [this.stones, this.gold]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // Instances are origin-relative and change every frame; no stale CPU bounds.
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
    }
    this.stones.castShadow = true;
    this.gold.castShadow = false;
    this.group.add(this.stones, this.gold);
    scene.add(this.group);
    this.transform = new THREE.Object3D();
    this.color = new THREE.Color();
    this.forms = Array.from({ length: 5 }, () => ({}));
    this.nightFactor = 0;
    this._stats = { roadRows: ROW_COUNT, roadChunks: ROW_COUNT, formingRows: 0, totalInstances: ROW_COUNT * (STONE_PER_ROW + GOLD_PER_ROW), frontDistance: SETTLED_DISTANCE, farVisibleDistance: REVEAL_DISTANCE };
    this.update(0, 0);
  }

  /** Put a local cuboid on the row, inheriting the individual slab's assembly. */
  put(mesh, index, row, form, x, y, width, height, depth, tint, extraYaw = 0, enabled = true) {
    const dummy = this.transform;
    if (!enabled || !form.visible || form.scale <= 0) {
      dummy.position.set(0, -1000, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(0, 0, 0);
    } else {
      const horizontal = x + form.offsetX;
      const cos = Math.cos(row.yaw);
      const sin = Math.sin(row.yaw);
      dummy.position.set(
        row.x + horizontal * cos,
        row.y + y + form.lift,
        -row.distance - horizontal * sin + form.offsetZ,
      );
      dummy.rotation.set(row.pitch + form.tiltX, row.yaw + extraYaw, form.tiltZ, 'YXZ');
      dummy.scale.set(width * form.scale, height * form.scale, depth * form.scale);
    }
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    if (tint) mesh.setColorAt(index, this.color.set(tint));
  }

  update(travel, elapsed) {
    const baseRow = Math.floor(travel / ROW_LENGTH) - 10;
    const originX = this.pathX(travel);
    const originY = this.pathY(travel);
    let formingRows = 0;
    let visibleRows = 0;
    // Reused scratch row data avoids allocating a new transform per cuboid.
    const row = this._row || (this._row = {});
    for (let slot = 0; slot < ROW_COUNT; slot++) {
      const absoluteRow = baseRow + slot;
      const anchor = (absoluteRow + 0.5) * ROW_LENGTH;
      const distance = anchor - travel;
      row.x = this.pathX(anchor) - originX;
      row.y = this.pathY(anchor) - originY;
      row.distance = distance;
      row.yaw = -Math.atan((this.pathX(anchor + 0.2) - this.pathX(anchor - 0.2)) / 0.4);
      row.pitch = Math.atan((this.pathY(anchor + 0.2) - this.pathY(anchor - 0.2)) / 0.4);
      const forms = this.forms;
      let forming = false;
      let visible = false;
      for (let column = -2; column <= 2; column++) {
        const form = roadFormation(distance, column, absoluteRow, forms[column + 2]);
        if (form.progress > 0 && form.progress < 1) forming = true;
        if (form.visible) visible = true;
      }
      if (forming) formingRows++;
      if (visible) visibleRows++;
      const si = slot * STONE_PER_ROW;
      const gi = slot * GOLD_PER_ROW;
      const warm = absoluteRow % 4 === 0;
      for (let c = -1; c <= 1; c++) {
        const tint = warm ? '#e3dccb' : (absoluteRow + c) % 3 === 0 ? '#f2ecdc' : '#eae4d3';
        this.put(this.stones, si + c + 1, row, forms[c + 2], c * MAIN_WIDTH, -0.33, MAIN_WIDTH - 0.025, 0.66, ROW_LENGTH - 0.025, tint);
      }
      for (const side of [-1, 1]) {
        const form = forms[side < 0 ? 0 : 4];
        const borderX = side * (WIDTH / 2 - BORDER / 2);
        const sideIndex = side < 0 ? 0 : 1;
        this.put(this.stones, si + 3 + sideIndex, row, form, borderX, -0.15, BORDER - 0.015, 0.36, ROW_LENGTH - 0.025, '#dbd0b6');
        // Only sparse low posts: no tall balustrade to hide the path's horizon.
        const hasPost = ((absoluteRow % 5) + 5) % 5 === 0;
        this.put(this.stones, si + 5 + sideIndex, row, form, side * (WIDTH / 2 + 0.04), 0.25, 0.46, 0.50, 0.55, '#ede5cf', 0, hasPost);
        this.put(this.gold, gi + sideIndex, row, form, side * (WIDTH / 2 - 0.08), 0.045, 0.055, 0.045, ROW_LENGTH - 0.015);
        this.put(this.gold, gi + 2 + sideIndex, row, form, side * (WIDTH / 2 - BORDER + 0.035), 0.044, 0.035, 0.038, ROW_LENGTH - 0.015);
        this.put(this.gold, gi + 4 + sideIndex, row, form, side * (WIDTH / 2 + 0.04), 0.525, 0.56, 0.055, 0.64, null, 0, hasPost);
      }
      // Small inlaid diamonds catch moonlight; no bright continuous centre lane.
      const centerForm = forms[2];
      const motif = ((absoluteRow % 4) + 4) % 4 === 0;
      this.put(this.gold, gi + 6, row, centerForm, 0, 0.016, 0.15, 0.025, 0.15, null, Math.PI / 4, motif);
      this.put(this.gold, gi + 7, row, centerForm, 0, 0.018, 0.035, 0.026, 0.62, null, 0, motif);
    }
    this.stones.instanceMatrix.needsUpdate = true;
    this.gold.instanceMatrix.needsUpdate = true;
    if (this.stones.instanceColor) this.stones.instanceColor.needsUpdate = true;
    this._stats.formingRows = formingRows;
    this._stats.visibleRows = visibleRows;
    this._stats.distance = travel;
    this._stats.elapsed = elapsed;
  }

  setNightFactor(value) {
    this.nightFactor = clamp01(value);
    this.goldMaterial.emissiveIntensity = 0.06 + this.nightFactor * 1.35;
  }

  stats() { return { ...this._stats }; }

  /** Last supporting row must have finished rising before a structure starts. */
  supportReadyAt(distance, halfDepth = 0) {
    const lastRow = Math.floor((distance + halfDepth) / ROW_LENGTH);
    return (lastRow + 0.5) * ROW_LENGTH - SETTLED_DISTANCE;
  }

  hasSettledSupport(distance, halfDepth = 0, travel = this._stats.distance) {
    const first = Math.floor((distance - halfDepth) / ROW_LENGTH);
    const last = Math.floor((distance + halfDepth) / ROW_LENGTH);
    for (let row = first; row <= last; row++) {
      const d = (row + 0.5) * ROW_LENGTH - travel;
      for (let column = -2; column <= 2; column++) {
        if (roadFormation(d, column, row).progress < 1) return false;
      }
    }
    return true;
  }

  dispose() {
    this.scene.remove(this.group);
    this.geometry.dispose();
    this.stoneMaterial.dispose();
    this.goldMaterial.dispose();
    this.stones.dispose();
    this.gold.dispose();
  }
}
