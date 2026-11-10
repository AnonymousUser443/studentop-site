import type { ReactNode } from 'react';
import type { SlideViewProps } from '../../components/SlideView';

/** Stable page IDs are beats. A scene owns persistent visual objects across beats. */
export interface StoryScene {
  id: string;
  beats: string[];
  title: string;
  event: string;
  emotion: string;
  assets: string[];
  reuseReason: string;
}
export interface StoryProps extends SlideViewProps {
  scene: StoryScene;
  beat: number;
}
export type StoryRenderer = (props: StoryProps) => ReactNode;
