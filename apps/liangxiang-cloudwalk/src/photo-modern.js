import { plaza, tree, planter, putLabel, voxelText } from './photo-helpers.js';

// Silhouettes from the user's second and third photographs. Architectural names
// are intentionally left to the catalogue; these are visual reconstructions.
const C = {
  ivory: '#e6dfcc', pale: '#f0eadd', light: '#f7f3e7', shade: '#c9c4b7',
  joint: '#b5b8ad', glass: '#456c75', glassLight: '#75969a', glassDark: '#294a55',
  steel: '#a5b2b0', underside: '#354953', undersideLight: '#52626a',
  grass: '#7f9b6a', green: '#145c4d', gold: '#b9a875', red: '#bb2636',
};

function seal(b, cx, cy, z, radius = 0.68) {
  const step = radius / 5;
  for (let iy = -5; iy <= 5; iy++) {
    for (let ix = -5; ix <= 5; ix++) {
      const r = Math.hypot(ix, iy);
      if (r > 5.15) continue;
      b.box(cx + ix * step, cy + iy * step, z, step, step, 0.12,
        r > 4.15 ? C.gold : C.green);
    }
  }
  // A tiny branching white emblem sits inside the green ring.
  for (const [row, length] of [[-2, 4], [-1, 5], [0, 6], [1, 7]]) {
    b.box(cx, cy + row * step, z + 0.09, length * step, step * 0.65, 0.09, C.light);
  }
  b.box(cx, cy + step * 1.0, z + 0.10, step * 0.65, step * 4.3, 0.10, C.light);
}

const LETTERS = {
  I: ['111', '010', '010', '010', '010', '010', '111'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
};

function pixelLetter(b, letter, x, y, z, cell = 0.38) {
  const pixels = LETTERS[letter];
  const columns = pixels[0].length;
  for (let row = 0; row < pixels.length; row++) {
    for (let col = 0; col < columns; col++) {
      if (pixels[row][col] !== '1') continue;
      b.box(x + (col - (columns - 1) / 2) * cell, y + (3 - row) * cell,
        z, cell + 0.015, cell + 0.015, 0.48, C.light);
    }
  }
}

function openHeart(b, x, y, z) {
  const inside = (px, py) => (px * px + py * py - 1) ** 3 - px * px * py ** 3 <= 0;
  const cell = 0.20;
  for (let iy = -8; iy <= 8; iy++) {
    for (let ix = -9; ix <= 9; ix++) {
      const px = ix / 7.4;
      const py = iy / 7.4;
      if (!inside(px, py) || inside(px / 0.57, (py - 0.06) / 0.57)) continue;
      b.box(x + ix * cell, y + iy * cell, z, cell + 0.012, cell + 0.012, 0.53, C.red);
    }
  }
  b.box(x, 0.56, z, 3.4, 0.23, 0.76, '#b82736');
}

function loveBIT(b) {
  const z = 9.75;
  b.box(0, 0.37, z, 13.9, 0.30, 1.08, C.shade);
  pixelLetter(b, 'I', -5.90, 1.91, z);
  openHeart(b, -2.25, 1.92, z);
  pixelLetter(b, 'B', 1.52, 1.91, z);
  pixelLetter(b, 'I', 3.72, 1.91, z);
  pixelLetter(b, 'T', 5.75, 1.91, z);
  for (const x of [-6.3, -1.8, 1.4, 5.9]) {
    b.box(x, 0.16, z + 0.26, 0.24, 0.22, 0.24, '#59605b');
  }
}

export function roundHall(group, b, rng) {
  plaza(b, 34, 24);
  // The open quadrangle and low wings are almost as important as the drum.
  b.box(0, 0.32, 6.7, 26.3, 0.17, 8.8, C.grass);
  b.box(0, 0.43, 6.8, 2.6, 0.08, 7.4, '#dcd8c8');
  for (const side of [-1, 1]) {
    b.box(side * 12.30, 2.32, -2.6, 8.7, 4.05, 13.9, C.ivory);
    b.box(side * 12.30, 4.49, -2.6, 8.95, 0.29, 14.1, C.pale);
    b.box(side * 12.0, 1.94, 4.44, 7.3, 2.85, 0.20, C.glassDark);
    for (let i = 0; i < 6; i++) {
      const x = side * 12.3 - 3.65 + i * 1.46;
      b.box(x, 2.03, 4.57, 0.20, 3.35, 0.22, C.pale);
    }
    // Set-back blocks visible above the wing roofs in the photograph.
    b.box(side * 12.75, 5.45, -6.1, 6.5, 1.65, 5.0, C.shade);
    for (const xOffset of [-1.8, 0, 1.8]) {
      b.box(side * 12.75 + xOffset, 5.50, -3.54, 0.48, 1.0, 0.12, C.glassDark);
    }
  }
  // A recessed entrance, with a floating-looking lintel firmly on square piers.
  b.box(0, 2.22, -2.6, 14.3, 3.8, 13.3, C.glassDark);
  b.box(0, 4.28, 4.72, 25.7, 1.30, 2.65, C.ivory);
  b.box(0, 5.0, 4.72, 26.1, 0.15, 2.85, C.pale);
  for (const x of [-10.7, -4.3, 4.3, 10.7]) {
    b.box(x, 1.94, 5.13, 0.66, 3.25, 0.91, C.pale);
    b.box(x, 0.44, 5.13, 0.91, 0.27, 1.10, C.shade);
  }
  b.box(0, 1.8, 4.15, 3.4, 2.8, 0.18, C.glassLight);
  b.box(0, 1.8, 4.3, 0.10, 2.85, 0.10, C.steel);

  // An actual square-voxel ring, not a smooth cylinder. Angular slots follow
  // the round facade so the narrow glazing reads clearly in three-quarter view.
  const radius = 7.45;
  const cell = 0.50;
  const centerZ = -3.0;
  for (let iz = -15; iz <= 15; iz++) {
    for (let ix = -15; ix <= 15; ix++) {
      const x = ix * cell, z = iz * cell;
      const r = Math.hypot(x, z);
      if (r > radius || r < radius - 0.83) continue;
      const angle = Math.atan2(x, z);
      const slot = ((Math.floor((angle + Math.PI) * radius / 0.54) % 3) + 3) % 3;
      for (let iy = 0; iy < 13; iy++) {
        const y = 4.65 + iy * 0.50;
        const glazed = y >= 5.13 && y <= 8.16 && slot === 1;
        const color = glazed ? (iy % 3 ? C.glassDark : C.glass) :
          (iy % 3 === 0 ? C.shade : (ix + iz) % 3 ? C.ivory : C.pale);
        b.box(x, y, z + centerZ, cell + 0.01, 0.48, cell + 0.01, color);
      }
    }
  }
  // Flat voxel discs and a smaller raised rear ring preserve the layered roof.
  for (let iz = -15; iz <= 15; iz++) {
    for (let ix = -15; ix <= 15; ix++) {
      if (Math.hypot(ix * cell, iz * cell) > radius + 0.05) continue;
      b.box(ix * cell, 11.05, iz * cell + centerZ, 0.51, 0.28, 0.51, C.pale);
    }
  }
  for (let iz = -10; iz <= 9; iz++) {
    for (let ix = -11; ix <= 11; ix++) {
      if (Math.hypot(ix * cell, iz * cell) > 5.5) continue;
      b.box(ix * cell, 11.53, iz * cell - 4.2, 0.51, 0.47, 0.51, C.shade);
    }
  }
  b.box(0, 6.90, 4.52, 1.45, 3.35, 0.20, C.glassDark);
  b.box(0, 6.90, 4.66, 0.105, 3.4, 0.10, C.steel);
  b.box(0, 7.04, 4.67, 1.48, 0.12, 0.10, C.steel);
  seal(b, 0, 10.0, 4.66, 0.66);
  loveBIT(b);
  for (const side of [-1, 1]) {
    planter(b, side * 12.7, 8.8, 4.0, 1.6);
    tree(b, side * 14.9, -8.2, rng, 0.64, false);
  }
  group.userData.dimensions = { width: 34, depth: 24, height: 11.8 };
  group.userData.photoFeatures = ['stepped round drum', 'vertical glazing', 'open courtyard', 'voxel I heart BIT'];
}

function aircraft(b, cx, cz, scale, sideways = true) {
  // Display models only: small static airframes stand on the exhibition lawn.
  const q = (x, y, z, w, h, d, color) => {
    const rx = sideways ? z : x;
    const rz = sideways ? -x : z;
    b.box(cx + rx * scale, 0.48 + y * scale, cz + rz * scale,
      (sideways ? d : w) * scale, h * scale, (sideways ? w : d) * scale, color);
  };
  q(0, 0.83, -0.25, 0.80, 0.74, 5.4, '#e5e8dc');
  q(0, 0.86, 2.65, 0.56, 0.56, 0.74, '#f6f3e5');
  q(0, 0.86, 3.19, 0.32, 0.33, 0.43, '#ececdf');
  q(0, 0.86, 3.50, 0.15, 0.16, 0.23, '#ccd7d4');
  q(0, 1.30, 0.92, 0.56, 0.42, 1.24, C.glassDark);
  q(0, 1.47, 0.66, 0.40, 0.19, 0.68, C.glassLight);
  for (let i = 0; i < 8; i++) {
    const z = -1.04 + i * 0.25;
    const span = 3.05 - i * 0.20;
    q(0, 0.85, z, span * 2, 0.16, 0.27, i % 2 ? '#e5e6d7' : '#f3f0e0');
  }
  q(0, 0.89, -2.28, 2.75, 0.16, 0.80, '#d7dfd5');
  q(0, 1.26, -2.12, 0.20, 0.72, 1.10, '#d8e0d7');
  q(0, 1.73, -2.39, 0.18, 0.45, 0.66, '#e7eadd');
  q(0.12, 1.55, -2.35, 0.045, 0.22, 0.30, C.red);
  for (const x of [-0.44, 0.44]) q(x, 0.18, -0.75, 0.28, 0.32, 0.36, '#46555a');
  q(0, 0.20, 2.15, 0.24, 0.35, 0.32, '#46555a');
  q(0, 0.44, 0.20, 0.10, 0.50, 0.13, '#788582');
}

export function wingHall(group, b, rng) {
  plaza(b, 34, 24);
  b.box(0, 0.34, 7.0, 30.0, 0.20, 6.45, '#87a078');
  // The main hall is deliberately set behind its roof's large overhang.
  b.box(-4.7, 5.11, -3.28, 18.0, 9.57, 13.40, '#e5e6dc');
  b.box(-4.7, 8.92, 3.50, 18.2, 2.55, 0.22, C.glassDark);
  for (let x = -13.5; x <= 4.15; x += 0.58) {
    b.box(x, 8.95, 3.65, 0.065, 2.65, 0.10, C.steel);
    b.box(x, 9.14, 3.62, 0.45, 0.052, 0.06, C.glassLight);
  }
  b.box(-4.7, 7.56, 3.67, 18.3, 0.26, 0.24, '#b8c1be');
  // Fine stone panels and the three tall black slits in the supplied facade.
  for (let x = -13.4; x <= 3.9; x += 1.25) {
    b.box(x, 3.98, 3.51, 0.04, 6.36, 0.08, '#c3ccc5');
  }
  for (const x of [-10.15, -5.70, -1.25]) {
    b.box(x, 3.95, 3.63, 0.56, 6.65, 0.17, C.glassDark);
    b.box(x + 0.42, 3.95, 3.67, 0.15, 6.7, 0.15, C.pale);
  }
  for (const y of [2.6, 4.8, 6.9]) b.box(-4.7, y, 3.55, 18.15, 0.045, 0.08, '#c4cbc4');

  // Side glazing and a tall curtain-wall joint between the two roof wings.
  b.box(4.96, 6.26, -1.94, 2.3, 11.8, 10.8, C.glassDark);
  for (let y = 0.85; y < 12.1; y += 1.25) {
    b.box(4.96, y, 3.55, 2.43, 0.11, 0.16, C.steel);
  }
  for (const x of [3.87, 4.96, 6.05]) b.box(x, 6.3, 3.65, 0.11, 11.9, 0.18, C.pale);
  b.box(4.96, 12.33, -1.94, 2.6, 0.28, 11.2, C.light);

  // A roof made of little, height-stepped square cells preserves the dramatic
  // swept wing while keeping every face in the scene's voxel vocabulary.
  const cell = 0.55;
  for (let z = -10.55; z <= 5.42; z += cell) {
    const right = 4.4 + (5.4 - z) * 0.075;
    for (let x = -16.2; x <= right; x += cell) {
      const y = 11.72 + (-x - 1.0) * 0.115 + (z + 2) * 0.024;
      const border = x < -15.8 || x > right - cell || z > 4.92 || z < -10.2;
      const shade = ((Math.round(x / cell) + Math.round(z / cell)) % 4 + 4) % 4;
      b.box(x, y, z, cell + 0.015, 0.35, cell + 0.015, border ? C.light : '#dce2db');
      b.box(x, y - 0.285, z, cell + 0.014, 0.20, cell + 0.014,
        border ? '#a8b6b4' : shade === 0 ? '#607079' : shade === 1 ? '#435961' : '#354b56');
    }
  }
  // A small raised return above the central curtain-wall mast.
  for (let z = -5.8; z <= -1.1; z += 0.55) {
    for (let x = 3.4; x <= 7.1; x += 0.55) {
      b.box(x, 13.12 + (x - 3.4) * 0.14, z, 0.56, 0.33, 0.56, C.light);
      b.box(x, 12.84 + (x - 3.4) * 0.14, z, 0.56, 0.20, 0.56, C.underside);
    }
  }

  b.box(10.5, 3.85, -1.55, 9.35, 6.95, 11.8, '#e5e7de');
  for (let x = 6.2; x < 15.0; x += 1.1) b.box(x, 3.7, 4.42, 0.035, 6.05, 0.08, '#c7cfc7');
  for (let z = -7.85; z <= 5.30; z += 0.60) {
    for (let x = 4.05; x <= 16.35; x += 0.60) {
      const y = 8.09 + (x - 4.05) * 0.025;
      const border = z > 4.7 || x > 15.8;
      b.box(x, y, z, 0.61, 0.31, 0.61, C.light);
      b.box(x, y - 0.265, z, 0.61, 0.20, 0.61,
        border ? C.steel : Math.round((x + z) / 0.6) % 3 ? C.underside : C.undersideLight);
    }
  }
  b.box(7.3, 2.1, 4.46, 2.25, 3.2, 0.20, C.glassDark);

  aircraft(b, -7.6, 7.0, 0.60, true);
  aircraft(b, 2.9, 7.1, 0.56, true);
  aircraft(b, 11.1, 7.0, 0.43, false);
  // Foreground freestanding school letters reproduce the photograph's scale.
  b.box(0, 0.44, 10.65, 28.6, 0.32, 1.13, C.pale);
  seal(b, -11.2, 1.66, 10.68, 1.08);
  voxelText(b, '北京理工大学', 2.1, 1.64, 10.68,
    { height: 1.78, cell: 0.14, color: C.light, depth: 0.35 });
  putLabel(group, 'BEIJING INSTITUTE OF TECHNOLOGY', 1.8, 0.56, 11.24, 21.6, '#708980', { fontSize: 55 });
  for (const side of [-1, 1]) tree(b, side * 15.25, -9.1, rng, 0.52, false);
  group.userData.dimensions = { width: 34, depth: 24, height: 13.95 };
  group.userData.photoFeatures = ['stepped cantilever roofs', 'coffered undersides', 'glass mast', 'static aircraft', 'freestanding school lettering'];
}
