import * as THREE from 'three';
import type { Quality } from './types';

export interface CampusWorld {
  root: THREE.Group;
  sun: THREE.DirectionalLight;
  animate(time: number, door: number, moving: boolean): void;
  setQuality(quality: Quality): void;
  dispose(): void;
}

/** Original, reference-led architectural interpretation. This is not a surveyed site plan. */
export function buildCampus(scene: THREE.Scene, quality: Quality): CampusWorld {
  const root = new THREE.Group();
  root.name = 'BIT campus / original artistic composition';
  scene.add(root);
  const mat = (color: string, roughness = .86, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const stone = mat('#e6e3d8');
  const stoneLight = mat('#f1eee4');
  const shade = mat('#c3c8bc');
  const joint = mat('#b8beb3');
  const frame = mat('#aebfb5', .52, .16);
  const glass = mat('#3d6865', .2, .42);
  const glassLight = mat('#6f9891', .26, .34);
  const bronze = mat('#ac9263', .45, .38);
  const brick = mat('#aa7765');
  const brickDark = mat('#8d6558');
  const ground = mat('#e1e0cf');
  const paving = mat('#e9e5d7');
  const pavingAlt = mat('#dcdccc');
  const lawn = mat('#9bac89');
  const lawnLight = mat('#b6bc94');
  const bark = mat('#7c8270');
  const leaves = [mat('#457c67'), mat('#609279'), mat('#84a68a'), mat('#315f51')];
  const paper = new THREE.MeshStandardMaterial({ color: '#f4e5be', emissive: '#eac579', emissiveIntensity: .24, roughness: .8 });
  const water = mat('#8aafa1', .2, .25);
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const leafGeo = new THREE.IcosahedronGeometry(1, 1);
  const trunkGeo = new THREE.CylinderGeometry(.18, .3, 1, 7);
  const dummy = new THREE.Object3D();
  type Batch = { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[]; casts: boolean };
  const batches = new Map<string, Batch>();
  function instance(geometry: THREE.BufferGeometry, material: THREE.Material, scale: number[], pos: number[], rotation = 0, casts = true) {
    const key = geometry.uuid + material.uuid + casts;
    if (!batches.has(key)) batches.set(key, { geometry, material, matrices: [], casts });
    dummy.position.set(pos[0], pos[1], pos[2]);
    dummy.scale.set(scale[0], scale[1], scale[2]);
    dummy.rotation.set(0, rotation, 0);
    dummy.updateMatrix();
    batches.get(key)!.matrices.push(dummy.matrix.clone());
  }
  const box = (m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0, casts = true) => instance(cube, m, [w, h, d], [x, y, z], ry, casts);
  const mesh = (geo: THREE.BufferGeometry, material: THREE.Material, pos: number[], parent: THREE.Object3D = root) => {
    const object = new THREE.Mesh(geo, material);
    object.position.set(pos[0], pos[1], pos[2]); object.castShadow = true; object.receiveShadow = true;
    parent.add(object); return object;
  };

  // Ground is physical geometry; paving seams and water edges provide near-field parallax.
  box(ground, 260, .3, 230, 0, -.28, -10, 0, false);
  box(pavingAlt, 72, .15, 19, 0, .02, -18, 0, false);
  for (let row = 0; row < 32; row++) for (let col = 0; col < 4; col++) {
    box((row + col) % 3 ? paving : pavingAlt, 2.93, .1, 2.45, -4.5 + col * 3, .03, 62 - row * 2.5, 0, false);
  }
  for (const sign of [-1, 1]) {
    box(bronze, .055, .02, 81, sign * 6.15, .1, 22, 0, false);
    box(lawn, 18, .11, 42, sign * 22, .01, 15, 0, false);
    box(lawnLight, 16, .11, 25, sign * 35, .01, -10, 0, false);
    box(shade, 3.6, .16, 28, sign * 9.4, .06, 6, 0, false);
    box(water, 3.25, .04, 27.65, sign * 9.4, .15, 6, 0, false);
    for (let i = 0; i < 4; i++) box(stoneLight, 3.4, .15, .14, sign * 9.4, .18, -7 + i * 9, 0, false);
  }

  // WENBO CENTER: broad 4:1 rectilinear frame, thin square colonnade, deep glass wings.
  // Main dimensions 64 x 15.8 are artistic proportions, not measured building dimensions.
  for (let i = 0; i < 4; i++) box(stoneLight, 65 - i * .7, .16, 18 - i * .7, 0, .15 + i * .16, -26, 0, false);
  for (const sign of [-1, 1]) {
    box(stone, 5.2, 14.8, 14, sign * 29.4, 8, -29.3);
    box(stone, 24, 1.18, 14.2, sign * 20, 15.25, -29.2);
    box(shade, 21, 13.1, 5.8, sign * 18.3, 7.2, -34.3);
    box(glass, 21.5, 13.1, .2, sign * 18.4, 7.2, -28.15);
    // Glass behind the column line, not printed onto the facade.
    for (let i = 0; i <= 18; i++) box(frame, .10, 13.15, .18, sign * (7.7 + i * 1.18), 7.2, -27.98);
    for (let i = 1; i < 5; i++) box(frame, 21.2, .07, .16, sign * 18.4, .7 + i * 2.6, -27.95);
    for (const x of [8.1, 12.5, 16.9, 21.3, 25.7]) {
      box(stoneLight, .82, 13.8, .86, sign * x, 7.6, -22.6);
      box(stoneLight, 1.22, .26, 1.22, sign * x, 14.6, -22.6);
      box(stone, 1.04, .3, 1.04, sign * x, .9, -22.6);
    }
    for (let y = 1.8; y < 15; y += .8) box(joint, 5.23, .018, .02, sign * 29.4, y, -22.28, 0, false);
    for (let x = 27.6; x < 32; x += 1.2) box(joint, .015, 14.7, .025, sign * x, 8, -22.27, 0, false);
  }
  box(stoneLight, 64, 1.2, 1.2, 0, 15.25, -22.65);
  for (const sign of [-1, 1]) box(stoneLight, 24.2, .18, 14.3, sign * 20, 15.95, -29.2);
  box(stoneLight, 64.25, .18, 1.25, 0, 15.95, -22.65);
  // Open coffer grid: the centre has no slab, so daylight passes between its beams.
  for (let x = -6; x <= 6; x += 3) box(stone, .32, .55, 13, x, 14.9, -29.2);
  for (let z = -23; z >= -35; z -= 3) box(stone, 15.1, .55, .32, 0, 14.9, z);
  const drum = mesh(new THREE.CylinderGeometry(7, 7, 9.6, 64), stoneLight, [0, 5.5, -35]);
  drum.name = 'Wenbo recessed pale circular drum';
  const ringGeo = new THREE.TorusGeometry(7.012, .018, 3, 64);
  for (let y = 1.1; y <= 10; y += .8) {
    const ring = mesh(ringGeo, joint, [0, y, -35]); ring.rotation.x = Math.PI / 2;
  }
  box(glass, .18, 8.6, .05, 0, 5.9, -27.98);
  box(bronze, 3.4, .035, .08, 0, 9.25, -27.95);
  // Portal is an explicit artistic invitation into the application, not a claimed exact door survey.
  const portal = new THREE.Group(); portal.name = 'Interpretive glass entry'; root.add(portal);
  for (const sign of [-1, 1]) box(frame, .1, 4.3, .18, sign * 2.3, 2.85, -25.9);
  box(frame, 4.7, .1, .18, 0, 5.05, -25.9);
  const doorMaterial = new THREE.MeshStandardMaterial({ color: '#88aba1', transparent: true, opacity: .44, roughness: .22, metalness: .25, depthWrite: false });
  const doors: THREE.Group[] = [];
  for (const sign of [-1, 1]) {
    const door = new THREE.Group(); door.position.set(sign * 1.12, 2.8, -25.9); portal.add(door); doors.push(door);
    const pane = mesh(new THREE.BoxGeometry(2.18, 4.1, .09), doorMaterial, [0, 0, 0], door); pane.castShadow = false;
    mesh(new THREE.BoxGeometry(.055, 4.1, .12), bronze, [sign * -.98, 0, .06], door);
    mesh(new THREE.BoxGeometry(.055, .6, .16), bronze, [sign * -.78, -.15, .1], door);
  }

  // Side-campus buildings remain outside the 64-unit Wenbo frame, but within the wider welcome view.
  const libraryX = -44;
  const teachingX = 44;
  // Xu Teli Library interpretation: stone grid, grouped vertical windows, setback terraces.
  box(stone, 22, 12.8, 13, libraryX, 6.4, -15);
  box(stoneLight, 23, 1.3, 14, libraryX, 13.05, -15);
  box(shade, 18, 2, 9, libraryX, 14.5, -17.5);
  box(stone, 13, 1.3, 6, libraryX, 16, -18.8);
  for (let x = libraryX - 9; x <= libraryX + 9; x += 2.25) for (let y = 2.3; y < 13; y += 3.1) {
    box(glassLight, 1.12, 2.12, .15, x, y, -8.42);
    box(shade, .1, 2.12, .18, x, y, -8.3);
  }
  box(stoneLight, 6.3, 9.9, 2.1, libraryX, 5, -7.9);
  for (let x = libraryX - 2.2; x < libraryX + 3; x += 1.1) for (let y = 2; y < 10; y += 2.7) box(glass, .55, 1.75, .13, x, y, -6.8);
  for (let y = .7; y < 13.8; y += .8) box(joint, 22, .018, .02, libraryX, y, -8.38, 0, false);
  // Teaching building: restrained brick frame + dark-glass checkerboard + pale stair tower.
  box(brick, 24, 16.2, 12, teachingX, 8.1, -16);
  box(glass, 19.7, 13.6, .18, teachingX - 1, 8.2, -9.85);
  for (let x = teachingX - 10.8; x <= teachingX + 9; x += 2) box(frame, .09, 13.7, .18, x, 8.2, -9.7);
  for (let y = 1.5; y <= 15; y += 2.3) box(frame, 19.8, .11, .18, teachingX - 1, y, -9.66);
  box(brickDark, 25, .65, 12.4, teachingX, 16.45, -16);
  box(stone, 4.1, 17.5, 9.5, teachingX + 14, 8.75, -17);
  for (let y = 2; y < 17; y += 2.6) {
    box(stoneLight, 4.3, .37, 9.8, teachingX + 14, y, -17);
    box(glass, 1.6, 1.5, .12, teachingX + 14, y + .9, -12.18);
  }

  // Deterministic plants, different shapes rather than repeated cones.
  const animatedCrowns: { group: THREE.Group; phase: number }[] = [];
  function tree(x: number, z: number, height: number, seed: number, animate = false) {
    instance(trunkGeo, bark, [1, height * .58, 1], [x, height * .29, z]);
    const crown = animate ? new THREE.Group() : null;
    if (crown) { crown.position.set(x, height * .68, z); root.add(crown); animatedCrowns.push({ group: crown, phase: seed }); }
    for (let n = 0; n < 7; n++) {
      const a = n * 2.399 + seed;
      const r = n ? 1.1 + (n % 3) * .24 : 0;
      const sx = 1.5 + (n % 3) * .32;
      const sy = 1.6 + (n % 2) * .55;
      const pos = [Math.cos(a) * r, (n % 3) * .58 - .15, Math.sin(a) * r];
      if (crown) {
        const leaf = mesh(leafGeo, leaves[n % 4], pos, crown); leaf.scale.set(sx, sy, sx * .83); leaf.rotation.y = a;
      } else instance(leafGeo, leaves[n % 4], [sx, sy, sx * .83], [x + pos[0], height * .68 + pos[1], z + pos[2]], a);
    }
  }
  for (const s of [-1, 1]) {
    tree(s * 15, 31, 8.7, s + 1, true);
    tree(s * 18.5, 17, 8.5, 2 + s);
    tree(s * 19, 1, 8, 4 + s);
    tree(s * 24, -11, 7.3, 6 + s);
    tree(s * 34, 20, 9.1, 8 + s);
    tree(s * 36, 1, 8.4, 11 + s);
    tree(s * 65, -1, 10, 5 + s);
    for (let i = 0; i < 10; i++) {
      instance(leafGeo, leaves[(i + 1) % 4], [1.1, .65, 1.3], [s * (12.9 + (i % 2) * 1.3), .65, 25 - i * 3.9], i);
    }
  }
  // Slender paper lanterns: only two pairs, no giant festival decoration.
  const lanterns: THREE.Group[] = [];
  for (const z of [20, -2]) for (const s of [-1, 1]) {
    box(bronze, .11, 4.5, .11, s * 7.1, 2.25, z);
    box(bronze, .96, .08, .08, s * 6.72, 4.5, z);
    const lantern = new THREE.Group(); lantern.position.set(s * 6.3, 4.36, z); root.add(lantern); lanterns.push(lantern);
    const body = mesh(new THREE.CylinderGeometry(.23, .26, .7, 8), paper, [0, -.49, 0], lantern);
    body.castShadow = false;
    mesh(new THREE.CylinderGeometry(.25, .25, .055, 8), bronze, [0, -.12, 0], lantern);
    mesh(new THREE.CylinderGeometry(.28, .28, .055, 8), bronze, [0, -.85, 0], lantern);
    mesh(new THREE.CylinderGeometry(.016, .016, .18, 4), bronze, [0, -.02, 0], lantern);
    mesh(new THREE.CylinderGeometry(.018, .008, .25, 4), bronze, [0, -1, 0], lantern);
  }
  // Low modern benches and an original wayfinding slab.
  for (const s of [-1, 1]) for (const z of [9, -7]) {
    box(stone, 3.5, .22, 1, s * 13.8, .85, z);
    for (const x of [-1.2, 1.2]) box(shade, .25, .7, .8, s * 13.8 + x, .35, z);
  }
  box(stone, 2.9, 2.2, .4, -9.9, 1.1, -12.5);
  const plaqueCanvas = document.createElement('canvas'); plaqueCanvas.width = 768; plaqueCanvas.height = 384;
  const ctx = plaqueCanvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#e5e2d6'; ctx.fillRect(0, 0, 768, 384);
    ctx.fillStyle = '#426659'; ctx.font = '500 78px "Campus Serif", "Noto Serif SC", serif'; ctx.textAlign = 'center'; ctx.fillText('文博中心', 384, 174);
    ctx.font = '25px sans-serif'; ctx.fillText('W E N B O  C E N T E R', 384, 247);
    ctx.fillStyle = '#b69a68'; ctx.fillRect(120, 290, 528, 3);
    const texture = new THREE.CanvasTexture(plaqueCanvas); texture.colorSpace = THREE.SRGBColorSpace;
    const plaque = mesh(new THREE.PlaneGeometry(2.65, 1.6), new THREE.MeshBasicMaterial({ map: texture }), [-9.9, 1.25, -12.28]); plaque.castShadow = false;
  }

  // Three separate extruded paper ridgelines, each occupying real world depth.
  for (let layer = 0; layer < 3; layer++) {
    const shape = new THREE.Shape(); shape.moveTo(-150, -2);
    for (let i = 0; i <= 20; i++) {
      const x = -150 + i * 15;
      const y = 9 + Math.sin(i * 1.71 + layer) * 5 + Math.sin(i * .55 + layer) * 7 + layer * 4;
      shape.lineTo(x, Math.max(3, y));
    }
    shape.lineTo(150, -2); shape.closePath();
    const mountain = mesh(new THREE.ExtrudeGeometry(shape, { depth: 2, bevelEnabled: false }), mat(['#acc4b5', '#bed0c0', '#d0dbcc'][layer]), [0, 0, -73 - layer * 18]);
    mountain.castShadow = false; mountain.name = 'Original folded-paper ridge ' + layer;
  }
  const sky = new THREE.Mesh(new THREE.SphereGeometry(190, 24, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color('#bad4cf') }, bottom: { value: new THREE.Color('#f7edd3') } },
    vertexShader: 'varying vec3 vPosition; void main(){vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vPosition; void main(){float h=smoothstep(-.08,.7,normalize(vPosition).y);gl_FragColor=vec4(mix(bottom,top,h),1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`,
  })); sky.renderOrder = -10; root.add(sky);
  const sunDisc = mesh(new THREE.SphereGeometry(5.5, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff2cc', fog: false }), [-54, 41, -95]); sunDisc.castShadow = false;
  const ambient = new THREE.HemisphereLight('#fff4dc', '#809b84', 2.1); root.add(ambient);
  const sun = new THREE.DirectionalLight('#ffedc9', 2.7); sun.position.set(-30, 48, 25); sun.target.position.set(0, 0, -15); root.add(sun, sun.target);
  sun.castShadow = quality === 'high'; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 50, bottom: -50, near: 1, far: 140 });
  sun.shadow.bias = -.0005; sun.shadow.normalBias = .06;

  // Tiny deterministic pollen points, no random per-frame particle respawns.
  const points = new Float32Array(72 * 3);
  for (let i = 0; i < 72; i++) {
    points[i * 3] = Math.sin(i * 127.1) * 22;
    points[i * 3 + 1] = 1 + (Math.sin(i * 311.7) * .5 + .5) * 12;
    points[i * 3 + 2] = -15 + (Math.cos(i * 74.7) * .5 + .5) * 53;
  }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(points, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: '#fff2ce', size: .055, transparent: true, opacity: .64, depthWrite: false })); root.add(dust);
  dust.visible = quality === 'high';
  for (const batch of batches.values()) {
    const instanced = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
    batch.matrices.forEach((matrix, i) => instanced.setMatrixAt(i, matrix));
    instanced.castShadow = batch.casts; instanced.receiveShadow = true; instanced.computeBoundingSphere(); root.add(instanced);
  }

  return {
    root, sun,
    animate(time, door, moving) {
      for (const { group, phase } of animatedCrowns) group.rotation.z = moving ? Math.sin(time * .48 + phase) * .008 : 0;
      lanterns.forEach((lantern, i) => { lantern.rotation.z = moving ? Math.sin(time * .8 + i * 1.8) * .022 : 0; });
      doors.forEach((panel, i) => { panel.position.x = (i ? 1 : -1) * (1.12 + door * 2.1); });
      dust.position.y = moving ? Math.sin(time * .2) * .4 : 0;
      dust.visible = moving && quality === 'high';
    },
    setQuality(next) { quality = next; sun.castShadow = next === 'high'; dust.visible = next === 'high'; },
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>(); const textures = new Set<THREE.Texture>();
      root.traverse((object) => {
        const rendered = object as THREE.Mesh;
        if (rendered.geometry) geometries.add(rendered.geometry);
        if (rendered.material) for (const material of Array.isArray(rendered.material) ? rendered.material : [rendered.material]) materials.add(material);
        if (object instanceof THREE.InstancedMesh) object.dispose();
      });
      for (const material of materials) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        material.dispose();
      }
      textures.forEach(texture => texture.dispose()); geometries.forEach(geometry => geometry.dispose());
      sun.shadow.map?.dispose(); scene.remove(root);
    },
  };
}
