import * as THREE from 'three';

export function putLabel(group, text, x, y, z, width, color = '#934434', options = {}) {
  if (typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.width = 1536; canvas.height = options.vertical ? 1536 : 192;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `500 ${options.fontSize || 112}px "Campus Serif", "Noto Serif SC", serif`;
  if (options.vertical) {
    [...text].forEach((char, index) => ctx.fillText(char, 768, (index + 0.5) * 1536 / text.length));
  } else if (options.fit !== false && [...text].length > 1) {
    const chars = [...text];
    const widths = chars.map((char) => ctx.measureText(char).width);
    const total = widths.reduce((sum, width) => sum + width, 0);
    const spacing = Math.max(0, (1416 - total) / (chars.length - 1));
    let cursor = (1536 - total - spacing * (chars.length - 1)) / 2;
    ctx.textAlign = 'left';
    chars.forEach((char, index) => { ctx.fillText(char, cursor, 102); cursor += widths[index] + spacing; });
  } else ctx.fillText(text, 768, 102);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, options.vertical ? width : width / 8), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

export function plaza(b, width = 34, depth = 24) {
  b.box(0, 0.10, 0, width, 0.20, depth, '#c8cfbf');
  for (let x = -width / 2 + 0.85; x < width / 2; x += 1.7) {
    for (let z = -depth / 2 + 0.85; z < depth / 2; z += 1.7) {
      b.box(x, 0.235, z, 1.65, 0.07, 1.65, Math.round(x + z) % 3 === 0 ? '#e6e0cf' : '#d2d2bf');
    }
  }
}

export function planter(b, x, z, width, depth, color = '#7c9d72') {
  b.box(x, 0.45, z, width, 0.6, depth, '#e1ddc9');
  b.box(x, 0.79, z, width - 0.22, 0.18, depth - 0.22, color);
  for (let px = x - width / 2 + 0.5; px < x + width / 2; px += 0.9) {
    b.box(px, 1.0, z, 0.78, 0.45, Math.max(0.4, depth - 0.5), '#94ad7a');
  }
}

export function tree(b, x, z, rng, size = 1, autumn = false) {
  b.box(x, 2 * size, z, 0.45 * size, 4 * size, 0.45 * size, '#81765c');
  const colors = autumn ? ['#c4b770', '#dbca86', '#b6b17a'] : ['#527d65', '#74986d', '#8aab79'];
  for (let ix = -2; ix <= 2; ix++) {
    for (let iz = -2; iz <= 2; iz++) {
      for (let iy = -1; iy <= 2; iy++) {
        const r = ix * ix + iz * iz + iy * iy;
        if (r > 6.7 || (r > 4.5 && rng() > 0.70)) continue;
        b.box(x + ix * 0.76 * size, (4.1 + iy * 0.76) * size, z + iz * 0.76 * size,
          0.80 * size, 0.80 * size, 0.80 * size, colors[Math.floor(rng() * colors.length)]);
      }
    }
  }
}

/** Extrude a font mask into cubes. Height describes the entire rendered text. */
export function voxelText(b, text, x, y, z, { height = 2, cell = 0.15, color = '#eee8d6', depth = 0.3, vertical = false, font = 'serif' } = {}) {
  if (typeof document === 'undefined') return { width: 0, height: 0 };
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const family = font === 'sans' ? '"Campus Sans", "Noto Sans SC", sans-serif' : '"Campus Serif", "Noto Serif SC", serif';
  const chars = vertical ? [...text.replace(/\s/g, '')] : [text];
  ctx.font = `500 128px ${family}`;
  const measure = Math.max(...chars.map((line) => ctx.measureText(line).width));
  canvas.width = Math.ceil(measure + 16); canvas.height = chars.length * 148;
  ctx.font = `500 128px ${family}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
  chars.forEach((line, index) => ctx.fillText(line, canvas.width / 2, index * 148 + 75));
  const rows = Math.max(2, Math.round(height / cell));
  const cols = Math.max(2, Math.round(rows * canvas.width / canvas.height));
  const mask = document.createElement('canvas'); mask.width = cols; mask.height = rows;
  const sample = mask.getContext('2d', { willReadFrequently: true });
  sample.drawImage(canvas, 0, 0, cols, rows);
  const pixels = sample.getImageData(0, 0, cols, rows).data;
  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      if (pixels[(iy * cols + ix) * 4 + 3] < 78) continue;
      b.box(x + (ix - (cols - 1) / 2) * cell, y + ((rows - 1) / 2 - iy) * cell, z,
        cell * 0.98, cell * 0.98, depth, color);
    }
  }
  return { width: cols * cell, height: rows * cell };
}

export function emblem(b, x, y, z, diameter = 1.6, gold = false) {
  const cell = diameter / 15;
  for (let ix = -7; ix <= 7; ix++) {
    for (let iy = -7; iy <= 7; iy++) {
      const r = Math.hypot(ix, iy);
      if (r > 7.3) continue;
      const edge = r > 6.1;
      b.box(x + ix * cell, y + iy * cell, z, cell, cell, 0.09, gold ? '#bb9a55' : edge ? '#b5a478' : '#1d6752');
    }
  }
  for (let row = 0; row < 4; row++) {
    const width = diameter * (0.70 - row * 0.14);
    b.box(x, y + (row - 1.5) * diameter * 0.15, z + 0.065, width, diameter * 0.085, 0.08, gold ? '#ddc17a' : '#f0edcf');
  }
}
