import { putLabel, plaza, tree, planter, voxelText } from './photo-helpers.js';

const STONE = '#c7cbc6';
const LIGHT = '#eceee3';
const SHADOW = '#9faeaa';
const GLASS = '#587982';
const DARK_GLASS = '#304e59';
const GOLD = '#cbb16e';

function windowPane(b, x, y, z, width = 0.85, height = 1.36, color = GLASS) {
  b.box(x, y, z, width + 0.18, height + 0.18, 0.18, '#a5b3ac');
  b.box(x, y, z + 0.11, width, height, 0.14, color);
  b.box(x, y, z + 0.205, 0.065, height, 0.055, LIGHT);
  b.box(x, y - height * 0.1, z + 0.21, width, 0.06, 0.06, LIGHT);
}

function atticArch(b, x, y, z) {
  // The light stepped surround follows a rounded opening rather than a square pane.
  const cell = 0.20;
  const radius = 0.56;
  for (let ix = -3; ix <= 3; ix++) {
    for (let iy = 0; iy < 9; iy++) {
      const dx = ix * cell;
      const py = iy * cell;
      const curveY = py - 1.10;
      const inside = Math.abs(dx) <= radius && (py <= 1.10 || dx * dx + curveY * curveY <= radius * radius);
      const outer = Math.abs(dx) <= radius + 0.19 && (py <= 1.10 || dx * dx + curveY * curveY <= (radius + 0.19) ** 2);
      if (!outer) continue;
      b.box(x + dx, y + py, z, 0.192, 0.192, inside ? 0.19 : 0.28, inside ? DARK_GLASS : LIGHT);
    }
  }
  b.box(x, y + 0.70, z + 0.16, 0.065, 1.42, 0.06, LIGHT);
  b.box(x, y + 0.66, z + 0.16, 1.03, 0.06, 0.06, LIGHT);
  b.box(x, y - 0.12, z, 1.42, 0.16, 0.45, LIGHT);
}

function schoolEmblem(b, x, y, z) {
  // A small stepped campus motif, deliberately not a claim of an exact seal copy.
  for (let layer = 0; layer < 5; layer++) {
    const width = 2.25 - layer * 0.32;
    b.box(x, y + layer * 0.25, z, width, 0.18, 0.12, GOLD);
    b.box(x, y + layer * 0.25 - 0.07, z + 0.01, width - 0.22, 0.10, 0.13, GOLD);
  }
  b.box(x, y + 0.40, z + 0.03, 0.18, 1.72, 0.15, GOLD);
  for (let i = 0; i < 4; i++) b.box(x + i * 0.17, y + 1.35 + i * 0.10, z, 0.22, 0.12, 0.12, GOLD);
}

export function heritageHall(group, b, rng) {
  plaza(b, 34, 24);
  // Symmetrical low wings flank the tall centre seen in the first reference.
  b.box(0, 6.20, -2.55, 11.90, 11.60, 11.90, STONE);
  for (const side of [-1, 1]) {
    const x = side * 11.15;
    b.box(x, 4.15, -3.95, 10.45, 7.50, 10.85, '#cdd0c9');
    b.box(x, 8.05, -3.95, 10.85, 0.32, 11.25, LIGHT);
    b.box(x, 8.34, -4.10, 10.55, 0.24, 10.95, '#b9c4bd');
    for (let column = 0; column < 7; column++) {
      const px = x - 4.10 + column * 1.36;
      for (const y of [1.75, 4.10, 6.45]) windowPane(b, px, y, 1.58, 0.78, 1.28, rng() > 0.6 ? GLASS : '#6f898a');
      if (column % 2 === 0) b.box(px + 0.59, 4.20, 1.84, 0.24, 6.9, 0.36, LIGHT);
    }
    for (const y of [2.75, 5.12, 7.56]) b.box(x, y, 1.78, 10.48, 0.13, 0.30, LIGHT);
    // Side windows keep the wings readable from the moving camera.
    for (let z = -8; z <= 0; z += 2.0) {
      for (const y of [2.0, 4.3, 6.5]) b.box(side * 16.42, y, z, 0.14, 1.22, 0.82, GLASS);
    }
  }
  for (const x of [-4.55, -2.73, -0.91, 0.91, 2.73, 4.55]) {
    for (const y of [3.20, 5.58, 7.96, 10.34]) windowPane(b, x, y, 3.45, 0.78, 1.30, rng() > 0.78 ? '#7d9897' : GLASS);
  }
  for (const x of [-5.62, -3.62, -1.81, 0, 1.81, 3.62, 5.62]) {
    b.box(x, 6.66, 3.72, Math.abs(x) > 5 ? 0.50 : 0.26, 10.25, 0.50, LIGHT);
    b.box(x, 1.35, 3.75, 0.67, 0.65, 0.68, LIGHT);
    b.box(x, 11.82, 3.75, 0.64, 0.23, 0.68, LIGHT);
  }
  for (const y of [2.24, 4.64, 7.02, 9.40, 11.88]) b.box(0, y, 3.60, 12.0, 0.17, 0.34, '#dfe4da');
  for (const x of [-3.45, 0, 3.45]) {
    b.box(x, 1.45, 3.80, 2.20, 2.13, 0.32, DARK_GLASS);
    b.box(x, 2.68, 3.87, 2.54, 0.25, 0.67, LIGHT);
    b.box(x, 1.40, 4.0, 0.08, 1.90, 0.08, GOLD);
  }
  for (let step = 0; step < 4; step++) b.box(0, 0.28 + (4 - step) * 0.11, 4.15 + step * 0.46, 12.3 + step * 0.12, (4 - step) * 0.22, 0.48, step % 2 ? LIGHT : '#c4ccc1');
  b.box(0, 13.50, -2.55, 11.90, 3.0, 11.90, '#bac3bf');
  for (const x of [-4.25, -2.55, -0.85, 0.85, 2.55, 4.25]) atticArch(b, x, 12.18, 3.60);
  b.box(0, 12.05, 3.65, 12.15, 0.30, 0.46, LIGHT);
  b.box(0, 14.89, -2.55, 12.30, 0.19, 12.20, '#d7ddd4');
  b.box(0, 15.17, -2.55, 12.68, 0.28, 12.55, '#abb9b1');
  b.box(0, 15.43, -2.55, 13.0, 0.20, 12.80, LIGHT);
  for (const x of [-4.30, -2.15, 0, 2.15, 4.30]) b.box(x, 16.64, -2.25, 0.055, 2.2, 0.055, '#8c9690');
  // The low burgundy plaque is intentionally prominent, as in the photograph.
  b.box(0, 0.32, 9.0, 29.4, 0.22, 1.55, '#858c7a');
  b.box(0, 1.62, 9.0, 29.0, 2.52, 1.13, '#633c45');
  b.box(0, 2.92, 9.0, 29.2, 0.13, 1.25, '#74515a');
  for (let x = -13.5; x < 14; x += 1.50) b.box(x, 1.62, 9.575, 1.44, 2.43, 0.045, rng() > 0.5 ? '#65414b' : '#70454e');
  schoolEmblem(b, -12.05, 0.98, 9.65);
  putLabel(group, '北京理工大学', 2.0, 1.96, 9.67, 23.0, '#d5ba77', { fontSize: 100 });
  putLabel(group, 'BEIJING INSTITUTE OF TECHNOLOGY', 1.8, 0.79, 9.68, 23.5, '#c5ad75', { fontSize: 26 });
  for (const x of [-14.7, 14.7]) {
    planter(b, x, 5.2, 3.0, 3.0, '#708d64');
    tree(b, x, 5.2, rng, 0.78, x < 0);
    b.box(x, 1.0, 5.2, 0.38, 1.35, 0.38, '#e7e9d9');
  }
  group.userData.dimensions = { width: 34, depth: 24, height: 17.75 };
}

function gardenBench(b, x, z) {
  for (const dx of [-1.18, 1.18]) b.box(x + dx, 0.70, z, 0.23, 0.85, 0.66, '#65776c');
  for (const dz of [-0.27, 0, 0.27]) b.box(x, 1.12, z + dz, 3.4, 0.17, 0.18, '#a08a65');
  b.box(x, 1.68, z - 0.38, 3.4, 0.18, 0.16, '#8c7654');
  b.box(x, 1.42, z - 0.38, 3.4, 0.18, 0.16, '#a28e69');
}

export function mottoGarden(group, b, rng) {
  plaza(b, 34, 24);
  b.box(0, 0.30, -4.9, 33.6, 0.12, 13.5, '#7a9b70');
  b.box(-3.2, 0.47, 3.5, 25.0, 0.28, 3.7, '#aeb8aa');
  // Granular stone faces, chipped corners and a stepped crown are geometry.
  const rockX = -3.0;
  const colors = ['#b8beb5', '#c6cbc1', '#c0c5bc', '#b2b9b1', '#c8ccc3', '#b6bcb4'];
  b.box(rockX, 2.93, 3.5, 23.8, 4.88, 2.65, '#b9beb3');
  for (let ix = 0; ix < 40; ix++) {
    const x = rockX - 11.70 + ix * 0.60;
    const edge = Math.abs((ix - 19.5) / 19.5);
    const top = 5.20 + rng() * 0.39 - Math.max(0, edge - 0.88) * 1.7;
    b.box(x, top + 0.05, 3.45, 0.61, 0.35 + rng() * 0.27, 2.5 + rng() * 0.20, colors[Math.floor(rng() * colors.length)]);
    for (let iy = 0; iy < 8; iy++) {
      if ((ix === 0 || ix === 39) && (iy === 0 || iy === 7)) continue;
      const y = 0.85 + iy * 0.58;
      b.box(x + (rng() - 0.5) * 0.03, y, 4.91 + rng() * 0.04, 0.62 + rng() * 0.03, 0.59 + rng() * 0.03, 0.10 + rng() * 0.04, colors[Math.floor(rng() * colors.length)]);
      if (rng() > 0.66) b.box(x + 0.12, y - 0.13, 5.05, 0.16, 0.12, 0.08, '#8d9990');
    }
  }
  putLabel(group, '德以明理  学以精工', rockX, 3.83, 5.18, 21.4, '#28322e', { fontSize: 128 });
  // A separate red, cut-out vertical sculpture accompanies the stone.
  b.box(12.4, 0.49, 3.75, 4.7, 0.35, 2.2, '#a73045');
  b.box(10.94, 3.71, 3.68, 1.30, 6.10, 0.60, '#9c2845');
  voxelText(b, '北理工', 13.04, 3.72, 4.18, { height: 6.10, cell: 0.14, color: '#b9314a', depth: 0.70, vertical: true, font: 'serif' });
  voxelText(b, '延安根军工魂领军人', 10.95, 3.88, 4.03, { height: 4.80, cell: 0.04, color: '#eadcc5', depth: 0.07, vertical: true, font: 'serif' });
  for (const [x, z, size] of [[-13.2, -7.4, 1.07], [-7.0, -8.0, 1.03], [-0.9, -7.7, 1.10], [5.3, -8.0, 1.06], [12.0, -7.2, 1.00]]) {
    tree(b, x, z, rng, size, false);
    b.box(x, 1.00, z, 0.42, 1.40, 0.42, '#e3e7d9');
  }
  for (const [x, z] of [[-13.6, -1.3], [9.0, -1.5]]) planter(b, x, z, 3.8, 2.5, '#67865f');
  for (const x of [-11.2, 10.7]) gardenBench(b, x, 9.1);
  for (const x of [-12.3, -6.1, 0.7, 7.0]) {
    b.box(x, 0.60, 6.20, 0.66, 0.44, 0.48, '#3b4943');
    b.box(x, 0.85, 6.14, 0.57, 0.13, 0.34, '#b4bbaa');
  }
  group.userData.dimensions = { width: 34, depth: 24, height: 7.0 };
}
