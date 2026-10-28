import * as THREE from 'three';
import { VoxelBuilder, mulberry32, updateVoxelAtmosphere } from './voxel.js';
import { Atmosphere } from './atmosphere.js';
import { EndlessRoad } from './road.js';
import { SceneEffects } from './effects.js';
import { CloudSea } from './cloud-sea.js';
import { VoxelPortal } from './portal.js';
import { createLandmark, LANDMARKS } from './landmarks.js';

const ISLAND_SPAN = 87;
const ISLAND_COUNT = LANDMARKS.length;
const C = {
  cream: '#eee9da', white: '#faf7e9', shadow: '#b9c8c4',
  stone: '#9aaeb0', gold: '#b69b62', darkGold: '#8f7955',
  grass: '#91af96', paleGrass: '#c5c99f', foliage: '#709f89',
};
const pathX = (s) => Math.sin(s * 0.0035) * 12 + Math.sin(s * 0.009) * 2.4;
const pathY = (s) => s * 0.032 + Math.sin(s * 0.007) * 0.65;
const ease = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);

function makeTree(b, x, y, z, size, random, golden = false) {
  const trunk = size * 0.16;
  b.box(x, y + size * 0.38, z, trunk, size * 0.76, trunk, '#8e8970');
  const shades = golden ? ['#d2bd79', '#dfca8d', '#b9b47f', '#e8d9a5'] : ['#739d89', '#94b49c', '#b1c5a6', '#81aa93'];
  for (let k = 0; k < 12; k++) {
    const a = random() * Math.PI * 2;
    const r = random() * size * 0.32;
    const s = size * (0.29 + random() * 0.22);
    b.box(x + Math.cos(a) * r, y + size * (0.7 + random() * 0.3), z + Math.sin(a) * r,
      s, s * (0.7 + random() * 0.4), s, shades[k % shades.length]);
  }
}

function makeIsland(seed, width = 47, depth = 34) {
  const b = new VoxelBuilder();
  const random = mulberry32(seed);
  const cell = 2.5;
  const shades = ['#bec9bd', '#d5d6bf', '#c7ccbb', '#b5c5b6'];
  for (let z = -depth / 2; z <= depth / 2; z += cell) {
    for (let x = -width / 2; x <= width / 2; x += cell) {
      const edge = (x / (width * 0.5)) ** 2 + (z / (depth * 0.5)) ** 2;
      if (edge > 0.88 + random() * 0.15) continue;
      b.box(x, -0.75, z, cell + 0.01, 1.5, cell + 0.01, shades[Math.floor(random() * shades.length)]);
      if (edge > 0.72 && random() > 0.75) {
        b.box(x, 0.14, z, 1.5, 0.28, 1.5, C.paleGrass);
      }
      const height = 2.5 + (1 - edge) * 8 + random() * 3;
      b.box(x, -1.5 - height / 2, z, cell, height, cell,
        ['#b6bfb6', '#a4b5b0', '#c3c9b9', '#92aaab'][Math.floor(random() * 4)]);
      if (edge < 0.42 && random() > 0.72) {
        b.box(x, -height - 3.5, z, cell * 0.6, 4 + random() * 4, cell * 0.6, '#8ea7a7');
      }
      if (random() > 0.91) b.box(x, -3.6, z, cell * 1.02, 0.32, cell * 1.02, '#d3c58f');
    }
  }
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + random() * 0.2;
    const x = Math.cos(angle) * width * 0.40;
    const z = Math.sin(angle) * depth * 0.37;
    if (z < -7 || Math.abs(x) > 16) makeTree(b, x, 0, z, 3.3 + random() * 2.2, random, i % 3 !== 1);
  }
  return b.build();
}

function cloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const random = mulberry32(1188);
  for (let i = 0; i < 22; i++) {
    const x = 80 + random() * 350;
    const y = 100 + random() * 70;
    const r = 40 + random() * 65;
    const gradient = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
    gradient.addColorStop(0, 'rgba(255,255,255,.92)');
    gradient.addColorStop(0.56, 'rgba(255,255,255,.65)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 512, 256);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makePortal() {
  return new VoxelPortal();
}

/** An origin-relative endless world: no ever-growing GPU coordinates or chunk allocations. */
export class CampusJourney {
  constructor(canvas, { onLandmark = () => {}, onDistance = () => {}, onTimeChange = () => {}, timeMode = 'auto' } = {}) {
    this.canvas = canvas;
    this.onLandmark = onLandmark;
    this.onDistance = onDistance;
    this.onTimeChange = onTimeChange;
    this.timeMode = timeMode;
    this.clockCheck = 0;
    this.travel = 0;
    this.elapsed = 0;
    this.speed = 1;
    this.journey = false;
    this.paused = false;
    this.lastLandmark = -1;
    this.pointer = new THREE.Vector2();
    this.gaze = new THREE.Vector2();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.info.autoReset = false;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.18, 1600);
    this.camera.position.set(0, 2.5, 8);
    this.atmosphere = new Atmosphere({ scene: this.scene, camera: this.camera, renderer: this.renderer });
    this.setTimeMode(timeMode, true);
    this.road = new EndlessRoad(this.scene, { pathX, pathY });
    this.cloudSea = new CloudSea(this.scene);
    this.islands = [];
    const kinds = LANDMARKS.map((landmark) => landmark.id);
    for (let i = 0; i < ISLAND_COUNT; i++) {
      const island = new THREE.Group();
      const type = kinds[i % kinds.length];
      island.add(makeIsland(532 + i));
      const landmark = createLandmark(type, { seed: 201 + i });
      landmark.rotation.y = (i % 2 ? -1 : 1) * 0.12;
      landmark.position.z = -1.5;
      island.add(landmark);
      island.userData = { anchor: 42 + i * ISLAND_SPAN + (i % 4 === 0 ? 12 : i % 4 === 1 ? -18 : 0), side: i % 2 ? 1 : -1, type, index: i % kinds.length, phase: i * 1.7 };
      this.islands.push(island); this.scene.add(island);
    }
    // Smaller terraces lend depth between the four architectural islands.
    this.terraces = [];
    for (let i = 0; i < 10; i++) {
      const group = new THREE.Group();
      group.add(makeIsland(810 + i, 10 + i % 3 * 2, 9));
      const b = new VoxelBuilder();
      const random = mulberry32(i + 28);
      makeTree(b, 0, 0, -1, 4.2, random, i % 2 === 0);
      group.add(b.build());
      group.userData = { anchor: 20 + i * 62, side: i % 2 ? -1 : 1, offset: 59 + (i % 3) * 18, phase: i * 0.8 };
      this.terraces.push(group); this.scene.add(group);
    }
    this.clouds = [];
    const texture = cloudTexture();
    const random = mulberry32(640);
    for (let i = 0; i < 60; i++) {
      const material = new THREE.SpriteMaterial({ map: texture, color: i % 3 ? '#f8f9ef' : '#d8e7e6', transparent: true, opacity: 0.70, depthWrite: false, fog: true });
      const cloud = new THREE.Sprite(material);
      const size = 65 + random() * 100;
      cloud.scale.set(size, size * 0.48, 1);
      cloud.userData = { anchor: -45 + random() * 750, x: (random() - 0.5) * 460, y: -11 - random() * 23, opacity: 0.64 + random() * 0.26, phase: random() * Math.PI * 2 };
      this.clouds.push(cloud); this.scene.add(cloud);
    }
    this.portals = [];
    for (let i = 0; i < 3; i++) {
      const portal = makePortal();
      portal.userData.anchor = 218 + i * 235;
      this.portals.push(portal); this.scene.add(portal);
    }
    this.createMotes();
    this.effects = new SceneEffects(this.renderer, this.scene, this.camera);
    this.resize = this.resize.bind(this);
    this.pointerMove = this.pointerMove.bind(this);
    this.render = this.render.bind(this);
    window.addEventListener('resize', this.resize);
    window.addEventListener('pointermove', this.pointerMove, { passive: true });
    this.visibilityChange = () => { this.lastTime = performance.now(); this.syncClock(true); };
    document.addEventListener('visibilitychange', this.visibilityChange);
    this.lastTime = performance.now();
    this.frame = 0;
    this.render(this.lastTime);
  }

  createMotes() {
    const count = 110;
    const positions = new Float32Array(count * 3);
    const random = mulberry32(7);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (random() - 0.5) * 100;
      positions[i * 3 + 1] = random() * 34 - 3;
      positions[i * 3 + 2] = -random() * 250;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: '#fff5d5', size: 0.15, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false });
    this.motes = new THREE.Points(geometry, material);
    this.scene.add(this.motes);
  }

  placeAlongPath(object, anchor, side = 0, offset = 0, height = 0) {
    const d = anchor - this.travel;
    object.position.set(pathX(anchor) - pathX(this.travel) + side * offset, pathY(anchor) - pathY(this.travel) + height, -d);
    object.rotation.y = -Math.atan((pathX(anchor + 1) - pathX(anchor - 1)) / 2);
    return d;
  }

  updateWorld(dt) {
    const movement = this.paused ? 0 : dt * this.speed * (this.journey ? 5.4 : 2.6);
    this.travel += movement;
    this.elapsed += this.paused ? 0 : dt;
    this.road.update(this.travel, this.elapsed);
    this.road.setNightFactor(this.atmosphere.nightFactor);
    let nearest = null;
    let nearestDistance = Infinity;
    for (const island of this.islands) {
      const u = island.userData;
      while (u.anchor - this.travel < -115) u.anchor += ISLAND_COUNT * ISLAND_SPAN;
      const d = this.placeAlongPath(island, u.anchor, u.side, 36 + (u.index === 2 ? 3 : 0), -5.5 + Math.sin(this.elapsed * 0.24 + u.phase) * 0.45);
      island.rotation.y += u.side * 0.075;
      island.position.y -= ease(320, 600, d) * 24;
      const distance = Math.abs(d - 35);
      if (distance < nearestDistance) { nearest = u; nearestDistance = distance; }
    }
    if (nearest && nearest.index !== this.lastLandmark) {
      this.lastLandmark = nearest.index;
      const data = LANDMARKS.find((l) => l.id === nearest.type) || LANDMARKS[nearest.index];
      this.onLandmark({ ...data, index: nearest.index });
    }
    for (const terrace of this.terraces) {
      const u = terrace.userData;
      while (u.anchor - this.travel < -100) u.anchor += 620;
      this.placeAlongPath(terrace, u.anchor, u.side, u.offset, -10 + Math.sin(this.elapsed * 0.22 + u.phase) * 1.1);
    }
    for (const portal of this.portals) {
      while (portal.userData.anchor - this.travel < -70) portal.userData.anchor += 705;
      this.placeAlongPath(portal, portal.userData.anchor);
      portal.updateConstruction(this.travel, this.road, this.elapsed);
    }
    for (const cloud of this.clouds) {
      const u = cloud.userData;
      while (u.anchor - this.travel < -110) u.anchor += 780;
      cloud.position.set(u.x + Math.sin(this.elapsed * 0.025 + u.phase) * 9, u.y, -(u.anchor - this.travel));
      const corridor = Math.abs(u.x) < 45 && u.anchor - this.travel < 160 ? 0.24 : 0.78;
      cloud.material.opacity = u.opacity * (1 - this.atmosphere.nightFactor * 0.35) * corridor;
      cloud.material.color.copy(this.atmosphere.cloudColor);
    }
    const positions = this.motes.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      let z = positions.getZ(i) + movement * 0.78;
      if (z > 25) z -= 275;
      positions.setZ(i, z);
    }
    positions.needsUpdate = true;
    this.motes.rotation.z = Math.sin(this.elapsed * 0.05) * 0.025;
    this.onDistance(Math.floor(this.travel));
  }

  render(now) {
    this.frame = requestAnimationFrame(this.render);
    const dt = Math.min(Math.max((now - this.lastTime) / 1000, 0), 0.06);
    this.lastTime = now;
    if (document.hidden || window.innerHeight > window.innerWidth) return;
    this.updateWorld(dt);
    this.gaze.lerp(this.pointer, 1 - Math.exp(-dt * 2.3));
    const bob = this.paused ? 0 : Math.sin(this.elapsed * 0.75) * 0.08;
    this.camera.position.set(this.gaze.x * 0.26, 2.5 + this.gaze.y * 0.13 + bob * 0.45, 8);
    this.camera.lookAt(this.gaze.x * 1.2, 14.0 + this.gaze.y * 0.5, -140);
    this.syncClock();
    this.atmosphere.update(dt, this.elapsed);
    updateVoxelAtmosphere(this.elapsed, this.atmosphere.nightFactor, this.atmosphere.fog.color, this.atmosphere.sunDirection);
    this.cloudSea.update(this.atmosphere, this.elapsed);
    this.effects.update(this.atmosphere, this.elapsed);
    this.effects.render(dt);
  }

  pointerMove(event) {
    this.pointer.set((event.clientX / window.innerWidth - 0.5) * 2, -(event.clientY / window.innerHeight - 0.5) * 2);
  }
  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.effects.resize(window.innerWidth, window.innerHeight);
  }
  setTimeMode(mode, instant = false) {
    const presets = { morning: 7.5, day: 12, evening: 18, night: 22 };
    this.timeMode = Object.hasOwn(presets, mode) ? mode : 'auto';
    const hour = this.timeMode === 'auto' ? beijingHour() : presets[this.timeMode];
    this.atmosphere.setTime(hour, instant);
    this.clockCheck = performance.now();
    this.onTimeChange({ mode: this.timeMode, ...this.atmosphere.getState() });
  }
  syncClock(force = false) {
    if (this.timeMode !== 'auto' || (!force && performance.now() - this.clockCheck < 1000)) return;
    this.setTimeMode('auto');
  }
  start() { this.journey = true; }
  setPaused(value) { this.paused = value; }
  setSpeed(value) { this.speed = value; }
  jumpToLandmark(index) {
    const island = this.islands.filter((i) => i.userData.index === index).sort((a, b) => a.userData.anchor - b.userData.anchor).find((i) => i.userData.anchor >= this.travel + 5);
    if (island) this.travel = Math.max(this.travel, island.userData.anchor - 60);
  }
  stats() {
    return {
      distance: this.travel, paused: this.paused, speed: this.speed,
      ...this.road.stats(), islandCount: this.islands.length,
      portals: this.portals.map((portal) => portal.constructionStats()),
      landmarks: this.islands.map((island) => ({ id: island.userData.type, index: island.userData.index, anchor: island.userData.anchor })),
      cameraHeight: this.camera.position.y, timeMode: this.timeMode, ...this.atmosphere.getState(),
      nightFactor: this.atmosphere.nightFactor, rayStrength: this.atmosphere.rayStrength,
      effects: ['procedural-sky', 'cloud-noise', 'moon-craters', 'stars', 'height-haze', 'depth-light-shafts', 'bloom', 'FXAA'],
      drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures,
      renderer: this.renderer.getContext().getParameter(this.renderer.getContext().VERSION),
    };
  }
  dispose() {
    cancelAnimationFrame(this.frame);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('pointermove', this.pointerMove);
    document.removeEventListener('visibilitychange', this.visibilityChange);
    this.road.dispose(); this.atmosphere.dispose(); this.cloudSea.dispose(); this.effects.dispose();
    this.portals.forEach((portal) => portal.dispose());
    this.renderer.dispose();
  }
}

export function beijingHour(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return Number(values.hour) + Number(values.minute) / 60 + Number(values.second) / 3600;
}
