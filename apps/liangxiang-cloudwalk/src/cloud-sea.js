import * as THREE from 'three';

/** A moving noise field gives the lower cloud deck a lit, layered surface. */
export class CloudSea {
  constructor(scene) {
    this.uniforms = {
      uTime: { value: 0 }, uTint: { value: new THREE.Color('#d6e6e6') },
      uFog: { value: new THREE.Color('#bed8e1') }, uNight: { value: 0 },
    };
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1900, 1900, 1, 1), new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: `varying vec3 vWorld; void main(){ vec4 world=modelMatrix*vec4(position,1.0); vWorld=world.xyz; gl_Position=projectionMatrix*viewMatrix*world; }`,
      fragmentShader: /* glsl */`
        varying vec3 vWorld;
        uniform float uTime,uNight;
        uniform vec3 uTint,uFog;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
        float fbm(vec2 p){float v=0.0,a=0.57;for(int i=0;i<4;i++){v+=noise(p)*a;p=p*2.03+7.2;a*=0.49;}return v;}
        void main(){
          vec2 p=vWorld.xz*0.024+vec2(uTime*0.008,uTime*0.003);
          float n=fbm(p+fbm(p*0.51)*0.8);
          float light=fbm(p+vec2(0.4,-0.3));
          vec3 color=mix(uTint*mix(0.62,0.40,uNight),uTint*mix(1.12,0.78,uNight),smoothstep(0.25,0.73,n));
          color+=uTint*pow(max(light-n+0.12,0.0),2.0)*0.35;
          float distanceToCamera=length(vWorld-cameraPosition);
          color=mix(color,uFog,smoothstep(240.0,950.0,distanceToCamera));
          float opacity=smoothstep(0.18,0.63,n)*0.92;
          gl_FragColor=vec4(color,opacity);
        }
      `,
    }));
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(0, -14, -300);
    this.mesh.name = 'procedural-cloud-sea';
    scene.add(this.mesh);
  }
  update(atmosphere, elapsed) {
    this.uniforms.uTime.value = elapsed;
    this.uniforms.uNight.value = atmosphere.nightFactor;
    this.uniforms.uTint.value.copy(atmosphere.cloudColor);
    this.uniforms.uFog.value.copy(atmosphere.fog.color);
  }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
