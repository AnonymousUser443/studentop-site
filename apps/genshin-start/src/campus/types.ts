export type CampusPhase = 'loading' | 'welcome' | 'journey' | 'arrival' | 'entering' | 'fallback';
export type Quality = 'low' | 'high';
export interface CampusStatus {
  phase: CampusPhase;
  progress: number;
  reducedMotion: boolean;
  paused: boolean;
  quality: Quality;
}
export interface CampusSnapshot extends CampusStatus {
  camera: { position: number[]; target: number[]; fov: number } | null;
  performance: {
    frames: number; drawCalls: number; triangles: number;
    geometries: number; textures: number; fps: number;
    dpr: number; fpsLimit: number; backgroundPaused: boolean;
    manualClock: boolean; contextLost: boolean;
    viewport: { width: number; height: number };
  } | null;
}
export interface CampusQA {
  readonly phase: CampusPhase;
  readonly camera: CampusSnapshot['camera'];
  readonly performance: CampusSnapshot['performance'];
  snapshot(): CampusSnapshot;
  start(): void;
  advance(seconds: number): CampusSnapshot;
  resume(): void;
  arrive(): void;
  enter(): void;
  loseContext(): void;
}
export interface CampusController {
  start(): void;
  arrive(): void;
  enter(): void;
  togglePause(): void;
  advance(seconds: number): void;
  resume(): void;
  snapshot(): CampusSnapshot;
  loseContext(): void;
  dispose(): void;
}
declare global { interface Window { __CAMPUS_QA__?: CampusQA } }
