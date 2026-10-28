import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

const shaftsShader = {
  uniforms: {
    tDiffuse: { value: null }, tDepth: { value: null },
    uLight: { value: new THREE.Vector2(0.3, 0.6) },
    uLightColor: { value: new THREE.Color('#ffe1ad') },
    uStrength: { value: 0 }, uNight: { value: 0 }, uTime: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    varying vec2 vUv;
    uniform sampler2D tDiffuse, tDepth;
    uniform vec2 uLight;
    uniform vec3 uLightColor;
    uniform float uStrength, uNight, uTime;
    float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    void main() {
      vec3 scene=texture2D(tDiffuse,vUv).rgb;
      vec2 stepUV=(vUv-uLight)*(0.93/24.0);
      vec2 sampleUV=vUv+stepUV*hash(vUv*1234.0);
      float decay=1.0;
      float beam=0.0;
      // The actual scene depth blocks shafts behind the campus silhouettes.
      for(int i=0;i<24;i++) {
        sampleUV-=stepUV;
        if(sampleUV.x>=0.0&&sampleUV.x<=1.0&&sampleUV.y>=0.0&&sampleUV.y<=1.0) {
          float depth=texture2D(tDepth,sampleUV).x;
          vec3 sky=texture2D(tDiffuse,sampleUV).rgb;
          float openSky=smoothstep(0.99915,0.99998,depth);
          float luminance=dot(sky,vec3(0.2126,0.7152,0.0722));
          beam+=openSky*min(luminance,1.3)*decay;
        }
        decay*=0.955;
      }
      float radial=exp(-length(vUv-uLight)*1.5);
      float angle=atan(vUv.y-uLight.y,vUv.x-uLight.x);
      float bands=0.5+0.5*sin(angle*18.0+sin(angle*9.0)*1.2+uTime*0.018);
      bands=0.68+0.32*bands;
      vec3 color=scene+uLightColor*(beam/24.0)*uStrength*radial*bands*mix(1.05,0.16,uNight);
      float vignette=1.0-smoothstep(0.24,0.95,length((vUv-0.5)*vec2(1.0,0.83)));
      color*=mix(0.91,1.0,vignette);
      // Low-amplitude dithering prevents gradient banding in the dark sky.
      color+=(hash(gl_FragCoord.xy+fract(uTime)*93.0)-0.5)*mix(0.0006,0.00022,uNight);
      gl_FragColor=vec4(max(color,vec3(0.0)),1.0);
    }
  `,
};

class LightShaftPass extends ShaderPass {
  constructor() { super(shaftsShader); }
  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    this.uniforms.tDepth.value = readBuffer.depthTexture;
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
  }
}

export class SceneEffects {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.camera = camera;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, depthBuffer: true });
    target.depthTexture = new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType);
    this.composer = new EffectComposer(renderer, target);
    this.scenePass = new RenderPass(scene, camera);
    this.shafts = new LightShaftPass();
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.2, 0.65, 1.22);
    this.fxaa = new ShaderPass(FXAAShader);
    this.composer.addPass(this.scenePass);
    this.composer.addPass(this.shafts);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.fxaa);
    this.composer.addPass(new OutputPass());
    this.projected = new THREE.Vector3();
    this.resize(window.innerWidth, window.innerHeight);
  }
  update(atmosphere, elapsed) {
    this.camera.updateMatrixWorld();
    this.projected.copy(atmosphere.sunDirection).multiplyScalar(150).add(this.camera.position).project(this.camera);
    const uniforms = this.shafts.uniforms;
    uniforms.uLight.value.set(this.projected.x * 0.5 + 0.5, this.projected.y * 0.5 + 0.5);
    uniforms.uStrength.value = this.projected.z < 1 ? atmosphere.rayStrength : 0;
    uniforms.uLightColor.value.copy(atmosphere.key.color);
    uniforms.uNight.value = atmosphere.nightFactor;
    uniforms.uTime.value = elapsed;
    this.bloom.strength = atmosphere.bloomStrength * 0.62;
  }
  resize(width, height) {
    this.composer.setSize(width, height);
    const ratio = this.renderer.getPixelRatio();
    this.fxaa.uniforms.resolution.value.set(1 / (width * ratio), 1 / (height * ratio));
  }
  render(dt) { this.renderer.info.reset(); this.composer.render(dt); }
  dispose() { for (const pass of this.composer.passes) pass.dispose?.(); this.composer.dispose(); }
}
