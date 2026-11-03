import type { GameSettings } from '../src/types';
/** Shared browser/API defaults, including control, message and custom-quality preferences. */
export const DEFAULT_SETTINGS: GameSettings;
/** Rebuilds the complete settings whitelist; nested overrides are copied and validated. */
export function sanitizeSettings(input: unknown): GameSettings;
