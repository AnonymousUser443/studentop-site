import * as THREE from 'three';

const normalizeHour = (hour) => Number.isFinite(Number(hour)) ? ((Number(hour) % 24) + 24) % 24 : 12;

/** School time, expressed as a decimal hour. The upper boundary is exclusive. */
export function getPeriod(hour) {
  const h = normalizeHour(hour);
  if (h >= 6 && h < 9) return 'morning';
  if (h >= 9 && h < 17) return 'day';
  if (h >= 17 && h < 19) return 'evening';
  return 'night';
}

const PRESETS = {
  morning: {
    zenith: '#648baf', horizon: '#f6c697', lower: '#c4b6b6',
    cloudBright: '#ffe1bd', cloudShadow: '#a0a5b4', cloudTint: '#dfc3ae',
    hemiSky: '#f7debf', hemiGround: '#87929e', key: '#ffd1a0', fog: '#cebdb0',
    keyIntensity: 2.35, hemiIntensity: 1.12, fogDensity: 0.0032,
    night: 0, warm: 0.72, rays: 0.82, bloom: 0.36, cloudCover: 0.51, exposure: 1.00,
  },
  day: {
    zenith: '#2879b7', horizon: '#c6e3ea', lower: '#a2c6d3',
    cloudBright: '#f6faf4', cloudShadow: '#8faebb', cloudTint: '#edf5ef',
    hemiSky: '#d2e9fa', hemiGround: '#91a797', key: '#fff0d5', fog: '#bed8e1',
    keyIntensity: 2.35, hemiIntensity: 1.35, fogDensity: 0.0027,
    night: 0, warm: 0, rays: 0.13, bloom: 0.23, cloudCover: 0.52, exposure: 1.00,
  },
  evening: {
    zenith: '#4c6390', horizon: '#f6ab7d', lower: '#a590a2',
    cloudBright: '#ffcfaa', cloudShadow: '#6e7899', cloudTint: '#cca6a0',
    hemiSky: '#e8bec3', hemiGround: '#6d7792', key: '#ffb77a', fog: '#c49894',
    keyIntensity: 2.15, hemiIntensity: 0.91, fogDensity: 0.0034,
    night: 0, warm: 1, rays: 0.66, bloom: 0.43, cloudCover: 0.50, exposure: 0.98,
  },
  night: {
    zenith: '#071429', horizon: '#243d62', lower: '#18324d',
    cloudBright: '#6f91bb', cloudShadow: '#213959', cloudTint: '#637fa4',
    hemiSky: '#7e9dc9', hemiGround: '#263b59', key: '#bbd8ff', fog: '#223a55',
    keyIntensity: 1.12, hemiIntensity: 0.56, fogDensity: 0.0035,
    night: 1, warm: 0, rays: 0.21, bloom: 0.40, cloudCover: 0.56, exposure: 1.00,
  },
};

const COLOR_FIELDS = ['zenith', 'horizon', 'lower', 'cloudBright', 'cloudShadow', 'cloudTint', 'hemiSky', 'hemiGround', 'key', 'fog'];
const NUMBER_FIELDS = ['keyIntensity', 'hemiIntensity', 'fogDensity', 'night', 'warm', 'rays', 'bloom', 'cloudCover', 'exposure'];

function timeConfiguration(hour) {
  const period = getPeriod(hour);
  const source = PRESETS[period];
  const config = {};
  for (const field of COLOR_FIELDS) config[field] = new THREE.Color(source[field]);
  for (const field of NUMBER_FIELDS) config[field] = source[field];
  if (period === 'morning') {
    const t = (hour - 6) / 3;
    config.direction = new THREE.Vector3(-0.36, 0.11 + t * 0.22, -0.93).normalize();
    config.warm *= 1 - t * 0.35;
  } else if (period === 'day') {
    const t = (hour - 9) / 8;
    config.direction = new THREE.Vector3(-0.34 + t * 0.76, 0.40 + Math.sin(t * Math.PI) * 0.25, -0.92).normalize();
  } else if (period === 'evening') {
    const t = (hour - 17) / 2;
    config.direction = new THREE.Vector3(0.43, 0.20 - t * 0.13, -0.91).normalize();
  } else {
    // The moon remains visible for the entire night, including after midnight.
    const t = ((hour < 6 ? hour + 24 : hour) - 19) / 11;
    config.direction = new THREE.Vector3(0.35 + Math.sin(t * Math.PI) * 0.035, 0.265 + Math.sin(t * Math.PI) * 0.04, -0.91).normalize();
  }
  return config;
}

const SKY_VERTEX = /* glsl */`
  varying vec3 vSkyDirection;
  void main() {
    vSkyDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = /* glsl */`
  varying vec3 vSkyDirection;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uLower;
  uniform vec3 uCloudBright;
  uniform vec3 uCloudShadow;
  uniform vec3 uLightDirection;
  uniform float uTime;
  uniform float uNight;
  uniform float uWarm;
  uniform float uCloudCover;

  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float hash12(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }
  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x),
          mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x),
          mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float n = 0.0;
    float amplitude = 0.55;
    for (int octave = 0; octave < 4; octave++) {
      n += amplitude * noise3(p);
      p = p * 2.08 + vec3(4.3, 7.8, 2.1);
      amplitude *= 0.48;
    }
    return n;
  }

  float starField(vec3 direction) {
    vec2 uv = vec2(atan(direction.x, -direction.z) / 6.2831853 + 0.5,
                   asin(clamp(direction.y, -1.0, 1.0)) / 3.1415926 + 0.5);
    vec2 grid = uv * vec2(920.0, 430.0);
    vec2 cell = floor(grid);
    float random = hash12(cell);
    vec2 p = fract(grid) - vec2(0.25 + hash12(cell + 17.0) * 0.5, 0.25 + hash12(cell + 29.0) * 0.5);
    float point = exp(-dot(p, p) * 180.0);
    float twinkle = 0.68 + 0.32 * sin(uTime * (0.38 + random) + random * 83.0);
    float crossGlow = exp(-abs(p.x) * 150.0 - abs(p.y) * 12.0)
                    + exp(-abs(p.x) * 12.0 - abs(p.y) * 150.0);
    return (point * step(0.989, random) + crossGlow * step(0.9991, random) * 0.3) * twinkle;
  }

  vec3 moonSurface(vec2 uv) {
    float radius = length(uv);
    float normalZ = sqrt(max(0.0, 1.0 - radius * radius));
    float maria = noise3(vec3(uv * 3.4, 4.2));
    float detail = noise3(vec3(uv * 23.0, 9.7));
    float crater = 0.0;
    float rim = 0.0;
    for (int i = 0; i < 9; i++) {
      float fi = float(i);
      vec2 center = vec2(hash12(vec2(fi, 13.0)), hash12(vec2(fi, 61.0))) * 1.55 - 0.775;
      float size = 0.055 + hash12(vec2(fi, 94.0)) * 0.14;
      float distanceToCrater = length(uv - center) / size;
      crater += (1.0 - smoothstep(0.25, 0.87, distanceToCrater)) * 0.13;
      rim += exp(-pow((distanceToCrater - 0.91) * 10.0, 2.0)) * 0.055;
    }
    float shade = 0.73 + uv.y * 0.09 - uv.x * 0.055 + normalZ * 0.19;
    float surface = (0.20 + maria * 0.70 + detail * 0.08 - crater * 1.8 + rim) * shade;
    return vec3(0.91, 1.01, 1.16) * surface * 1.25;
  }

  void main() {
    vec3 direction = normalize(vSkyDirection);
    float skyHeight = pow(max(direction.y, 0.0), 0.36);
    vec3 color = mix(uHorizon, uZenith, skyHeight);
    color = mix(color, uLower, smoothstep(0.015, 0.45, -direction.y));

    float alignment = max(dot(direction, uLightDirection), 0.0);
    vec3 sunsetGlow = mix(vec3(0.34, 0.42, 0.44), vec3(1.0, 0.40, 0.13), uWarm);
    color += sunsetGlow * pow(alignment, 18.0) * mix(0.11, 0.24, uWarm) * (1.0 - uNight);
    float sunRadius = mix(0.014, 0.024, uWarm);
    float sunDisk = smoothstep(cos(sunRadius), cos(sunRadius * 0.82), alignment);
    color += mix(vec3(5.0, 4.8, 4.0), vec3(5.1, 2.2, 0.7), uWarm) * sunDisk * (1.0 - uNight);

    // The lunar disk is angular, so its size does not depend on camera travel.
    const float moonRadius = 0.070;
    float moonDisk = smoothstep(cos(moonRadius), cos(moonRadius * 0.988), alignment) * uNight;
    color += vec3(0.025, 0.060, 0.115) * pow(alignment, 38.0) * uNight;
    color += vec3(0.055, 0.075, 0.110) * pow(alignment, 230.0) * uNight;
    if (uNight > 0.001 && alignment > cos(moonRadius * 1.01)) {
      vec3 right = normalize(cross(uLightDirection, vec3(0.0, 1.0, 0.0)));
      vec3 up = normalize(cross(right, uLightDirection));
      vec2 moonUV = vec2(dot(direction, right), dot(direction, up)) / sin(moonRadius);
      color = mix(color, moonSurface(moonUV), moonDisk);
    }
    if (uNight > 0.001) {
      float stars = starField(direction) * smoothstep(0.0, 0.16, direction.y);
      color += vec3(0.48, 0.63, 0.85) * stars * uNight * (1.0 - moonDisk);
    }

    // A spherical cloud field avoids the flat, camera-facing cotton sprites.
    // The four-octave density field slowly advects independently of the road.
    vec3 samplePoint = direction * vec3(6.8, 8.0, 6.8) + vec3(uTime * 0.009, 0.0, uTime * 0.0035);
    float lowFrequency = noise3(samplePoint * 0.39 + 11.0);
    float density = fbm(samplePoint + lowFrequency * 0.7);
    float threshold = uCloudCover;
    float cloud = smoothstep(threshold, threshold + 0.145, density);
    cloud *= smoothstep(-0.035, 0.09, direction.y);
    cloud *= 1.0 - smoothstep(0.76, 0.98, direction.y);
    float shade = clamp((density - threshold) * 2.4 + direction.y * 0.4 + 0.32, 0.0, 1.0);
    vec3 cloudColor = mix(uCloudShadow, uCloudBright, shade);
    float silverEdge = pow(max(dot(direction, uLightDirection), 0.0), 30.0);
    cloudColor += mix(vec3(0.12, 0.12, 0.09), vec3(0.08, 0.12, 0.18), uNight) * silverEdge;
    float cloudOpacity = cloud * mix(0.95, 0.48, uNight) * (1.0 - moonDisk * 0.88);
    color = mix(color, cloudColor, cloudOpacity);

    // Linear HDR output. The application's OutputPass owns the display transform.
    gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
  }
`;

/** Sky, illumination and haze share one blended state, preventing mismatched modes. */
export class Atmosphere {
  constructor({ scene, camera, renderer }) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.hour = 12;
    this.period = getPeriod(this.hour);
    this.current = timeConfiguration(this.hour);
    this.target = timeConfiguration(this.hour);
    this.sunDirection = this.current.direction.clone();
    this.cloudColor = this.current.cloudTint.clone();
    this.nightFactor = 0;
    this.rayStrength = this.current.rays;
    this.bloomStrength = this.current.bloom;

    this.uniforms = {
      uZenith: { value: this.current.zenith },
      uHorizon: { value: this.current.horizon },
      uLower: { value: this.current.lower },
      uCloudBright: { value: this.current.cloudBright },
      uCloudShadow: { value: this.current.cloudShadow },
      uLightDirection: { value: this.sunDirection },
      uTime: { value: 0 },
      uNight: { value: 0 },
      uWarm: { value: 0 },
      uCloudCover: { value: this.current.cloudCover },
    };
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 20),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
        side: THREE.BackSide,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.sky.name = 'time-of-day-procedural-sky';
    this.sky.scale.setScalar(1400);
    this.sky.renderOrder = -1000;
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    this.hemi = new THREE.HemisphereLight('#d2e9fa', '#91a797', 1.35);
    this.key = new THREE.DirectionalLight('#fff0d5', 2.35);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.camera.left = -110;
    this.key.shadow.camera.right = 110;
    this.key.shadow.camera.top = 140;
    this.key.shadow.camera.bottom = -100;
    this.key.shadow.camera.near = 1;
    this.key.shadow.camera.far = 370;
    this.key.shadow.normalBias = 0.075;
    this.key.shadow.bias = -0.00012;
    this.key.target.position.set(0, 0, -70);
    scene.add(this.hemi, this.key, this.key.target);
    this.previousFog = scene.fog;
    this.fog = new THREE.FogExp2(this.current.fog, this.current.fogDensity);
    scene.fog = this.fog;
    this.apply();
  }

  setTime(hour, instant = false) {
    this.hour = normalizeHour(hour);
    this.period = getPeriod(this.hour);
    this.target = timeConfiguration(this.hour);
    if (instant) {
      for (const field of COLOR_FIELDS) this.current[field].copy(this.target[field]);
      for (const field of NUMBER_FIELDS) this.current[field] = this.target[field];
      this.current.direction.copy(this.target.direction);
      this.apply();
    }
  }

  apply() {
    const c = this.current;
    this.sunDirection.copy(c.direction).normalize();
    this.cloudColor.copy(c.cloudTint);
    this.nightFactor = c.night;
    this.rayStrength = c.rays;
    this.bloomStrength = c.bloom;
    this.uniforms.uNight.value = c.night;
    this.uniforms.uWarm.value = c.warm;
    this.uniforms.uCloudCover.value = c.cloudCover;
    this.hemi.color.copy(c.hemiSky);
    this.hemi.groundColor.copy(c.hemiGround);
    this.hemi.intensity = c.hemiIntensity;
    this.key.color.copy(c.key);
    this.key.intensity = c.keyIntensity;
    this.key.position.copy(this.sunDirection).multiplyScalar(165).add(this.key.target.position);
    this.fog.color.copy(c.fog);
    this.fog.density = c.fogDensity;
    this.renderer.toneMappingExposure = c.exposure;
  }

  update(dt, elapsed) {
    // Close 95% of the difference over ~2 seconds, without an abrupt mode cut.
    const alpha = 1 - Math.exp(-Math.max(0, dt) * 1.5);
    for (const field of COLOR_FIELDS) this.current[field].lerp(this.target[field], alpha);
    for (const field of NUMBER_FIELDS) this.current[field] = THREE.MathUtils.lerp(this.current[field], this.target[field], alpha);
    this.current.direction.lerp(this.target.direction, alpha).normalize();
    this.uniforms.uTime.value = elapsed;
    this.sky.position.copy(this.camera.position);
    this.apply();
  }

  getState() {
    const a = this.current.zenith, b = this.target.zenith;
    return { hour: this.hour, period: this.period, transitionError: Math.max(Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b), Math.abs(this.current.night - this.target.night), this.current.direction.distanceTo(this.target.direction)) };
  }

  dispose() {
    this.scene.remove(this.sky, this.hemi, this.key, this.key.target);
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.key.shadow.map?.dispose();
    if (this.scene.fog === this.fog) this.scene.fog = this.previousFog;
  }
}
