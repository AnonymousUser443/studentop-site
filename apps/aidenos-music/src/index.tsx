import { createRoot, type Root } from "react-dom/client";
import { createMusicRuntime } from "./runtime";
import { createMusicService } from "./services";
import { MusicApp, MusicSurface } from "./ui";
import type { MusicHost, MusicRuntime, MusicService } from "./domain";

let runtime: MusicRuntime | undefined, service: MusicService | undefined;
export function ensureMusicRuntime() {
  service ??= createMusicService();
  runtime ??= createMusicRuntime(service);
  return { runtime, service };
}
export function mountMusicApp(container: HTMLElement, host: MusicHost) {
  const { runtime, service } = ensureMusicRuntime();
  const root = createRoot(container);
  let visible = true,
    disposed = false;
  const draw = () => {
    if (!disposed)
      root.render(
        <MusicApp
          runtime={runtime}
          service={service}
          host={host}
          visible={visible}
        />,
      );
  };
  const off = host.onStateChange(draw);
  draw();
  return {
    setVisibility(value: boolean) {
      if (visible === value) return;
      visible = value;
      draw();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      off();
      root.unmount();
    },
  };
}
export function mountMusicSurface(
  container: HTMLElement,
  host: MusicHost,
  type: "mini" | "lock" | "tray",
) {
  const { runtime } = ensureMusicRuntime();
  const root: Root = createRoot(container);
  let disposed = false,
    visible = true;
  const draw = () => {
    if (!disposed)
      root.render(
        <MusicSurface
          runtime={runtime}
          host={host}
          type={type}
          visible={visible}
        />,
      );
  };
  const off = host.onStateChange(draw);
  draw();
  return {
    setVisibility(value: boolean) {
      if (value === visible) return;
      visible = value;
      draw();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      off();
      root.unmount();
    },
  };
}
