import { plaza, tree, planter, voxelText, emblem } from './photo-helpers.js';

/** Twin stone piers and the folded chevrons from supplied photograph 05. */
export function photoGate(group, b, rng) {
  plaza(b);
  b.box(0, 0.30, 0, 13.0, 0.12, 23.2, '#aebbb1');
  for (const side of [-1, 1]) {
    const x = side * 10.7;
    b.box(x, 0.55, -0.4, 5.2, 0.55, 3.4, '#a9ae9d');
    b.box(x, 6.35, -0.6, 4.55, 11.2, 2.6, '#dbd4bc');
    b.box(x, 12.08, -0.6, 4.68, 0.25, 2.72, '#ede6d3');
    b.box(x - side * 2.02, 6.3, -0.5, 0.30, 10.8, 2.8, '#eee6d0');
    for (let row = 0; row < 20; row++) {
      for (let col = 0; col < 7; col++) {
        const xx = x + (col - 3) * 0.61;
        const yy = 1.0 + row * 0.55;
        b.box(xx, yy, 0.735, 0.592, 0.53, 0.08, (row + col) % 4 === 0 ? '#d3cdb7' : '#e1d9c1');
      }
    }
    // A pixel-stepped inset follows the large outward-pointing folded joint.
    for (let step = 0; step <= 15; step++) {
      const t = step / 15;
      const xx = x + side * (-0.75 + t * 1.9);
      for (const upper of [-1, 1]) {
        const yy = 7.15 + upper * (1 - t) * 2.15;
        b.box(xx, yy, 0.83, 0.30, 0.40, 0.10, '#858d82');
        b.box(xx - side * 0.14, yy + upper * 0.16, 0.91, 0.23, 0.30, 0.12, '#f4efdd');
      }
    }
    // Horizontal side wings and the light entry fencing are kept low.
    b.box(side * 15.1, 2.45, -4.8, 3.5, 4.1, 4.0, '#dad6c0');
    b.box(side * 15.1, 4.58, -4.8, 3.7, 0.22, 4.2, '#f1ecda');
    for (let k = 0; k < 13; k++) b.box(side * (6.9 + k * 0.60), 1.1, -6.8, 0.09, 1.7, 0.10, '#e7e9df');
    b.box(side * 10.5, 1.88, -6.8, 7.5, 0.08, 0.12, '#e8ebde');
    planter(b, side * 11.5, 6.9, 5.5, 2.1);
    tree(b, side * 13.7, 9.0, rng, 0.68, true);
    for (let z = -10; z <= 9; z += 3.5) {
      b.box(side * 6.2, 0.69, z, 0.10, 0.8, 0.11, '#ecebdc');
      b.box(side * 6.2, 1.1, z + 1.55, 0.10, 0.10, 3.2, '#e4e7dd');
    }
  }
  emblem(b, -10.2, 9.5, 1.0, 1.25);
  voxelText(b, '北京理工大学', -12.15, 6.0, 1.03, { height: 6.0, cell: 0.065, color: '#766544', depth: 0.12, vertical: true });
  b.box(4.9, 1.6, -3.5, 2.4, 2.5, 2.8, '#d8dacb');
  b.box(4.9, 2.0, -2.03, 1.7, 0.95, 0.14, '#487984');
  b.box(4.9, 3.0, -3.5, 2.8, 0.24, 3.1, '#f2eddb');
  for (const x of [-3.5, 0, 3.5]) {
    for (let z = -10; z <= 10; z += 4) b.box(x, 0.40, z, 0.12, 0.035, 1.5, '#eee9d6');
  }
  group.userData.dimensions = { width: 34, depth: 24, height: 12.3 };
}
