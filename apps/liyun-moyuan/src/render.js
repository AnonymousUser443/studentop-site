import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function createMaterials() {
  const palette = { wood: ['#a87840',.43], woodDark:['#533b25',.47], bamboo:['#c49c5e',.5], plaster:['#dfd9c7',.91],
    floor:['#c8bd9e',.63], ivory:['#ece9dc',.52], brass:['#a98c51',.3], black:['#252824',.46],
    ceramic:['#dce2d5',.23], ink:['#36392f',.9], purple:['#501f45',.88], leaf:['#416035',.68], soil:['#30291e',1],paper:['#e4d9bb',.96] };
  const M = Object.fromEntries(Object.entries(palette).map(([name,[color,roughness]]) => {
    const mat = new THREE.MeshStandardMaterial({color,roughness,metalness:name==='brass'?.67:0}); mat.name=name; return [name,mat];
  }));
  M.glass = new THREE.MeshPhysicalMaterial({ color:'#789491', roughness:.28, metalness:.15, transparent:true, opacity:.62 }); M.glass.name='glass';
  M.emissive = new THREE.MeshStandardMaterial({color:'#fff4d6',emissive:'#fff4d6',emissiveIntensity:2.5}); M.emissive.name='emissive';
  return M;
}

// World-space grain survives instancing and follows the small stepped timber.
export function applySurfaceShaders(group) {
  const seen = new Set();
  group.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = !object.material?.transparent; object.receiveShadow = true;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (seen.has(material) || !material.isMeshStandardMaterial || material.map) continue;
      seen.add(material);
      const name = material.name.toLowerCase();
      const timber = /wood|bamboo|floor/.test(name);
      const fabric = /purple|paper|plaster|ivory/.test(name);
      if (!timber && !fabric) continue;
      material.onBeforeCompile = shader => {
        shader.vertexShader = 'varying vec3 vMoyuanWorld;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          vec4 grainPos = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            grainPos = instanceMatrix * grainPos;
          #endif
          vMoyuanWorld = (modelMatrix * grainPos).xyz;`);
        shader.fragmentShader = 'varying vec3 vMoyuanWorld;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          vec3 p = vMoyuanWorld;
          float fleck = fract(sin(dot(floor(p*620.0),vec3(12.9898,78.233,37.719)))*43758.5453);
          ${timber ? `float grain = sin(p.x*173.0 + sin(p.z*5.1)*4.0 + sin(p.y*31.0)*.6);
          float fineGrain = sin(p.x*541.0 + sin(p.z*13.0)*3.0);
          float knot = sin(length(vec2(p.x*6.0,p.z*.38))*23.0);
          diffuseColor.rgb *= .94 + grain*.055 + fineGrain*.025 + knot*.018 + fleck*.055;`
          : `diffuseColor.rgb *= .965 + fleck*.065;`}`);
      };
      material.customProgramCacheKey = () => 'moyuan-surface-v1-' + (timber?'wood':'fiber');
      material.needsUpdate = true;
    }
  });
}

const GradeShader = {
  uniforms: { tDiffuse:{value:null}, uNight:{value:0}, uTime:{value:0} },
  vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader: `uniform sampler2D tDiffuse;uniform float uNight;uniform float uTime;varying vec2 vUv;
  void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;
    vec2 q=vUv-.5;float vig=1.0-.22*dot(q,q);
    c*=mix(vec3(1.03,1.015,.98),vec3(1.025,.99,.94),uNight);
    float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233))+floor(uTime*12.0))*43758.5453);
    gl_FragColor=vec4(max(c*vig+(grain-.5)*.0015,vec3(0.0)),1.0);}`
};

export function createRenderer(host) {
  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.info.autoReset=false;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1,2));
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.07;
  host.append(renderer.domElement);
  const scene=new THREE.Scene(); scene.background=new THREE.Color('#1c2e2a'); scene.fog=new THREE.FogExp2('#c8bda2',.008);
  const camera=new THREE.PerspectiveCamera(55,1,.06,120);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=.3;controls.maxDistance=40;controls.maxPolarAngle=Math.PI*.495;
  controls.zoomSpeed=.65; controls.rotateSpeed=.45; controls.panSpeed=.6;
  const pmrem=new THREE.PMREMGenerator(renderer);const roomEnv=new RoomEnvironment();
  const envTarget=pmrem.fromScene(roomEnv,.04); scene.environment=envTarget.texture; scene.environmentIntensity=.24; roomEnv.dispose(); pmrem.dispose();
  const hemi=new THREE.HemisphereLight('#edf5ed','#76604a',1.0);scene.add(hemi);
  const sun=new THREE.DirectionalLight('#fff1ce',3.4);sun.position.set(9,8,1);sun.target.position.set(-1,0,-1);scene.add(sun,sun.target);
  sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);sun.shadow.camera.left=-11;sun.shadow.camera.right=11;sun.shadow.camera.top=11;sun.shadow.camera.bottom=-11;
  sun.shadow.camera.near=.5;sun.shadow.camera.far=35;sun.shadow.normalBias=.025;sun.shadow.bias=-.00015;sun.shadow.radius=3;
  const bounce=new THREE.DirectionalLight('#dbdcbd',.6);bounce.position.set(-5,3,3);scene.add(bounce);
  const lamps=[];
  for(const z of [-4.8,-1.6,1.6,4.8]){
    const light=new THREE.PointLight('#ffe4ad',17,6,2);light.position.set(3.9,2.85,z+1.3);scene.add(light);lamps.push(light);
  }
  for(const x of [-2.4,2.4])for(const z of [-4,0,4]){const light=new THREE.PointLight('#f4f2dd',9,7,2);light.position.set(x,3.15,z);scene.add(light);lamps.push(light);}
  const teaLight=new THREE.SpotLight('#ffdc9d',45,10,.75,.8,1.7);teaLight.position.set(0,3.15,-4.6);teaLight.target.position.set(0,1.3,-6.1);scene.add(teaLight,teaLight.target);
  teaLight.castShadow=true;teaLight.shadow.mapSize.set(2048,2048);teaLight.shadow.bias=-.0002;
  const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
  const ao=new SSAOPass(scene,camera,1,1);ao.kernelRadius=.32;ao.minDistance=.001;ao.maxDistance=.12;composer.addPass(ao);
  const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.15,.45,1.25);composer.addPass(bloom);
  const grade=new ShaderPass(GradeShader);composer.addPass(grade);composer.addPass(new OutputPass());
  const dustGeometry=new THREE.BufferGeometry();const coords=new Float32Array(1500*3);let seed=1947;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<coords.length;i+=3){coords[i]=(random()-.5)*9;coords[i+1]=random()*3.2;coords[i+2]=(random()-.5)*14;}
  dustGeometry.setAttribute('position',new THREE.BufferAttribute(coords,3));
  const dust=new THREE.Points(dustGeometry,new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{uTime:{value:0},uStrength:{value:.55}},vertexShader:`uniform float uTime;varying float alpha;void main(){vec3 p=position;p.x+=sin(uTime*.1+p.z)*.08;p.y+=sin(uTime*.12+p.x*2.0)*.04;vec4 mv=modelViewMatrix*vec4(p,1.0);alpha=smoothstep(1.0,4.0,p.x)*.5+.12;gl_PointSize=clamp(18.0/-mv.z,1.0,3.0);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float uStrength;varying float alpha;void main(){float a=1.0-smoothstep(.05,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(vec3(1.0,.84,.58),a*alpha*uStrength);}`}));scene.add(dust);
  const shafts=new THREE.Group(); scene.add(shafts);
  const shaftMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    uniforms:{uStrength:{value:.045}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform float uStrength;varying vec2 vUv;void main(){float s=pow(max(sin(vUv.x*3.14159265),0.0),2.0);float stripe=.65+.35*sin(vUv.x*95.0);float a=s*stripe*pow(1.0-vUv.y,1.8)*uStrength;gl_FragColor=vec4(1.0,.87,.61,a);}`});
  for(const z of [-4.8,-1.6,1.6,4.8]){const ray=new THREE.Mesh(new THREE.PlaneGeometry(2.1,5),shaftMaterial);ray.position.set(2.9,1.65,z);ray.rotation.set(0,-Math.PI/2,.85);shafts.add(ray);}
  function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);composer.setSize(w,h);}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  let disposed=false;
  return {scene,camera,controls,renderer,composer,
    render(time){if(disposed)return;renderer.info.reset();controls.update();dust.material.uniforms.uTime.value=time;grade.uniforms.uTime.value=time;composer.render();},
    setNight(value){sun.intensity=THREE.MathUtils.lerp(3.4,.12,value);hemi.intensity=THREE.MathUtils.lerp(1,.45,value);bounce.intensity=THREE.MathUtils.lerp(.6,.2,value);
      lamps.forEach((light,i)=>light.intensity=(i<4?17:9)*(1+value*.85));teaLight.intensity=45+value*12;grade.uniforms.uNight.value=value;
      dust.material.uniforms.uStrength.value=.55*(1-value*.7);shaftMaterial.uniforms.uStrength.value=.045*(1-value);},
    setDetail(enabled){ao.enabled=enabled;bloom.enabled=enabled;dust.visible=enabled;shafts.visible=enabled;},
    dispose(){
      if(disposed)return;disposed=true;observer.disconnect();controls.dispose();composer.dispose();
      const geometries=new Set(),materials=new Set(),textures=new Set();
      scene.traverse(object=>{
        if(object.geometry)geometries.add(object.geometry);
        const list=object.material?(Array.isArray(object.material)?object.material:[object.material]):[];
        for(const material of list){materials.add(material);for(const key of ['map','alphaMap','normalMap','roughnessMap','metalnessMap','emissiveMap'])if(material[key])textures.add(material[key]);}
      });
      textures.forEach(texture=>texture.dispose());materials.forEach(material=>material.dispose());geometries.forEach(geometry=>geometry.dispose());
      envTarget.dispose();renderer.dispose();
    }
  };
}
