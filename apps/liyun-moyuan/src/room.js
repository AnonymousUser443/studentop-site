import * as THREE from 'three';

/**
 * Photo-led voxel reconstruction of the Liyun association room.
 * Coordinates are estimates, not a measured survey: 9.6 × 14.4 × 3.45 m.
 * References: supplied PDF pages 2 / 3 / 6, with window details on page 1.
 * Fine stepped joinery uses 18–35 mm blocks; structural panels stay continuous.
 */
export function buildRoom(M) {
  const group = new THREE.Group();
  group.name = 'moyuan-room';
  const cutaway = [];
  const pools = new Map();
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  let blockCount = 0;
  const colliders = [];
  const stats = { estimatedDimensions: [9.6, 3.45, 14.4], desks: 16, foldingChairs: 16,
    armchairs: 0, windows: 4, cupboardModules: 11, ceilingLights: 8, voxelBlocks: 0,
    note: 'Dimensions and hidden construction are inferred from photographs.' };

  function section(name, hiddenInDiorama = false) {
    const child = new THREE.Group();
    child.name = name;
    group.add(child);
    if (hiddenInDiorama) cutaway.push(child);
    return child;
  }
  function box(parent, material, x, y, z, w, h, d, shade = 1, rx = 0, ry = 0, rz = 0) {
    if (w <= 0 || h <= 0 || d <= 0) return;
    let byMaterial = pools.get(parent);
    if (!byMaterial) pools.set(parent, byMaterial = new Map());
    let entries = byMaterial.get(material);
    if (!entries) byMaterial.set(material, entries = []);
    position.set(x, y, z);
    scale.set(w, h, d);
    quaternion.setFromEuler(euler.set(rx, ry, rz));
    matrix.compose(position, quaternion, scale);
    entries.push({ matrix: matrix.clone(), shade });
    blockCount++;
  }
  function stairBeam(parent, material, a, b, width = 0.05, depth = width, shade = 1) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const steps = Math.max(1, Math.ceil(length / 0.025));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      box(parent, material, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t, width, 0.035, depth, shade);
    }
  }
  const tint = n => 0.96 + ((Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1) * 0.045;

  // Pale close-set floorboards, staggered end joints and an exposed model plinth.
  const floor = section('floorboards-and-foundation');
  box(floor, 'woodDark', 0, -0.18, 0, 9.83, 0.29, 14.64, 0.75);
  box(floor, 'brass', 0, -0.039, 0, 9.71, 0.025, 14.51, 0.8);
  box(floor, 'floor', 0, -0.022, 0, 9.6, 0.042, 14.4);
  for (let column = 0; column < 48; column++) {
    const x = -4.8 + (column + 0.5) * 0.2;
    const offset = column % 3 * 0.53;
    for (let z = -7.2 - offset; z < 7.2; z += 1.61) {
      const start = Math.max(-7.2, z), end = Math.min(7.2, z + 1.607);
      if (end > start) box(floor, 'floor', x, 0.005, (start + end) / 2,
        0.1976, 0.014, end - start, tint(column * 41 + Math.round(z * 10)));
    }
  }

  const back = section('tea-end-wall');
  box(back, 'plaster', 0, 1.725, -7.28, 9.8, 3.45, 0.16);
  box(back, 'woodDark', 0, 0.065, -7.17, 9.6, 0.13, 0.045);
  box(back, 'woodDark', 0, 3.39, -7.15, 9.6, 0.085, 0.075);
  // Back glazing above / behind the free-standing tea screen.
  for (const x of [-3.55, -1.2, 1.2, 3.55]) {
    box(back, 'black', x, 2.4, -7.15, 2.23, 1.7, 0.08, 0.75);
    box(back, 'glass', x, 2.4, -7.09, 2.10, 1.56, 0.023, 0.65);
    box(back, 'black', x, 2.4, -7.045, 0.045, 1.58, 0.035);
    box(back, 'black', x, 2.28, -7.045, 2.12, 0.045, 0.035);
  }

  const left = section('window-wall');
  box(left, 'plaster', -4.89, 0.445, 0, 0.18, 0.89, 14.4);
  box(left, 'plaster', -4.89, 3.285, 0, 0.18, 0.33, 14.4);
  box(left, 'woodDark', -4.78, 0.06, 0, 0.035, 0.12, 14.4);
  box(left, 'woodDark', -4.78, 3.4, 0, 0.065, 0.055, 14.4);
  for (const z of [-6.6, -3.2, 0, 3.2, 6.6]) {
    const width = Math.abs(z) === 6.6 ? 1.2 : 0.75;
    box(left, 'plaster', -4.89, 1.98, z, 0.18, 2.19, width);
  }
  for (const z of [-4.8, -1.6, 1.6, 4.8]) {
    // Continuous glazing and black frames. The opening is genuinely open in the wall.
    box(left, 'glass', -4.88, 2.0, z, 0.025, 2.15, 2.39);
    for (const edge of [-1.23, 1.23]) box(left, 'black', -4.76, 2.0, z + edge, 0.13, 2.29, 0.065, 0.75);
    for (const y of [0.88, 1.87, 3.12]) box(left, 'black', -4.76, y, z, 0.13, 0.075, 2.51, 0.75);
    box(left, 'black', -4.735, 2.0, z - 0.4, 0.045, 2.15, 0.042, 0.8);
    box(left, 'ivory', -4.68, 0.84, z, 0.36, 0.055, 2.65);
    // Lower panes carry fine pale horizontal ribs, as in the reference windows.
    for (let y = 0.99; y < 1.8; y += 0.024) box(left, 'ivory', -4.72, y, z, 0.012, 0.004, 2.34, 0.61);
    box(left, 'woodDark', -4.67, 2.93, z, 0.1, 0.1, 2.63, 0.72);
    // Violet-grey roller blind stops above the window's central rail.
    box(left, 'purple', -4.65, 2.78, z, 0.035, 0.59, 2.6, 0.58);
    box(left, 'ivory', -4.635, 2.486, z, 0.047, 0.025, 2.62, 0.77);
    box(left, 'ivory', -4.57, 2.2, z + 1.29, 0.008, 1.38, 0.008, 0.78);
    for (let y = 1.52; y < 2.9; y += 0.028) box(left, 'ivory', -4.566, y, z + 1.29, 0.014, 0.013, 0.014, 0.86);
    // Cast-iron radiator fins, caps and exposed heating feed pipes.
    for (let n = 0; n < 19; n++) {
      box(left, 'ivory', -4.53, 0.36, z + (n - 9) * 0.054, 0.17, 0.57, 0.04, 0.91);
      box(left, 'ivory', -4.49, 0.36, z + (n - 9) * 0.054, 0.07, 0.48, 0.044);
    }
    box(left, 'ivory', -4.62, 0.13, z, 0.07, 0.06, 1.15);
    box(left, 'ivory', -4.62, 0.6, z, 0.07, 0.055, 1.15);
    box(left, 'ivory', -4.67, 0.68, z + 0.68, 0.045, 0.47, 0.045);
    box(left, 'brass', -4.65, 0.87, z + 0.68, 0.063, 0.06, 0.063, 0.65);
  }

  const right = section('right-wall-and-door', true);
  box(right, 'plaster', 4.89, 1.725, 0, 0.18, 3.45, 14.4);
  box(right, 'woodDark', 4.77, 0.07, 0, 0.065, 0.14, 14.4);
  box(right, 'woodDark', 4.77, 3.39, 0, 0.065, 0.08, 14.4);
  // Door and high lattice ventilation along the cupboard end of the room.
  box(right, 'woodDark', 4.72, 1.3, 5.6, 0.1, 2.6, 1.52);
  for (const z of [5.25, 5.95]) {
    box(right, 'ivory', 4.65, 1.29, z, 0.055, 2.47, 0.66);
    box(right, 'wood', 4.61, 1.23, z + (z > 5.6 ? -0.2 : 0.2), 0.038, 0.35, 0.027, 0.7);
  }
  for (let z = 4.65; z < 6.5; z += 0.085) box(right, 'wood', 4.7, 2.99, z, 0.07, 0.63, 0.025);
  box(right, 'wood', 4.7, 2.68, 5.6, 0.07, 0.055, 2.05);
  box(right, 'wood', 4.7, 3.3, 5.6, 0.07, 0.055, 2.05);

  // Cupboards remain in the dollhouse view: lower closed storage, a plant niche,
  // and upper ivory doors with fine brass inset rectangles and paired handles.
  const cupboards = section('white-storage-cupboards');
  const startZ = -6.75, moduleWidth = 0.94, moduleCount = stats.cupboardModules;
  const cupboardCentreZ = startZ + moduleWidth * moduleCount / 2;
  const cupboardSpan = moduleWidth * moduleCount + 0.22;
  box(cupboards, 'woodDark', 4.47, 0.07, cupboardCentreZ, 0.67, 0.14, cupboardSpan, 0.7);
  box(cupboards, 'wood', 4.6, 1.405, cupboardCentreZ, 0.15, 0.85, cupboardSpan, 0.82);
  box(cupboards, 'wood', 4.32, 0.99, cupboardCentreZ, 0.65, 0.065, cupboardSpan, 0.87);
  box(cupboards, 'ivory', 4.32, 1.81, cupboardCentreZ, 0.65, 0.065, cupboardSpan);
  for (let n = 0; n < moduleCount; n++) {
    const z = startZ + (n + 0.5) * moduleWidth;
    box(cupboards, 'ivory', 4.31, 0.54, z, 0.64, 0.83, moduleWidth - 0.013);
    box(cupboards, 'ivory', 4.31, 2.5, z, 0.64, 1.35, moduleWidth - 0.013);
    for (const [bottom, top] of [[0.19, 0.9], [1.9, 3.11]]) {
      for (const edge of [-0.36, 0.36]) box(cupboards, 'brass', 3.979, (bottom + top) / 2, z + edge, 0.005, top - bottom, 0.006, 0.75);
      for (const y of [bottom, top]) box(cupboards, 'brass', 3.979, y, z, 0.005, 0.006, 0.72, 0.75);
    }
    const handleZ = z + (n % 2 === 0 ? 0.31 : -0.31);
    for (const y of [0.63, 2.15]) {
      box(cupboards, 'brass', 3.94, y, handleZ, 0.027, 0.15, 0.025);
      for (const dy of [-0.073, 0.073]) box(cupboards, 'brass', 3.964, y + dy, handleZ, 0.045, 0.025, 0.045);
    }
    if (n % 3 === 0) box(cupboards, 'ivory', 4.32, 1.4, z - 0.46, 0.6, 0.76, 0.025);
  }

  const moon = section('moon-gate-tea-screen');
  box(moon, 'plaster', 0, 1.49, -6.3, 4.7, 2.98, 0.11, 1.015);
  box(moon, 'wood', 0, 2.99, -6.275, 4.84, 0.065, 0.16);
  for (const x of [-2.37, 2.37]) box(moon, 'wood', x, 1.5, -6.275, 0.055, 3.02, 0.14);
  const radius = 1.34, cy = 1.48, unit = 0.0275;
  for (let ix = -52; ix <= 52; ix++) for (let iy = -52; iy <= 52; iy++) {
    const x = ix * unit, y = iy * unit;
    const r = Math.hypot(x, y);
    if (r >= radius - 0.04 && r < radius + 0.047) {
      box(moon, 'wood', x, cy + y, -6.165, unit * 1.015, unit * 1.015, 0.135, 0.93 + (ix + 52) / 104 * 0.08);
    }
  }
  for (let x = -radius + 0.09; x < radius - 0.055; x += 0.083) {
    const half = Math.sqrt(radius * radius - x * x) - 0.025;
    box(moon, 'wood', x, cy, -6.17, 0.022, Math.floor(half * 2 / unit) * unit, 0.067, 0.87);
  }
  for (const y of [0.39, 0.53, 2.36, 2.49]) {
    const half = Math.sqrt(radius * radius - (y - cy) ** 2) - 0.03;
    box(moon, 'wood', 0, y, -6.125, half * 2, 0.022, 0.07, 0.92);
  }
  // Screen legs extend behind its feet, giving the standing divider real depth.
  for (const x of [-1.85, 1.85]) box(moon, 'woodDark', x, 0.035, -6.23, 0.12, 0.07, 0.73);

  const furniture = section('classroom-desks-and-folding-chairs');
  function desk(x, z, n) {
    // Eight long top planks, narrow end grain, stepped edge bevel, solid apron.
    for (let p = 0; p < 8; p++) box(furniture, 'wood', x, 0.76, z + (p - 3.5) * 0.077,
      1.54, 0.054, 0.0758, 0.94 + ((n + p) % 7) * 0.015);
    box(furniture, 'wood', x, 0.731, z, 1.57, 0.025, 0.642, 0.92);
    box(furniture, 'woodDark', x, 0.707, z, 1.49, 0.025, 0.57, 0.94);
    for (const side of [-1, 1]) {
      box(furniture, 'wood', x, 0.636, z + side * 0.238, 1.37, 0.13, 0.055, 0.9);
      for (const legX of [-0.657, 0.657]) {
        box(furniture, 'wood', x + legX, 0.35, z + side * 0.235, 0.095, 0.70, 0.095, 0.93);
        box(furniture, 'wood', x + legX, 0.03, z + side * 0.235, 0.103, 0.047, 0.103, 0.86);
        // Raised joinery plugs in the side frames.
        box(furniture, 'woodDark', x + legX + Math.sign(legX) * 0.05, 0.63, z + side * 0.235,
          0.006, 0.021, 0.021, 0.82);
      }
    }
    for (const legX of [-0.657, 0.657]) {
      box(furniture, 'wood', x + legX, 0.641, z, 0.094, 0.137, 0.55, 0.9);
      // Stair-step concave corners emulate the table's arched side joinery.
      for (let step = 0; step < 6; step++) {
        const reach = 0.018 * (6 - step);
        for (const side of [-1, 1]) box(furniture, 'wood', x + legX, 0.57 - step * 0.025,
          z + side * (0.19 - reach / 2), 0.094, 0.025, reach, 0.89);
      }
      box(furniture, 'wood', x + legX, 0.2, z, 0.066, 0.055, 0.46, 0.82);
    }
    colliders.push({ min: [x - 0.8, 0, z - 0.34], max: [x + 0.8, 0.79, z + 0.34], type: 'desk' });
  }
  function foldingChair(x, z, n) {
    for (const side of [-1, 1]) {
      const sx = x + side * 0.23;
      stairBeam(furniture, 'bamboo', [sx, 0.037, z + 0.23], [sx, 0.905, z - 0.18], 0.046, 0.056, 0.92);
      stairBeam(furniture, 'bamboo', [sx, 0.037, z - 0.23], [sx, 0.465, z + 0.18], 0.048, 0.055, 0.88);
      box(furniture, 'woodDark', sx + side * 0.026, 0.34, z + 0.088, 0.007, 0.02, 0.02, 0.82);
      box(furniture, 'bamboo', sx, 0.441, z, 0.049, 0.052, 0.49, 0.91);
    }
    // Separate seat slats expose their narrow gaps and endgrain.
    for (let slat = 0; slat < 6; slat++) box(furniture, 'bamboo', x + (slat - 2.5) * 0.074,
      0.474, z, 0.072, 0.024, 0.445, 0.95 + ((slat + n) % 4) * 0.014);
    box(furniture, 'bamboo', x, 0.204, z - 0.176, 0.445, 0.034, 0.04, 0.86);
    box(furniture, 'bamboo', x, 0.35, z + 0.1, 0.445, 0.028, 0.035, 0.9);
    // The carved handhold is a real opening, constructed around an empty centre.
    for (const side of [-1, 1]) box(furniture, 'bamboo', x + side * 0.165, 0.824, z - 0.156,
      0.18, 0.108, 0.038, 0.93);
    box(furniture, 'bamboo', x, 0.875, z - 0.178, 0.46, 0.026, 0.04, 0.96);
    box(furniture, 'bamboo', x, 0.778, z - 0.136, 0.46, 0.027, 0.04, 0.91);
    // Small stepped lobes soften the opening into the reference's cloud shape.
    for (const side of [-1, 1]) box(furniture, 'bamboo', x + side * 0.074, 0.85, z - 0.166,
      0.021, 0.025, 0.039, 0.94);
  }
  let deskId = 0;
  for (const z of [-2.9, -0.8, 1.3, 3.4]) for (const x of [-3, -1, 1, 3]) {
    desk(x, z, deskId);
    foldingChair(x, z - 0.76, deskId++);
  }

  const teaSeats = section('tea-side-tables');
  for (const x of [-1.75, 1.75]) {
    box(teaSeats, 'wood', x, 0.46, -5.11, 0.55, 0.06, 0.54);
    for (const dx of [-0.215, 0.215]) for (const dz of [-0.21, 0.21]) box(teaSeats, 'wood', x + dx,
      0.225, -5.11 + dz, 0.045, 0.45, 0.045, 0.9);
    box(teaSeats, 'wood', x, 0.15, -5.11, 0.46, 0.035, 0.42, 0.92);
  }

  const front = section('stage-curtain-and-pelmet', true);
  box(front, 'plaster', 0, 1.725, 7.29, 9.8, 3.45, 0.16);
  box(front, 'wood', 0, 0.04, 6.73, 9.6, 0.08, 0.9, 0.82);
  // Hundreds of slender cuboids retain the deep purple pleats' characteristic rhythm.
  for (let i = 0; i < 166; i++) {
    const x = -4.62 + i * 0.056;
    const wave = Math.sin(i * Math.PI / 5);
    const depth = Math.round((0.14 + 0.095 * wave) / 0.023) * 0.023;
    box(front, 'purple', x, 1.54, 7.02 - depth, 0.057, 2.98, 0.08,
      0.64 + (wave + 1) * 0.19);
  }
  // Stepped traditional pelmet and restrained geometric key border.
  for (const [x, width, height] of [[-3.92, 1.72, 0.2], [-2.98, 0.22, 0.35], [0, 5.73, 0.46], [2.98, 0.22, 0.35], [3.92, 1.72, 0.2]]) {
    box(front, 'woodDark', x, 3.39 - height / 2, 6.83, width, height + 0.045, 0.12, 0.82);
    box(front, 'ivory', x, 3.39 - height / 2, 6.75, width - 0.043, height, 0.065, 0.95);
  }
  box(front, 'wood', 0, 3.33, 6.7, 9.55, 0.072, 0.044, 0.8);
  for (let x = -4.67; x < 4.65; x += 0.26) {
    box(front, 'brass', x, 3.335, 6.67, 0.17, 0.009, 0.018, 0.78);
    box(front, 'brass', x - 0.08, 3.313, 6.67, 0.01, 0.049, 0.018, 0.78);
    box(front, 'brass', x + 0.08, 3.355, 6.67, 0.01, 0.049, 0.018, 0.78);
  }

  const ceiling = section('ceiling-lights-and-ventilation', true);
  box(ceiling, 'plaster', 0, 3.515, 0, 9.8, 0.13, 14.6);
  for (const z of [-5.25, -1.75, 1.75, 5.25]) for (const x of [-2.35, 1.72]) {
    box(ceiling, 'ivory', x, 3.435, z, 1.35, 0.045, 0.35, 0.83);
    box(ceiling, 'emissive', x, 3.405, z, 1.27, 0.012, 0.285);
    for (let i = 0; i < 15; i++) box(ceiling, 'ivory', x + (i - 7) * 0.085, 3.391, z, 0.012, 0.027, 0.29, 0.84);
    box(ceiling, 'ivory', x, 3.391, z, 1.28, 0.027, 0.012, 0.82);
  }
  for (const z of [-6.15, -2.65, 0.85, 4.35]) {
    box(ceiling, 'ivory', 0, 3.425, z, 0.62, 0.038, 0.37, 0.84);
    box(ceiling, 'black', 0, 3.4, z, 0.55, 0.012, 0.3, 0.8);
    for (let slat = 0; slat < 15; slat++) box(ceiling, 'ivory', (slat - 7) * 0.036, 3.386, z,
      0.009, 0.02, 0.3, 0.7);
    for (const dz of [-0.09, 0.09]) box(ceiling, 'ivory', 0, 3.38, z + dz, 0.56, 0.02, 0.008, 0.76);
  }
  // Smoke detector / sprinklers are small layered square voxels, not flat markings.
  for (const z of [-3.55, 3.35]) {
    box(ceiling, 'ivory', 0.58, 3.405, z, 0.11, 0.055, 0.11, 0.92);
    box(ceiling, 'ivory', 0.58, 3.367, z, 0.077, 0.025, 0.077, 0.8);
    box(ceiling, 'brass', -0.6, 3.39, z + 0.7, 0.026, 0.09, 0.026, 0.8);
    box(ceiling, 'brass', -0.6, 3.341, z + 0.7, 0.065, 0.01, 0.065, 0.8);
  }
  // Warm wall-wash housings on the window piers (actual lights are renderer-owned).
  for (const z of [-3.2, 0, 3.2]) {
    box(left, 'ivory', -4.64, 3.18, z, 0.15, 0.06, 0.16);
    box(left, 'emissive', -4.625, 3.143, z, 0.12, 0.012, 0.13, 0.88);
    box(left, 'ivory', -4.74, 0.25, z, 0.024, 0.13, 0.09, 0.9);
    for (const dz of [-0.018, 0.018]) box(left, 'black', -4.721, 0.25, z + dz, 0.004, 0.027, 0.008, 0.65);
  }
  const speakers = section('wall-speakers');
  for (const x of [-4.58, 4.58]) for (const z of [-6.75, 6.5]) {
    box(speakers, 'black', x, 2.97, z, 0.16, 0.47, 0.25, 0.8);
    for (let row = 0; row < 18; row++) box(speakers, 'ink', x - Math.sign(x) * 0.086,
      2.77 + row * 0.022, z, 0.006, 0.006, 0.21, 0.72);
  }

  for (const [parent, byMaterial] of pools) for (const [key, entries] of byMaterial) {
    const material = M[key];
    if (!material) throw new Error('Missing room material: ' + key);
    const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
    mesh.name = parent.name + ':' + key;
    mesh.castShadow = key !== 'glass' && key !== 'emissive';
    mesh.receiveShadow = true;
    for (let i = 0; i < entries.length; i++) {
      mesh.setMatrixAt(i, entries[i].matrix);
      mesh.setColorAt(i, new THREE.Color().setScalar(entries[i].shade));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    parent.add(mesh);
  }
  stats.voxelBlocks = blockCount;
  stats.drawCalls = [...pools.values()].reduce((sum, materials) => sum + materials.size, 0);
  group.userData.reconstruction = stats;
  return { group, cutaway, stats, colliders };
}
