import * as THREE from 'three';

/**
 * Reconstructed from the six supplied room photographs. All objects and graphics
 * below are modelled procedurally; the PDF and the people in it are not shipped.
 * Dimensions are visual estimates, in metres, and are not a measured survey.
 */
export function buildDecor(M) {
  const group = new THREE.Group();
  group.name = 'moyuan-room-collections';
  const cutaway = [];
  const stats = { shelves: 0, porcelainPieces: 0, plants: 0, scrolls: 0, teaChairs: 0,
    writingSets: 0, baskets: 0, guqins: 0, voxelInstances: 0, instancedMeshes: 0 };
  const materials = [];
  const tint = (base, name, color, options = {}) => {
    const mat = base.clone(); mat.name = name; mat.color.set(color);
    Object.assign(mat, options); materials.push(mat); return mat;
  };
  const wood = tint(M.wood, 'wood-shelf-honey', '#986538');
  const darkWood = tint(M.woodDark, 'wood-tea-chair', '#443025');
  const lightWood = tint(M.bamboo, 'wood-carrier-pale', '#b79365');
  const blue = tint(M.ceramic, 'porcelain-cobalt-decoration', '#233e68', { roughness: 0.24, metalness: 0.04 });
  const celadon = tint(M.ceramic, 'porcelain-celadon', '#b6c5a9', { roughness: 0.22 });
  const cream = tint(M.ceramic, 'porcelain-rice-white', '#e5e1cf', { roughness: 0.21 });
  const terracotta = tint(M.soil, 'terracotta-pot', '#82513c', { roughness: 0.82 });
  const darkLeaf = tint(M.leaf, 'foliage-deep-green', '#284d26', { roughness: 0.67 });
  const midLeaf = tint(M.leaf, 'foliage-jade-green', '#4c7334', { roughness: 0.56 });
  const lightLeaf = tint(M.leaf, 'foliage-young-green', '#7d9349', { roughness: 0.60 });
  const stemMat = tint(M.woodDark, 'wood-plant-stem', '#61543a');
  const cushion = tint(M.black, 'tea-chair-black-leather', '#251f1c', { roughness: 0.68 });
  const rose = tint(M.paper, 'rose-apricot-petals', '#cd916c');
  const roseLight = tint(M.paper, 'rose-cream-petals', '#ead9b8');
  const brass = M.brass;
  const batches = [];
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const dummy = new THREE.Object3D();
  let seed = 731;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

  // Each colour is one instanced draw. Fine voxel rims and foliage do not create
  // thousands of individual render objects; their silhouettes remain true cubes.
  function layer(parent) {
    const data = new Map();
    const box = (mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => {
      if (!(sx > 0 && sy > 0 && sz > 0)) return;
      if (!data.has(mat)) data.set(mat, []);
      data.get(mat).push([x, y, z, sx, sy, sz, rx, ry, rz]);
    };
    const beam = (mat, a, b, width, depth = width) => {
      const direction = new THREE.Vector3().subVectors(new THREE.Vector3(...b), new THREE.Vector3(...a));
      const centre = new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(0.5);
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
      const e = new THREE.Euler().setFromQuaternion(dummy.quaternion);
      box(mat, centre.x, centre.y, centre.z, width, direction.length(), depth, e.x, e.y, e.z);
    };
    const flush = () => {
      for (const [mat, parts] of data) {
        const mesh = new THREE.InstancedMesh(geometry, mat, parts.length);
        mesh.name = 'voxel-' + (mat.name || 'collection');
        mesh.castShadow = true; mesh.receiveShadow = true;
        parts.forEach((part, i) => {
          dummy.position.set(part[0], part[1], part[2]);
          dummy.scale.set(part[3], part[4], part[5]);
          dummy.rotation.set(part[6], part[7], part[8]);
          dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere(); parent.add(mesh);
        stats.voxelInstances += parts.length; stats.instancedMeshes++;
      }
      data.clear();
    };
    const api = { box, beam, flush }; batches.push(api); return api;
  }
  const B = layer(group);

  function profileAt(profile, fraction) {
    const value = Math.min(profile.length - 1.000001, fraction * (profile.length - 1));
    const index = Math.floor(value);
    return THREE.MathUtils.lerp(profile[index], profile[index + 1], value - index);
  }

  /** Hollow stepped voxel porcelain, with cobalt pigment laid into the shell. */
  function vessel(x, y, z, height = 0.35, width = 0.23, variant = 0, material = cream, batch = B) {
    stats.porcelainPieces++;
    const shapes = [
      [0.54, 0.62, 0.81, 1, 1, 0.91, 0.75, 0.46, 0.36, 0.36, 0.46],
      [0.52, 0.72, 0.94, 1, 0.99, 0.84, 0.60, 0.38, 0.33, 0.43, 0.56],
      [0.68, 0.80, 0.97, 1, 0.98, 0.82, 0.74, 0.70],
    ];
    const profile = shapes[variant % shapes.length];
    const cell = width < 0.11 ? 0.009 : 0.015;
    const levels = Math.max(5, Math.ceil(height / cell));
    const dy = height / levels;
    for (let k = 0; k < levels; k++) {
      const f = (k + 0.5) / levels;
      const r = profileAt(profile, f) * width / 2;
      const n = Math.ceil(r / cell);
      for (let ix = -n; ix <= n; ix++) for (let iz = -n; iz <= n; iz++) {
        const xx = ix * cell, zz = iz * cell, d = Math.hypot(xx, zz);
        if (d > r || (k > 0 && d < r - cell * 1.36)) continue;
        const angle = Math.atan2(zz, xx);
        const band = k === 2 || k === levels - 3;
        const branch = Math.abs(Math.sin(angle * 3 + f * 16)) < 0.17 && f > 0.20 && f < 0.76;
        const flower = Math.sin(angle * 7 - f * 25) > 0.73 && Math.cos(angle * 3 + f * 22) > 0.12;
        const pigment = variant < 2 && (band || branch || (f > 0.35 && f < 0.70 && flower));
        batch.box(pigment ? blue : material, x + xx, y + (k + 0.5) * dy, z + zz, cell * 0.99, dy, cell * 0.99);
      }
    }
    // A dark inset inside the lip makes even small cups visibly hollow.
    const lipRadius = profile[profile.length - 1] * width / 2;
    batch.box(M.ink, x, y + height - dy * 1.35, z, lipRadius * 1.12, dy * 0.25, lipRadius * 1.12);
  }

  function cup(x, y, z, size = 0.075, mat = cream) {
    vessel(x, y, z, size * 0.75, size, 2, mat);
    B.box(mat, x + size * 0.53, y + size * 0.38, z, size * 0.24, size * 0.50, size * 0.15);
    B.box(mat, x + size * 0.64, y + size * 0.38, z, size * 0.12, size * 0.30, size * 0.15);
  }

  function teaPot(x, y, z, scale = 1, mat = cream) {
    vessel(x, y, z, 0.12 * scale, 0.17 * scale, 2, mat);
    B.box(mat, x, y + 0.126 * scale, z, 0.108 * scale, 0.025 * scale, 0.108 * scale);
    B.box(mat, x, y + 0.147 * scale, z, 0.032 * scale, 0.025 * scale, 0.032 * scale);
    B.beam(mat, [x + 0.055 * scale, y + 0.065 * scale, z], [x + 0.145 * scale, y + 0.135 * scale, z], 0.036 * scale);
    B.box(mat, x - 0.12 * scale, y + 0.077 * scale, z, 0.026 * scale, 0.13 * scale, 0.024 * scale);
    for (const yy of [0.025, 0.125]) B.box(mat, x - 0.085 * scale, y + yy * scale, z, 0.075 * scale, 0.026 * scale, 0.024 * scale);
  }

  function leaf(x, y, z, angle, scale = 1, droop = 0) {
    const mat = [darkLeaf, midLeaf, lightLeaf][Math.floor(random() * 3)];
    // Three offset cube strips form the pointed, heart-shaped pothos leaf.
    B.box(mat, x, y, z, 0.095 * scale, 0.018 * scale, 0.055 * scale, droop, angle, 0.10);
    B.box(mat, x + Math.cos(angle) * 0.032 * scale, y + 0.003 * scale,
      z - Math.sin(angle) * 0.032 * scale, 0.065 * scale, 0.018 * scale, 0.082 * scale, droop, angle, 0.10);
    B.box(mat, x + Math.cos(angle) * 0.071 * scale, y - 0.005 * scale,
      z - Math.sin(angle) * 0.071 * scale, 0.050 * scale, 0.016 * scale, 0.041 * scale, droop, angle, 0.10);
    B.box(lightLeaf, x + Math.cos(angle) * 0.024 * scale, y + 0.014 * scale,
      z - Math.sin(angle) * 0.024 * scale, 0.078 * scale, 0.008 * scale, 0.009 * scale, droop, angle, 0.10);
  }

  function plant(x, y, z, scale = 1, trailing = true) {
    stats.plants++;
    vessel(x, y, z, 0.19 * scale, 0.25 * scale, 2, terracotta);
    B.box(M.soil, x, y + 0.171 * scale, z, 0.15 * scale, 0.015, 0.15 * scale);
    for (let arm = 0; arm < 10; arm++) {
      const phase = arm * 2.399963;
      const reach = (0.17 + random() * 0.16) * scale;
      const end = [x + Math.cos(phase) * reach, y + (0.32 + random() * 0.17) * scale, z + Math.sin(phase) * reach];
      B.beam(stemMat, [x, y + 0.17 * scale, z], end, 0.012 * scale);
      for (let j = 1; j <= 3; j++) {
        const t = j / 3;
        leaf(THREE.MathUtils.lerp(x, end[0], t), THREE.MathUtils.lerp(y + 0.2 * scale, end[1], t),
          THREE.MathUtils.lerp(z, end[2], t), -phase + (j % 2 ? 0.8 : -0.8), (0.8 + random() * 0.4) * scale, 0.2);
      }
    }
    if (trailing) for (let vine = 0; vine < 3; vine++) {
      const phase = (vine - 1) * 0.65;
      let last = [x + Math.sin(phase) * 0.10 * scale, y + 0.27 * scale, z + 0.12 * scale];
      for (let j = 0; j < 9; j++) {
        const next = [x + Math.sin(j * 0.6 + phase) * 0.10 * scale, y + (0.24 - j * 0.068) * scale,
          z + (0.18 + j * 0.025) * scale];
        B.beam(stemMat, last, next, 0.008 * scale);
        leaf(...next, (j % 2 ? 0.4 : 2.5), 0.75 * scale, 0.45);
        last = next;
      }
    }
  }

  function shelving(x, mirrored) {
    stats.shelves++;
    const z = -5.85, width = 1.92, height = 2.81, depth = 0.46;
    const left = x - width / 2, right = x + width / 2;
    const upright = (xx, lo, hi) => {
      B.box(wood, xx, (lo + hi) / 2, z, 0.058, hi - lo, depth);
      B.box(brass, xx + 0.031, (lo + hi) / 2, z + depth / 2 + 0.004, 0.009, hi - lo, 0.012);
    };
    for (const xx of [left, right]) upright(xx, 0.12, height);
    for (const yy of [0.13, 0.58, 1.04, 1.60, 2.15, height]) {
      B.box(wood, x, yy, z, width + 0.06, 0.052, depth + 0.035);
      B.box(brass, x, yy + 0.021, z + depth / 2 + 0.02, width + 0.04, 0.008, 0.014);
    }
    // The reference cabinets deliberately use staggered uprights, not a grid.
    const sign = mirrored ? -1 : 1;
    upright(x - 0.40 * sign, 0.59, 1.59);
    upright(x + 0.34 * sign, 1.04, 2.15);
    upright(x - 0.20 * sign, 2.15, height);
    B.box(wood, x, 0.35, z + 0.03, width - 0.12, 0.40, depth - 0.08);
    for (const yy of [0.235, 0.435]) {
      B.box(lightWood, x, yy, z + 0.253, width - 0.18, 0.18, 0.024);
      B.box(darkWood, x, yy - 0.08, z + 0.269, width - 0.22, 0.010, 0.007);
      // Stepped brass drawer pulls with a visible hollow centre.
      for (const a of [-1, 1]) B.box(brass, x + a * 0.040, yy + 0.006, z + 0.294, 0.015, 0.047, 0.014);
      B.box(brass, x, yy - 0.020, z + 0.297, 0.09, 0.013, 0.018);
    }
    for (const xx of [left + 0.08, right - 0.08]) B.box(wood, xx, 0.075, z, 0.12, 0.15, depth * 0.75);
    if (!mirrored) {
      plant(x - 0.61, 0.62, z + 0.13, 1.0, true);
      plant(x + 0.59, 1.07, z + 0.14, 0.75, true);
      for (const dx of [-0.15, 0.27]) vessel(x + dx, 0.61, z, 0.21, 0.21, dx > 0 ? 1 : 0);
      teaPot(x - 0.57, 1.067, z, 0.85, celadon);
      for (const dx of [-0.17, 0.12, 0.41]) cup(x + dx, 1.067, z + 0.04, 0.085, celadon);
      vessel(x + 0.60, 1.63, z, 0.28, 0.18, 1);
      cup(x - 0.5, 2.18, z, 0.18, cream);
      B.box(M.purple, x - 0.72, 2.192, z + 0.10, 0.23, 0.036, 0.18, 0.04, 0.23, 0.04);
    } else {
      plant(x + 0.62, 0.62, z + 0.10, 1.05, true);
      plant(x - 0.62, 1.07, z + 0.06, 0.73, false);
      vessel(x - 0.43, 0.61, z, 0.34, 0.24, 0);
      vessel(x - 0.04, 0.61, z, 0.39, 0.23, 1);
      vessel(x + 0.29, 1.07, z, 0.27, 0.19, 0);
      for (const dx of [-0.55, 0.28]) {
        vessel(x + dx, 1.63, z, 0.14, 0.14, 0);
        B.box(brass, x + dx, 1.79, z, 0.035, 0.035, 0.035);
      }
      for (const dx of [-0.28, 0.40]) vessel(x + dx, 2.18, z, 0.37, 0.19, 1);
    }
  }

  function teaChair(x, z) {
    stats.teaChairs++;
    for (const xx of [-0.29, 0.29]) for (const zz of [-0.27, 0.27]) {
      B.box(darkWood, x + xx, 0.24, z + zz, 0.055, 0.48, 0.055);
    }
    B.box(darkWood, x, 0.42, z, 0.67, 0.07, 0.65);
    B.box(cushion, x, 0.47, z + 0.015, 0.58, 0.09, 0.52);
    B.box(cushion, x, 0.81, z - 0.25, 0.60, 0.55, 0.09, -0.10);
    B.box(darkWood, x, 1.08, z - 0.28, 0.66, 0.045, 0.07);
    for (const xx of [-0.32, 0.32]) {
      B.box(darkWood, x + xx, 0.71, z, 0.06, 0.055, 0.69);
      B.box(darkWood, x + xx, 0.59, z + 0.23, 0.043, 0.25, 0.045);
      B.box(darkWood, x + xx, 0.82, z - 0.26, 0.045, 0.55, 0.05);
    }
    // Cushion seams remain visible under the raking window light.
    for (const dx of [-0.27, 0.27]) B.box(M.woodDark, x + dx, 0.519, z + 0.015, 0.004, 0.002, 0.48);
  }

  function scrollTexture(title, variation) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 1536;
    const c = canvas.getContext('2d');
    c.fillStyle = '#dcd7c5'; c.fillRect(0, 0, 512, 1536);
    // Woven silk ends and paper fibres, rather than a photograph on a rectangle.
    for (let i = 0; i < 3500; i++) {
      c.strokeStyle = `rgba(118,105,74,${0.02 + random() * 0.05})`;
      const xx = random() * 512, yy = random() * 1536;
      c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + random() * 5, yy + 5 + random() * 40); c.stroke();
    }
    c.fillStyle = '#f0ead8'; c.fillRect(44, 186, 424, 1140);
    for (const yy of [0, 1360]) {
      c.fillStyle = '#b5b5aa'; c.fillRect(0, yy, 512, 176);
      c.strokeStyle = '#cfd1c3'; c.lineWidth = 1;
      for (let a = -180; a < 650; a += 18) {
        c.beginPath(); c.moveTo(a, yy); c.lineTo(a + 180, yy + 176); c.stroke();
        c.beginPath(); c.moveTo(a, yy + 176); c.lineTo(a + 180, yy); c.stroke();
      }
    }
    c.fillStyle = '#45413a'; c.beginPath();
    const outline = [[181,300],[331,300],[331,341],[311,372],[310,455],[337,493],[324,580],[313,650],[326,731],[306,812],[305,925],[320,1020],[304,1112],[316,1180],[294,1225],[278,1216],[278,1153],[238,1153],[238,1216],[216,1225],[196,1180],[207,1112],[190,1020],[206,925],[206,812],[187,731],[201,650],[190,580],[178,493],[202,455],[202,372],[181,341]];
    outline.forEach(([xx, yy], i) => i ? c.lineTo(xx, yy) : c.moveTo(xx, yy)); c.closePath(); c.fill();
    c.fillStyle = '#e9e0c8'; c.fillRect(197, 315, 118, 20); c.fillRect(243, 958, 27, 84);
    c.fillRect(225, 1083, 63, 48);
    c.font = '35px MoyuanSerif, serif'; c.textAlign = 'center';
    [...title].forEach((letter, i) => c.fillText(letter, 257, 421 + i * 48));
    c.font = '14px MoyuanSerif, serif';
    for (const [line, xx] of [['一室清和听松风',220], ['七弦流韵寄幽怀',290]]) {
      [...line].forEach((letter, i) => c.fillText(letter, xx, 685 + i * 23 + variation * 7));
    }
    c.strokeStyle = '#b8ad89'; c.lineWidth = 1;
    for (let i = 0; i < 8; i++) c.strokeRect(239 + i * 2, 1094 + i * 2, 38 - i * 4, 26 - i * 2);
    c.strokeStyle = '#97664b'; c.lineWidth = 3; c.strokeRect(244, 1270, 44, 44);
    c.font = '16px MoyuanSerif, serif'; c.fillStyle = '#97664b'; c.fillText('理韵', 266, 1298);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    return map;
  }

  function scroll(z, title, variation) {
    stats.scrolls++;
    const material = M.paper.clone(); material.name = 'silk-guqin-rubbing';
    material.map = scrollTexture(title, variation); material.color.set('#ffffff');
    material.side = THREE.DoubleSide; material.roughness = 0.93; materials.push(material);
    const artwork = new THREE.Mesh(new THREE.PlaneGeometry(0.60, 2.04, 1, 1), material);
    artwork.rotation.y = Math.PI / 2;
    artwork.position.set(-4.655, 1.67, z); artwork.castShadow = true; artwork.receiveShadow = true;
    artwork.name = 'guqin-rubbing-' + variation; group.add(artwork);
    for (const yy of [0.64, 2.70]) {
      B.box(darkWood, -4.644, yy, z, 0.043, 0.033, 0.67);
      for (const dz of [-0.35, 0.35]) B.box(brass, -4.644, yy, z + dz, 0.045, 0.038, 0.035);
    }
    B.beam(stemMat, [-4.65, 2.70, z - 0.25], [-4.65, 2.89, z], 0.008);
    B.beam(stemMat, [-4.65, 2.70, z + 0.25], [-4.65, 2.89, z], 0.008);
    B.box(brass, -4.66, 2.91, z, 0.025, 0.055, 0.018);
  }

  function basket(x, tableY, z, scale = 1) {
    stats.baskets++;
    const half = 0.40 * scale, depth = 0.24 * scale;
    const bottom = tableY + 0.025 * scale;
    B.box(lightWood, x, bottom, z, half * 2, 0.045 * scale, depth * 2);
    // Small stacked timber boards leave visible join lines on the carrier walls.
    for (let j = 0; j < 6; j++) {
      const yy = tableY + (0.065 + j * 0.028) * scale;
      for (const dz of [-depth, depth]) B.box(lightWood, x, yy, z + dz, half * 2, 0.026 * scale, 0.025 * scale);
      for (const dx of [-half, half]) B.box(wood, x + dx, yy, z, 0.026 * scale, 0.026 * scale, depth * 2);
    }
    B.box(lightWood, x, tableY + 0.14 * scale, z, 0.022 * scale, 0.19 * scale, depth * 2);
    for (const dx of [-0.29, 0.29]) {
      B.box(lightWood, x + dx * scale, tableY + 0.38 * scale, z, 0.035 * scale, 0.69 * scale, 0.042 * scale);
      B.box(darkWood, x + dx * scale, tableY + 0.25 * scale, z + 0.024 * scale, 0.014 * scale, 0.014 * scale, 0.010 * scale);
    }
    B.box(lightWood, x, tableY + 0.72 * scale, z, 0.65 * scale, 0.055 * scale, 0.055 * scale);
    B.box(wood, x, tableY + 0.70 * scale, z, 0.42 * scale, 0.022 * scale, 0.055 * scale);
    B.box(M.paper, x - 0.19 * scale, tableY + 0.15 * scale, z + 0.02 * scale, 0.19 * scale, 0.22 * scale, 0.15 * scale, 0, -0.09, 0.04);
    B.box(M.paper, x - 0.18 * scale, tableY + 0.265 * scale, z + 0.02 * scale, 0.16 * scale, 0.015 * scale, 0.14 * scale, 0, -0.09, 0.04);
    cup(x + 0.22 * scale, tableY + 0.05 * scale, z - 0.05 * scale, 0.15 * scale, celadon);
    B.box(roseLight, x + 0.20 * scale, tableY + 0.17 * scale, z + 0.09 * scale, 0.17 * scale, 0.06 * scale, 0.14 * scale, 0, 0.2, 0.15);
  }

  function writingSet(x, tableY, z, flip = false) {
    stats.writingSets++;
    const s = flip ? -1 : 1;
    // A subtly stepped handmade paper edge and sample ink marks.
    B.box(M.paper, x - 0.05 * s, tableY + 0.007, z, 0.64, 0.011, 0.39, 0, -0.025 * s);
    B.box(M.ivory, x - 0.047 * s, tableY + 0.014, z, 0.63, 0.004, 0.382, 0, -0.025 * s);
    for (let row = 0; row < 3; row++) for (let k = 0; k < 5; k++) {
      B.box(M.ink, x + (0.17 - row * 0.14) * s, tableY + 0.017,
        z - 0.12 + k * 0.055, 0.006 + random() * 0.024, 0.0015, 0.022 + random() * 0.016, 0, random() * 0.30);
    }
    B.box(M.ink, x + 0.43 * s, tableY + 0.019, z - 0.04, 0.17, 0.036, 0.11);
    B.box(M.black, x + 0.43 * s, tableY + 0.039, z - 0.04, 0.13, 0.006, 0.078);
    B.box(M.brass, x + 0.40 * s, tableY + 0.042, z + 0.15, 0.14, 0.035, 0.021);
    B.beam(M.bamboo, [x + 0.25 * s, tableY + 0.045, z + 0.18], [x - 0.03 * s, tableY + 0.045, z + 0.22], 0.011);
    B.beam(M.ink, [x - 0.03 * s, tableY + 0.045, z + 0.22], [x - 0.09 * s, tableY + 0.045, z + 0.23], 0.014);
    B.box(M.woodDark, x + 0.30 * s, tableY + 0.023, z - 0.23, 0.30, 0.027, 0.022, 0, 0.03);
    // The little cinnabar seal is deliberately separate from the paper.
    B.box(terracotta, x - 0.42 * s, tableY + 0.04, z + 0.02, 0.06, 0.08, 0.06);
  }

  function books(x, tableY, z) {
    const covers = [blue, M.purple, celadon];
    for (let i = 0; i < 3; i++) {
      const yy = tableY + 0.018 + i * 0.04;
      B.box(covers[i], x + i * 0.012, yy, z, 0.25, 0.038, 0.35, 0, 0.08 * i);
      B.box(M.paper, x + i * 0.012, yy, z + 0.007, 0.233, 0.027, 0.325, 0, 0.08 * i);
      B.box(covers[i], x + i * 0.012, yy + 0.018, z, 0.25, 0.004, 0.35, 0, 0.08 * i);
    }
  }

  function flowers(x, tableY, z) {
    const bundle = new THREE.Group(); bundle.name = 'apricot-and-cream-bouquet'; group.add(bundle);
    for (let i = 0; i < 11; i++) {
      const angle = i * 2.4, rr = Math.sqrt(i / 11) * 0.19;
      const xx = x + Math.cos(angle) * rr, zz = z + Math.sin(angle) * rr;
      const yy = tableY + 0.10 + random() * 0.09;
      B.beam(stemMat, [x - 0.40, tableY + 0.03, z - 0.04], [xx, yy, zz], 0.008);
      const mat = i % 3 ? rose : roseLight;
      B.box(mat, xx, yy, zz, 0.07, 0.065, 0.07);
      for (let petal = 0; petal < 7; petal++) {
        const a = petal * 0.897;
        B.box(mat, xx + Math.cos(a) * 0.055, yy + 0.008 * Math.sin(a * 2), zz + Math.sin(a) * 0.055,
          0.048, 0.052, 0.052, 0.15, a, 0.30);
      }
      leaf(xx - 0.08, tableY + 0.055, zz + 0.1, angle, 1.1, 0.15);
    }
  }

  function wallGuqin(z, offset = 0) {
    stats.guqins++;
    const centreY = 1.65, height = 1.73, x = 4.57;
    const profile = [0.85, 0.88, 0.78, 0.65, 0.57, 0.69, 0.75, 0.61, 0.66, 0.67, 0.53, 0.48, 0.52, 0.51];
    for (let i = 0; i < 65; i++) {
      const f = i / 64, width = profileAt(profile, Math.min(f, 0.999)) * 0.21;
      B.box(darkWood, x, centreY + (0.5 - f) * height, z + offset, 0.08, height / 65 + 0.0001, width);
      B.box(M.ink, x - 0.044, centreY + (0.5 - f) * height, z + offset, 0.014, height / 65 + 0.0001, width * 0.94);
    }
    for (let j = 0; j < 7; j++) B.box(M.ivory, x - 0.054, centreY, z + offset + (j - 3) * 0.016, 0.003, height * 0.92, 0.002);
    for (let j = 0; j < 13; j++) B.box(M.ivory, x - 0.059, centreY + 0.65 - j * 0.10, z + offset - 0.065, 0.009, 0.009, 0.009);
    for (const yy of [1.11, 2.20]) B.box(brass, 4.65, yy, z + offset, 0.18, 0.025, 0.30);
  }

  // Curated rear room: the round wooden screen itself belongs to room.js.
  shelving(-2.90, false); shelving(2.90, true);
  teaChair(-0.86, -5.67); teaChair(0.86, -5.67);
  plant(-1.75, 0.49, -5.11, 0.85, false);
  plant(1.75, 0.49, -5.11, 0.90, true);
  scroll(-3.2, '松风清韵', 0); scroll(0, '十里云烟', 1); scroll(3.2, '清和雅集', 2);
  wallGuqin(4.25, -0.30); wallGuqin(4.25, 0); wallGuqin(4.25, 0.30);

  // Tabletop objects are deliberately sparse, matching a room in active use.
  const tableY = 0.79;
  basket(1.0, tableY, 1.3, 0.92);
  writingSet(-1.0, tableY, -0.8);
  writingSet(3.0, tableY, 1.3, true);
  writingSet(-3.0, tableY, -2.9, true);
  books(3.25, tableY, -0.80); cup(2.70, tableY, -0.80, 0.10, celadon);
  flowers(-3.0, tableY, 3.4);
  teaPot(0.8, tableY, -2.9, 1.15, celadon);
  cup(1.20, tableY, -2.9, 0.085, celadon);
  B.box(M.paper, -1.25, tableY + 0.022, 3.4, 0.25, 0.04, 0.40, 0, 0.08);

  // Reference front wall display: a dark screen on its actual freestanding base.
  const television = new THREE.Group(); television.name = 'front-mobile-display';
  group.add(television); cutaway.push(television);
  const T = layer(television);
  const tvMetal = tint(M.black, 'display-brushed-metal', '#45464a', { roughness: 0.35, metalness: 0.68 });
  const tvGlass = tint(M.glass, 'display-dark-glass', '#171c22', { transparent: false, opacity: 1, roughness: 0.16, metalness: 0.18 });
  T.box(tvMetal, 0, 1.62, 6.58, 2.28, 1.34, 0.075);
  T.box(tvGlass, 0, 1.62, 6.535, 2.18, 1.24, 0.012);
  T.box(M.black, 0, 0.94, 6.532, 0.19, 0.025, 0.012);
  for (const xx of [-0.72, 0.72]) {
    T.box(tvMetal, xx, 0.60, 6.63, 0.055, 1.04, 0.055);
    T.beam(tvMetal, [xx, 0.12, 6.20], [xx, 0.64, 6.63], 0.055);
    T.box(tvMetal, xx, 0.10, 6.52, 0.07, 0.07, 0.87);
    for (const zz of [6.13, 6.91]) T.box(M.black, xx, 0.05, zz, 0.09, 0.09, 0.065);
  }
  T.box(tvMetal, 0, 0.39, 6.62, 1.48, 0.045, 0.05);
  T.box(M.black, 0, 0.69, 6.54, 0.47, 0.025, 0.25);

  // The photographed stack of spare stools is distinct from classroom seating.
  for (let i = 0; i < 5; i++) {
    const yy = 0.31 + i * 0.095;
    B.box(darkWood, 4.02, yy, 5.77, 0.43, 0.045, 0.43);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      B.box(darkWood, 4.02 + sx * 0.18, yy - 0.13, 5.77 + sz * 0.18, 0.037, 0.24, 0.037);
    }
  }
  for (const batch of batches) batch.flush();
  group.userData.reference = 'Six room photographs; proportions estimated from visible furniture.';
  group.userData.estimatedDimensions = true;
  return {
    group, cutaway, stats,
    hotspots: [
      { id: 'porcelain', title: '博古陈设', description: '错落木格、青花瓷器与垂落绿萝，依活动室照片重建。', position: [2.90, 1.65, -5.58] },
      { id: 'rubbings', title: '窗间琴拓', description: '细木轴、绫裱与琴形墨拓。画面为程序绘制，沿窗墙重新装裱。', position: [-4.55, 1.80, 0] },
      { id: 'carrier', title: '木作文具提篮', description: '两格木提篮、横梁提柄与小器物，参考照片中的桌面细节。', position: [1.0, 1.12, 1.30] },
      { id: 'calligraphy', title: '一席笔墨', description: '宣纸、镇尺、毛笔、墨砚和朱印，留出落笔的空间。', position: [-1.0, 0.95, -0.80] },
      { id: 'guqin', title: '七弦琴意', description: '墙边古琴以细体素收腰琴身和七弦重建。', position: [4.48, 1.70, 4.25] },
    ],
  };
}
