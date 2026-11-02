import type { CampusReading } from './location/geolocation';
import type { CheckInEligibility } from './location/checkIn';
import type { QualityPreset, QualitySpec } from './settings/spec';
export type UV = { u: number; v: number };
export type MapCamera = { scale: number; x: number; y: number };
export type Viewport = { width: number; height: number };
export type IconName = 'book' | 'flower' | 'leaf' | 'scroll' | 'people' | 'settings' | 'compass' | 'chest' | 'lake' | 'gate' | 'sport' | 'star' | 'lock' | 'moon' | 'tower' | 'close' | 'sound' | 'fullscreen' | 'plus';
export type Landmark = { id: string; name: string; subtitle: string; uv: UV; icon: IconName; regionId: string; description: string; verse: string; progress: number; checkInRadius: number; isBeacon?: boolean };
export type GameSettings = {
  music: boolean; volume: number; track: number;
  /** @deprecated 派生字段：由 qualityPreset 映射（low→'low'，high/ultra→'high'）。仅 p5 环境层读取。 */
  quality: 'high' | 'low';
  reducedMotion: boolean;
  /** 画质预设，见 src/settings/spec.ts */
  qualityPreset: QualityPreset;
  qualityOverrides: Partial<QualitySpec>;
  /** 自动降级总开关；默认 true。关闭后不采样、不降档、不提示。见 V2 计划 6.3 */
  autoDegrade: boolean;
  /** 被动降级的来源档位，供设置页"恢复原档"；null 表示未被降级 */
  degradedFrom: 'high' | 'ultra' | null;
  /** 界面音效开关 */
  uiSound: boolean;
  /** 减少强闪光（光敏防护） */
  reduceFlash: boolean;
  /** UI 缩放 */
  hudScale: 0.9 | 1 | 1.12;
};
// Version 3 adds quality presets / auto-degrade / UI prefs on top of the v2 shape.
// playerUV is the virtual exploration avatar; live GPS/heading must never be persisted or synced.
export type ExplorationState = { version: 3; discoveredIds: string[]; unlockedRegionIds: string[]; playerUV: UV; settings: GameSettings };
export type AccountUser = { id: string; nickname: string; studentId: string; uid: string };
export type SceneEvent = { id: number; type: 'discover'; landmarkId: string; from: UV; to: UV; startedAt: number; duration: number };
export type PanelId = 'profile' | 'collection' | 'activities' | null;
export type MapSceneProps = { camera: MapCamera; viewport: Viewport; landmarks: Landmark[]; discoveredIds: string[]; selectedId: string | null; playerUV: UV; liveLocation?: CampusReading | null; locationFresh?: boolean; headingAngle?: number | null; event: SceneEvent | null; reducedMotion: boolean; onCameraChange: (camera: MapCamera) => void; onSelect: (id: string) => void; onVisualPosition?: (uv:UV,camera:MapCamera)=>void; disabled?: boolean; fixedTime?: number; paused?: boolean };
export type EffectsProps = { camera: MapCamera; viewport: Viewport; landmarks: Landmark[]; discoveredIds: string[]; event: SceneEvent | null; settings: GameSettings; /** 由 useSettings 解析出的最终画质参数；环境层只读这里 */ spec: QualitySpec; paused: boolean; seed?: number; fixedTime?: number };
export type HudProps = {
  progress: number; collected: number; activePanel: PanelId; selected: Landmark | null; discovered: boolean;
  checkIn: CheckInEligibility | null; state: ExplorationState; landmarks: Landmark[];
  entered: boolean; toast: string | null; isFullscreen: boolean; audioBlocked: boolean; activityReturn: boolean;
  account: AccountUser | null; loginBusy: boolean; loginError: string | null;
  onPanel: (id: PanelId) => void; onSelect: (id: string) => void; onClose: () => void;
  onExplore: () => void; onLocate: () => void; onSettings: (settings: Partial<GameSettings>) => void;
  onReset: () => void; onFullscreen: () => void; onCenter: () => void; onEnter: () => void;
  onLogin: (nickname: string, studentId: string, password: string) => void; onGuest: () => void;
  onLogout: () => void; onLoginPrompt: () => void;
};
