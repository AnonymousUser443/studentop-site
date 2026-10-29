import * as THREE from 'three';
import { VoxelBuilder, mulberry32 } from './voxel.js';
import { roundHall, wingHall } from './photo-modern.js';
import { heritageHall, mottoGarden } from './photo-heritage.js';
import { photoGate } from './photo-gate.js';

// Campus silhouettes are based on the cited photographs. The floating-island
// scale, autumn planting and small decorative details are an artistic treatment.
export const LANDMARKS = [
  {
    id: 'library',
    title: '徐特立图书馆',
    subtitle: 'XU TELI LIBRARY',
    description: '透过一整面的玻璃，遇见良乡的书香。',
    source: 'https://www.bit.edu.cn/xww/xwtt/a66529.htm',
  },
  {
    id: 'gate',
    title: '双塔校门',
    subtitle: 'THE CAMPUS GATE',
    description: '折线石纹、校徽与竖排校名，迎接下一次入校。',
    source: 'https://liangxiang.bit.edu.cn/jgsz/bmjs/index.htm',
    reference: 'user-photo-05',
  },
  {
    id: 'round', title: '圆厅 · I ♥ BIT', subtitle: 'THE ROUND HALL',
    description: '圆厅前的红色爱心，留住属于北理的一张合影。',
    source: null, reference: 'user-photo-02',
  },
  {
    id: 'wing', title: '翼形展馆 · 飞机陈列', subtitle: 'THE WINGED EXHIBITION HALL',
    description: '挑檐舒展，玻璃映天；静静陈列的飞机见证校园记忆。',
    source: null, reference: 'user-photo-03',
  },
  {
    id: 'heritage', title: '白石主楼 · 校名石', subtitle: 'THE CLASSIC FACADE',
    description: '拱窗、旗杆与金字校名，定格熟悉的校园正面。',
    source: null, reference: 'user-photo-01',
  },
  {
    id: 'motto', title: '校训石 · 德以明理', subtitle: 'THE CAMPUS MOTTO',
    description: '德以明理，学以精工；绿荫下的北理印记。',
    source: null, reference: 'user-photo-04',
  },
  {
    id: 'lake',
    title: '北湖 · 初心亭',
    subtitle: 'NORTH LAKE',
    description: '风拂过北湖，水面收留了一片天空。',
    source: 'https://www.bit.edu.cn/xww/lgxb21/03ba20c7c0d54a1cb84ecce2da9b2443.htm',
  },
  {
    id: 'main',
    title: '文博中心',
    subtitle: 'CULTURE & MUSEUM',
    description: '白石长廊之间，校园的记忆与回响。',
    source: 'https://www.bucg.com/xwxx/qydt/20231123/27344.shtml',
  },
];

const C = {
  white: '#f4f0df',
  stone: '#dedbc9',
  stoneLight: '#ede9d8',
  stoneDark: '#a6b6ab',
  gold: '#c2a76b',
  bronze: '#9a8054',
  red: '#934434',
  paving: '#d3d6c2',
  pavingLight: '#e4e2cf',
  glass: '#72a8ac',
  glassLight: '#a5c6bf',
  glassDark: '#385e68',
  glassDeep: '#294c58',
  wood: '#8e7753',
  woodLight: '#b29a68',
  green: '#88a86d',
  greenDark: '#638c63',
  greenLight: '#b0c483',
  yellow: '#c8bf72',
  water: '#80bfc0',
  waterLight: '#b1d5cc',
  roof: '#778e84',
};

function putLabel(group, text, x, y, z, width, color = C.red, options = {}) {
  // Signs are the only textures: geometry, trees, paving and water are all cubes.
  if (typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  ctx.font = `500 ${options.fontSize || 82}px "Campus Serif", "Noto Serif SC", "SimSun", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 512, 70);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 8), material);
  sign.position.set(x, y, z);
  group.add(sign);
}

function pavedCourt(b, width = 32, depth = 22) {
  b.box(0, 0.12, 0, width, 0.24, depth, C.paving);
  const step = 2;
  for (let x = -width / 2 + 1; x < width / 2; x += step) {
    for (let z = -depth / 2 + 1; z < depth / 2; z += step) {
      const alternate = Math.round(x + z) % 4 === 0;
      b.box(x, 0.253, z, 1.94, 0.06, 1.94, alternate ? C.pavingLight : C.paving);
    }
  }
}

function planter(b, x, z, width, depth, tone = C.green) {
  b.box(x, 0.38, z, width, 0.55, depth, C.stoneLight);
  b.box(x, 0.71, z, width - 0.25, 0.23, depth - 0.25, tone);
  for (let px = x - width / 2 + 0.45; px <= x + width / 2 - 0.4; px += 0.8) {
    b.box(px, 1, z, 0.7, 0.55, Math.max(0.6, depth - 0.6), C.greenLight);
  }
}

function tree(b, x, z, rng, size = 1, autumn = false) {
  const trunk = 4.1 * size;
  b.box(x, trunk / 2 + 0.2, z, 0.55 * size, trunk, 0.55 * size, C.wood);
  b.box(x - 0.65 * size, trunk * 0.8, z, 1.3 * size, 0.3 * size, 0.3 * size, C.wood);
  b.box(x + 0.6 * size, trunk * 0.9, z + 0.15 * size, 1.4 * size, 0.35 * size, 0.35 * size, C.woodLight);
  const palette = autumn ? [C.yellow, '#d4ca82', '#b4b273', '#dfd18f'] : [C.green, C.greenLight, C.greenDark, '#9ab679'];
  const cube = 0.88 * size;
  for (let ix = -2; ix <= 2; ix++) {
    for (let iz = -2; iz <= 2; iz++) {
      for (let iy = -1; iy <= 2; iy++) {
        const radius = ix * ix + iz * iz + (iy - 0.1) ** 2 * 1.1;
        if (radius > 6.7 || (radius > 4.5 && rng() > 0.65)) continue;
        b.box(x + ix * cube, trunk + iy * cube, z + iz * cube, cube + 0.04, cube + 0.04, cube + 0.04, palette[Math.floor(rng() * palette.length)]);
      }
    }
  }
}

function bench(b, x, z, width = 3.3) {
  for (const dx of [-width * 0.33, width * 0.33]) {
    b.box(x + dx, 0.65, z, 0.25, 1, 0.7, C.bronze);
    b.box(x + dx, 1.3, z - 0.35, 0.2, 1.2, 0.2, C.bronze);
  }
  for (let dz = -0.35; dz <= 0.4; dz += 0.25) b.box(x, 1.08, z + dz, width, 0.17, 0.17, C.woodLight);
  for (const y of [1.55, 1.87]) b.box(x, y, z - 0.39, width, 0.2, 0.17, C.wood);
}

function lamp(b, x, z, height = 4.7) {
  b.box(x, 0.38, z, 0.65, 0.6, 0.65, C.stoneDark);
  b.box(x, height / 2, z, 0.18, height, 0.18, C.bronze);
  b.box(x, height + 0.18, z, 0.7, 0.25, 0.7, C.bronze);
  b.box(x, height - 0.18, z, 0.44, 0.55, 0.44, '#e6d6a2');
  b.box(x, height - 0.56, z, 0.7, 0.18, 0.7, C.bronze);
}

function stairs(b, x, front, width, count = 5, rise = 0.16, run = 0.52) {
  for (let i = 0; i < count; i++) {
    const height = (count - i) * rise;
    b.box(x, height / 2 + 0.27, front + i * run, width + i * 0.2, height, run + 0.04, i % 2 ? C.stoneLight : C.white);
  }
}

function windows(b, x1, x2, y1, y2, z, columns, rows, rng, paneWidth = 0.9) {
  for (let ix = 0; ix < columns; ix++) {
    const x = x1 + ((x2 - x1) * ix) / Math.max(1, columns - 1);
    for (let iy = 0; iy < rows; iy++) {
      const y = y1 + ((y2 - y1) * iy) / Math.max(1, rows - 1);
      b.box(x, y, z, paneWidth + 0.2, 1.72, 0.21, C.stoneDark);
      b.box(x, y, z + 0.13, paneWidth, 1.5, 0.14, rng() > 0.82 ? C.glassLight : C.glass);
      b.box(x, y, z + 0.23, 0.065, 1.55, 0.07, C.white);
      b.box(x, y - 0.34, z + 0.23, paneWidth, 0.07, 0.07, C.stoneLight);
    }
  }
}

function library(group, b, rng) {
  pavedCourt(b, 34, 24);
  // Twin masonry wings and a recessed curtain wall are the library's key forms.
  const wingWidth = 9.6;
  for (const side of [-1, 1]) {
    const x = side * 11.9;
    b.box(x, 8.4, -2.3, wingWidth, 15.8, 15.1, C.stoneLight);
    b.box(x, 16.65, -2.3, wingWidth + 0.4, 0.65, 15.5, C.white);
    b.box(x, 17.2, -3.4, wingWidth - 0.7, 0.55, 12.8, C.stone);
    for (const y of [2.1, 5, 7.9, 10.8, 13.7]) b.box(x, y, 5.35, wingWidth + 0.14, 0.19, 0.3, C.white);
    windows(b, x - 3.25, x + 3.25, 3.5, 14.9, 5.31, 5, 5, rng, 0.84);
    // Side glazing remains legible when islands are viewed in three-quarter view.
    for (let z = -8; z <= 3; z += 2.2) {
      for (let y = 3.3; y < 15.2; y += 2.85) {
        b.box(side * 16.74, y, z, 0.16, 1.65, 1.1, C.glassDark);
        b.box(side * 16.85, y, z, 0.1, 1.42, 0.91, rng() > 0.6 ? C.glassLight : C.glass);
      }
    }
  }
  b.box(0, 8.65, -3.8, 14.4, 16.3, 12, C.glassDeep);
  b.box(0, 17.35, -1.75, 34.3, 1.05, 16.8, C.stoneLight);
  b.box(0, 18.02, -1.75, 34.7, 0.31, 17.1, C.white);
  b.box(0, 18.35, -5.8, 24.9, 0.37, 7.8, C.stoneDark);
  // A generous glass grid across the full-height central hall.
  for (let ix = -6; ix <= 6; ix++) {
    for (let row = 0; row < 7; row++) {
      b.box(ix * 1.02, 2.8 + row * 2.0, 3.36, 0.95, 1.9, 0.2, (ix + row) % 4 === 0 ? C.glassLight : C.glass);
    }
    b.box(ix * 1.02 + 0.51, 9.03, 3.52, 0.085, 14.7, 0.14, C.white);
  }
  for (let row = 0; row <= 7; row++) b.box(0, 1.77 + row * 2, 3.55, 13.4, 0.08, 0.17, C.stoneLight);
  b.box(0, 1.72, 4.1, 8.2, 0.17, 1.9, C.stone);
  b.box(0, 4.9, 4.52, 12.2, 0.2, 3.15, C.stoneDark);
  b.box(0, 5.05, 4.52, 12.8, 0.12, 3.4, C.white);
  for (const x of [-4.9, -1.6, 1.6, 4.9]) {
    b.box(x, 3.08, 5, 0.14, 3.4, 0.15, C.stoneDark);
    b.box(x, 3.0, 5.1, 0.06, 1.2, 0.07, C.bronze);
  }
  stairs(b, 0, 5.15, 12.8, 6, 0.17, 0.53);
  for (const x of [-11.5, 11.5]) {
    planter(b, x, 8.75, 6.2, 2.4, C.green);
    tree(b, x, 9, rng, 0.84, true);
  }
  for (const x of [-14.7, 14.7]) lamp(b, x, 5.9);
  putLabel(group, '徐特立图书馆', 0, 13.5, 3.76, 9.5, C.red);
  group.userData.dimensions = { width: 35, depth: 25, height: 18.6 };
}

function gate(group, b, rng) {
  pavedCourt(b, 34, 24);
  // Liangxiang has modern pale stone gate piers, not the old-campus brick arch.
  b.box(0, 0.3, 0, 12.1, 0.14, 23, '#abb9af');
  for (const x of [-3.8, 0, 3.8]) {
    for (let z = -10; z <= 10; z += 4) b.box(x, 0.4, z, 0.13, 0.06, 1.5, C.white);
  }
  for (const side of [-1, 1]) {
    const x = side * 11.2;
    b.box(x, 0.68, -1.9, 9.8, 0.9, 4.8, C.stoneDark);
    b.box(x, 3.35, -2.0, 9.15, 5.0, 3.7, C.stone);
    b.box(x, 6, -2.0, 9.6, 0.45, 4.2, C.white);
    b.box(x, 6.36, -2.25, 9.2, 0.28, 3.8, C.stoneLight);
    for (const y of [1.35, 2.45, 3.55, 4.65]) b.box(x, y, -0.13, 9.05, 0.055, 0.05, C.stoneDark);
    for (const dx of [-2.8, 0, 2.8]) b.box(x + dx, 3.42, -0.11, 0.05, 4.77, 0.06, C.paving);
    b.box(side * 7.55, 3.7, -1.9, 0.65, 5.7, 4.12, C.white);
    planter(b, side * 12, 5.6, 7.9, 2.6);
    tree(b, side * 13.3, 7.6, rng, 0.92, true);
    tree(b, side * 13.3, -8.1, rng, 0.87, false);
    lamp(b, side * 7.6, 6.75, 5.35);
  }
  // A small modern sentry pavilion and a lifted barrier supply human scale.
  b.box(6.4, 1.75, -5.7, 2.3, 2.9, 2.5, C.stoneLight);
  b.box(6.4, 2.1, -4.4, 1.8, 1.2, 0.16, C.glass);
  b.box(6.4, 3.35, -5.7, 2.8, 0.3, 3.0, C.white);
  b.box(5.5, 1.1, -0.4, 0.45, 1.6, 0.45, C.bronze);
  b.box(4.6, 1.95, -0.4, 2.5, 0.16, 0.16, C.white);
  for (let z = 3; z < 8.5; z += 1) {
    b.box(-5.1, 0.47, z, 0.12, 0.1, 0.45, C.gold);
    b.box(5.1, 0.47, z, 0.12, 0.1, 0.45, C.gold);
  }
  putLabel(group, '北京理工大学', -11.4, 3.65, -0.045, 7.8, C.bronze);
  putLabel(group, '良乡校区', 11.2, 3.65, -0.045, 6.2, C.bronze);
  group.userData.dimensions = { width: 34, depth: 24, height: 7 };
}

function willow(b, x, z, rng, size = 1) {
  b.box(x, 2.55 * size, z, 0.55 * size, 4.9 * size, 0.55 * size, C.wood);
  for (let ix = -3; ix <= 3; ix++) {
    for (let iz = -3; iz <= 3; iz++) {
      const r = ix * ix + iz * iz;
      if (r > 11) continue;
      const y = 5.1 - r * 0.055;
      const color = rng() > 0.5 ? C.greenLight : C.green;
      b.box(x + ix * 0.7 * size, y * size, z + iz * 0.7 * size, 0.76 * size, 0.74 * size, 0.76 * size, color);
      if (r > 5 && rng() > 0.2) {
        const length = 1.4 + rng() * 1.7;
        b.box(x + ix * 0.7 * size, (y - length / 2) * size, z + iz * 0.7 * size, 0.36 * size, length * size, 0.36 * size, color);
      }
    }
  }
}

function lake(group, b, rng) {
  // The lakeshore is deliberately fragmented into little cubic terraces.
  b.box(0, 0.12, 0, 34, 0.24, 24, C.green);
  for (let x = -15; x <= 15; x += 2) {
    for (let z = -9; z <= 9; z += 2) {
      const nx = x / 14.4;
      const nz = (z + 0.5) / 9.2;
      if (nx * nx + nz * nz < 1) {
        b.box(x, 0.28, z, 2, 0.15, 2, C.water);
        if (rng() > 0.83) b.box(x + 0.3, 0.37, z, 1.6, 0.035, 0.17, C.waterLight);
      } else {
        b.box(x, 0.4 + rng() * 0.08, z, 1.9, 0.4, 1.9, rng() > 0.5 ? C.greenLight : C.green);
        if (rng() > 0.75) b.box(x, 0.82, z, 1.1, 0.5, 1, C.stoneLight);
      }
    }
  }
  // Stepping shoreline, low boardwalk, and a simplified waterside pavilion.
  for (let x = -15; x <= 14; x += 1.2) {
    b.box(x, 0.64, 8.7, 1.15, 0.3, 1.5, C.pavingLight);
  }
  b.box(-7.2, 0.7, -3.9, 8.5, 0.42, 7.2, C.woodLight);
  for (let x = -11; x <= -3; x += 0.55) b.box(x, 0.96, -3.9, 0.48, 0.11, 7.15, C.wood);
  for (const x of [-9.75, -4.65]) {
    for (const z of [-6.5, -1.4]) {
      b.box(x, 2.8, z, 0.38, 4, 0.38, C.red);
      b.box(x, 0.92, z, 0.65, 0.45, 0.65, C.stoneLight);
      b.box(x, 4.85, z, 0.68, 0.32, 0.68, C.red);
    }
  }
  b.box(-7.2, 4.73, -3.95, 6.5, 0.36, 6.5, C.wood);
  // Stepped tiles suggest a hipped roof without curved or smooth primitives.
  for (let tier = 0; tier < 6; tier++) {
    const side = 8.3 - tier * 1.05;
    b.box(-7.2, 5.1 + tier * 0.31, -3.95, side, 0.34, side, tier % 2 ? '#84968c' : C.roof);
  }
  b.box(-7.2, 7.05, -3.95, 1.25, 0.38, 1.25, C.stoneLight);
  for (let x = -10; x <= -4.2; x += 0.85) b.box(x, 5.0, -8.1, 0.25, 0.45, 0.4, C.roof);
  for (const z of [-6.4, -1.5]) bench(b, -7.2, z, 3.3);
  willow(b, 12.2, -5, rng, 1.2);
  willow(b, -13, 3.8, rng, 0.94);
  tree(b, 10.4, 8.8, rng, 0.83, true);
  bench(b, 4.7, 10.1, 3.7);
  lamp(b, -11.2, 9.6, 4.3);
  for (let i = 0; i < 26; i++) {
    const x = 10.5 + rng() * 3.4;
    const z = 2.7 + rng() * 3.3;
    b.box(x, 0.65, z, 0.1, 0.8 + rng() * 0.9, 0.1, rng() > 0.4 ? C.greenDark : C.yellow);
  }
  // Three tiny lily leaves, and their voxel flowers.
  for (const [x, z] of [[3.7, 2.1], [7.6, 0.7], [4.9, -1.5]]) {
    b.box(x, 0.4, z, 0.8, 0.07, 0.8, C.greenDark);
    b.box(x + 0.12, 0.58, z, 0.32, 0.25, 0.32, '#e8c6b6');
  }
  putLabel(group, '初心亭', -7.2, 4.38, -1.15, 2.3, C.gold, { weight: 700 });
  group.userData.dimensions = { width: 34, depth: 24, height: 7.6 };
}

function museum(group, b, rng) {
  pavedCourt(b, 34, 24);
  // White marble colonnades, recessed vertical glazing and a long, low roofline.
  b.box(0, 6.25, -2.2, 32.5, 11.9, 13.4, C.stoneLight);
  b.box(0, 12.5, -2.2, 33.1, 0.7, 13.9, C.white);
  b.box(0, 13.0, -2.45, 33.45, 0.3, 13.9, C.stoneLight);
  b.box(0, 13.32, -4.7, 28.8, 0.35, 8.9, C.stone);
  b.box(0, 6.3, 4.65, 27.3, 9.7, 0.3, C.glassDeep);
  for (let ix = -17; ix <= 17; ix++) {
    b.box(ix * 0.77, 6.22, 4.91, 0.48, 9.45, 0.13, ix % 3 ? C.glass : C.glassDark);
    b.box(ix * 0.77 + 0.3, 6.22, 5.02, 0.12, 9.5, 0.13, C.stone);
  }
  b.box(0, 10.98, 5.3, 28.3, 0.65, 1.7, C.stoneDark);
  b.box(0, 11.52, 5.3, 28.9, 0.45, 2.05, C.white);
  b.box(0, 12.03, 5.3, 29.5, 0.37, 2.3, C.stoneLight);
  for (let i = 0; i < 11; i++) {
    const x = -13.7 + i * 2.74;
    b.box(x, 5.9, 6.2, 0.74, 9.9, 0.85, C.white);
    b.box(x, 0.93, 6.2, 1.13, 0.51, 1.2, C.stoneLight);
    b.box(x, 10.84, 6.2, 1.15, 0.36, 1.3, C.white);
    b.box(x, 10.51, 6.2, 0.96, 0.25, 1.1, C.stoneLight);
  }
  for (const side of [-1, 1]) {
    b.box(side * 15.7, 6.5, 5.6, 1.25, 11.6, 2.2, C.white);
    for (const z of [-7.4, -4.7, -2, 0.7, 3.4]) {
      b.box(side * 16.31, 6.4, z, 0.13, 8.4, 1.55, C.glass);
      b.box(side * 16.42, 6.4, z, 0.15, 8.6, 0.12, C.stoneLight);
    }
  }
  b.box(0, 2.45, 5.15, 5.1, 3.5, 0.4, C.glassLight);
  b.box(0, 2.45, 5.43, 0.16, 3.6, 0.11, C.bronze);
  stairs(b, 0, 6.7, 29.3, 5, 0.16, 0.6);
  for (const x of [-13.6, 13.6]) {
    planter(b, x, 10.2, 4.8, 1.7);
    tree(b, x, 9.9, rng, 0.76, true);
  }
  lamp(b, -15.9, 8.0, 4.7);
  lamp(b, 15.9, 8.0, 4.7);
  // Fine stone joints on the solid end bays echo the source's pale masonry.
  for (let y = 2.5; y < 11.7; y += 0.65) {
    for (const x of [-15.55, 15.55]) b.box(x, y, 6.75, 1.28, 0.035, 0.04, '#d3d4c4');
  }
  putLabel(group, '文 博 中 心', 0, 12.35, 6.55, 6.6, C.bronze);
  group.userData.dimensions = { width: 34, depth: 24, height: 13.5 };
}

export function createLandmark(kind, { seed = 1 } = {}) {
  const group = new THREE.Group();
  const b = new VoxelBuilder();
  const rng = mulberry32(seed);
  const build = { library, gate: photoGate, round: roundHall, wing: wingHall, heritage: heritageHall, motto: mottoGarden, lake, main: museum }[kind] || library;
  build(group, b, rng);
  const voxels = b.build();
  voxels.name = `${kind}-voxels`;
  voxels.castShadow = true;
  voxels.receiveShadow = true;
  group.add(voxels);
  group.name = `landmark-${kind}`;
  group.userData.landmark = LANDMARKS.find((item) => item.id === kind) || LANDMARKS[0];
  return group;
}
