import * as THREE from 'three';

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const stoneMaterial = new THREE.MeshStandardMaterial({ roughness: 0.89, metalness: 0.015 });
const dummy = new THREE.Object3D();
const tint = new THREE.Color();
const atmosphereUniforms = {
  uCampusTime: { value: 0 }, uCampusNight: { value: 0 },
  uCampusFog: { value: new THREE.Color('#bed8e1') },
  uCampusLight: { value: new THREE.Vector3(0.3, 0.6, -0.8) },
};
stoneMaterial.onBeforeCompile = (shader) => {
  Object.assign(shader.uniforms, atmosphereUniforms);
  shader.vertexShader = 'varying vec3 vCampusWorld;\n' + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `
    #include <worldpos_vertex>
    vec4 campusPosition = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      campusPosition = instanceMatrix * campusPosition;
    #endif
    vCampusWorld = (modelMatrix * campusPosition).xyz;
  `);
  shader.fragmentShader = 'varying vec3 vCampusWorld;\nuniform float uCampusTime, uCampusNight;\nuniform vec3 uCampusFog, uCampusLight;\n' + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
    float mist = exp(-max(vCampusWorld.y + 9.0, 0.0) * 0.18) * (1.0 - exp(-length(vViewPosition) * 0.003));
    outgoingLight = mix(outgoingLight, uCampusFog, mist * 0.48);
    float edgeLight = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.0);
    outgoingLight += vec3(0.08, 0.13, 0.24) * edgeLight * uCampusNight * 0.15;
    #include <opaque_fragment>
  `);
};
stoneMaterial.customProgramCacheKey = () => 'campus-height-haze-moon-rim-v1';

export function updateVoxelAtmosphere(time, night, fogColor, lightDirection) {
  atmosphereUniforms.uCampusTime.value = time;
  atmosphereUniforms.uCampusNight.value = night;
  atmosphereUniforms.uCampusFog.value.copy(fogColor);
  atmosphereUniforms.uCampusLight.value.copy(lightDirection);
}

/** Collect cubes into one draw call; centers are in local space. */
export class VoxelBuilder {
  constructor() { this.boxes = []; }
  box(x, y, z, width, height, depth, color) {
    this.boxes.push({ x, y, z, width, height, depth, color });
    return this;
  }
  build(material = stoneMaterial) {
    const mesh = new THREE.InstancedMesh(unitBox, material, this.boxes.length);
    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      dummy.position.set(b.x, b.y, b.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(b.width, b.height, b.depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, tint.set(b.color));
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    return mesh;
  }
}

export function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
