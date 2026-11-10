import type { StoryScene } from './types';
import { scenes0 } from './scenes0';
import { scenes12 } from './scenes12';
import { scenes34 } from './scenes34';
import { scenes5 } from './scenes5';
import { scenes678 } from './scenes678';

export const storyScenes = [...scenes0, ...scenes12, ...scenes34, ...scenes5, ...scenes678];
const byBeat = new Map<string, StoryScene>();
for (const scene of storyScenes) for (const id of scene.beats) {
  if (byBeat.has(id)) throw new Error(`重复场景节拍 ${id}`);
  byBeat.set(id, scene);
}
export const storyFor = (id: string) => byBeat.get(id);
export const sceneKey = (id: string) => storyFor(id)?.id ?? id;
