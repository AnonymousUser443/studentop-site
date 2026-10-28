import * as THREE from 'three';
import { VoxelBuilder } from './voxel.js';

const CELL = 0.62;
const FOOTPRINT_DEPTH = 1.8;
const BUILD_DISTANCE = 12;
const clamp = (value) => THREE.MathUtils.clamp(value, 0, 1);
const smooth = (value) => value * value * (3 - 2 * value);

/** After the road arrives, bricks fly in from both sides to build the crossing. */
export class VoxelPortal extends THREE.Group {
  constructor() {
    super();
    this.name = 'voxel-built-crossing';
    this.visible = false;
    const builder = new VoxelBuilder();
    const brickBox = (x, y, z, width, height, depth, color) => {
      const nx = Math.ceil(width / CELL), ny = Math.ceil(height / CELL), nz = Math.ceil(depth / CELL);
      const w = width / nx, h = height / ny, d = depth / nz;
      for (let iy = 0; iy < ny; iy++) {
        for (let ix = 0; ix < nx; ix++) {
          for (let iz = 0; iz < nz; iz++) {
            builder.box(x - width / 2 + (ix + 0.5) * w, y - height / 2 + (iy + 0.5) * h,
              z - depth / 2 + (iz + 0.5) * d, Math.max(0.01, w - 0.012), Math.max(0.01, h - 0.012), Math.max(0.01, d - 0.012), color);
          }
        }
      }
    };
    // The crossing's shoulder foundation meets the road underneath both piers.
    brickBox(0, -0.20, 0, 14.2, 0.4, 3.6, '#d2cebc');
    for (const side of [-1, 1]) {
      const x = side * 5.9;
      brickBox(x, 0.38, 0, 1.85, 0.76, 2.5, '#f6f0df');
      brickBox(x, 7.18, 0, 1.10, 12.84, 1.5, '#e9e3d2');
      brickBox(x, 12.40, 0, 1.48, 0.40, 2.0, '#b69b62');
      brickBox(x, 13.10, 0, 1.65, 0.35, 2.2, '#f5f0df');
      brickBox(x, 7.45, 0.78, 0.075, 7.70, 0.08, '#b69b62');
    }
    brickBox(0, 14.0, 0, 13.8, 0.8, 2.0, '#f6f1e2');
    brickBox(0, 14.45, 0, 14.4, 0.20, 2.4, '#b69b62');
    brickBox(0, 15.0, 0, 3.0, 0.9, 1.5, '#eee9da');
    this.bricks = builder.boxes;
    this.voxels = builder.build();
    this.voxels.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.voxels.frustumCulled = false;
    this.add(this.voxels);
    this.diamond = new THREE.Mesh(this.voxels.geometry, new THREE.MeshBasicMaterial({ color: '#fff5ce' }));
    this.diamond.scale.setScalar(0.72);
    this.diamond.rotation.set(Math.PI / 4, 0, Math.PI / 4);
    this.diamond.position.y = 12.5;
    this.diamond.visible = false;
    this.add(this.diamond);
    this.bottom = Math.min(...this.bricks.map((b) => b.y - b.height / 2));
    this.top = Math.max(...this.bricks.map((b) => b.y + b.height / 2));
    this.flights = this.bricks.map((b, index) => {
      const variation = ((index * 73 + 41) % 101) / 100;
      const side = Math.abs(b.x) > 0.01 ? Math.sign(b.x) : index % 2 ? 1 : -1;
      return {
        start: clamp((b.y - b.height / 2 - this.bottom) / (this.top - this.bottom)) * 0.72,
        side, spread: 7.0 + variation * 3.0, rise: 3.0 + variation * 2.0,
        tilt: 0.24 + variation * 0.24,
      };
    });
    this.transform = new THREE.Object3D();
    this.lastProgress = -1;
    this.buildState = { progress: 0, supported: false, visibleVoxels: 0, completedVoxels: 0, flyingVoxels: 0, totalVoxels: this.bricks.length, builtHeight: 0 };
  }

  updateConstruction(travel, road, elapsed = 0) {
    const anchor = this.userData.anchor;
    const start = road.supportReadyAt(anchor, FOOTPRINT_DEPTH);
    const supported = road.hasSettledSupport(anchor, FOOTPRINT_DEPTH, travel);
    const progress = supported ? clamp((travel - start) / BUILD_DISTANCE) : 0;
    this.buildState.supported = supported;
    this.buildState.progress = progress;
    this.buildState.startTravel = start;
    this.visible = progress > 0;
    this.diamond.visible = progress === 1;
    this.diamond.rotation.y = elapsed * 0.35;
    // A recycled or jumped crossing is reconstructed from its new road position.
    if (this.lastProgress === progress) return;
    this.lastProgress = progress;
    let visible = 0, completed = 0, builtHeight = 0;
    for (let i = 0; i < this.bricks.length; i++) {
      const b = this.bricks[i];
      const flight = this.flights[i];
      const local = progress === 0 ? 0 : progress === 1 ? 1 : clamp((progress - flight.start) / 0.28);
      if (local === 0) {
        this.transform.position.set(b.x, b.y, b.z);
        this.transform.rotation.set(0, 0, 0);
        this.transform.scale.set(0, 0, 0);
      } else {
        // Each side approaches its own half of the arch, then settles precisely.
        const remaining = 1 - smooth(local);
        this.transform.position.set(b.x + flight.side * flight.spread * remaining,
          b.y - flight.rise * Math.pow(remaining, 1.2), b.z);
        this.transform.rotation.set(flight.tilt * remaining * 0.35, 0, -flight.side * flight.tilt * remaining);
        this.transform.scale.set(b.width, b.height, b.depth);
        visible++;
        if (local === 1) completed++;
        builtHeight = Math.max(builtHeight, this.transform.position.y + b.height / 2);
      }
      this.transform.updateMatrix();
      this.voxels.setMatrixAt(i, this.transform.matrix);
    }
    this.voxels.instanceMatrix.needsUpdate = true;
    Object.assign(this.buildState, { visibleVoxels: visible, completedVoxels: completed, flyingVoxels: visible - completed, builtHeight });
  }

  constructionStats() { return { anchor: this.userData.anchor, ...this.buildState }; }
  dispose() {
    this.removeFromParent();
    this.voxels.dispose();
    this.diamond.material.dispose();
  }
}
