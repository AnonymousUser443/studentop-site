import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { Viewport } from '../types';

export type LabelPosition = { id: string; x: number; y: number; left: boolean; unlocked: boolean };
type Box = { left: number; top: number; right: number; bottom: number };
type Label = { marker: HTMLElement; text: HTMLElement; left?: boolean; unlocked?: boolean; offset?: Box };

const intersects = (a: Box, b: Box) =>
  Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2
  && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;

const offsetBy = (box: Box, x: number, y: number): Box =>
  ({ left: box.left + x, top: box.top + y, right: box.right + x, bottom: box.bottom + y });

/** The label's shape only changes with its text, font, direction or breakpoint.
 * Camera movement translates that cached rectangle, leaving the geographic pin fixed. */
export function useLabelOcclusion(surface: RefObject<HTMLDivElement | null>, positions: readonly LabelPosition[], viewport: Viewport, disabled?: boolean) {
  const updateInputs = useRef<(positions: readonly LabelPosition[], viewport: Viewport, paused: boolean) => void>(() => {});
  useLayoutEffect(() => {
    const root = surface.current;
    const layer = root?.querySelector('.map-markers');
    if (!root || !layer) return;
    const hud = root.closest('.game-stage')?.querySelector('.hud-frame');
    const labels = new Map<string, Label>();
    const texts = new Map<Element, Label>();
    let nodesDirty = true, hudDirty = true, frame = 0, paused = true;
    let hudBoxes: Box[] = [];
    let anchors: Element[] = [];
    let latest: readonly LabelPosition[] = [];
    let view: Viewport | undefined;
    const schedule = () => { if (!paused && !frame) frame = requestAnimationFrame(update); };
    const layout = new ResizeObserver(entries => {
      for (const { target } of entries) {
        const label = texts.get(target);
        if (label) label.offset = undefined;
        else if (target === root) invalidateLayout();
        else hudDirty = true;
      }
      schedule();
    });
    const invalidateLayout = () => {
      hudDirty = true;
      for (const label of labels.values()) label.offset = undefined;
    };
    const refreshLabels = () => {
      nodesDirty = false;
      const found = new Map<string, Label>();
      for (const marker of layer.querySelectorAll<HTMLElement>('[data-map-pin]')) {
        const id = marker.dataset.mapPin!;
        const old = labels.get(id);
        if (old?.marker === marker) { found.set(id, old); continue; }
        const text = marker.querySelector<HTMLElement>('.map-marker-name')!;
        const label = { marker, text };
        texts.set(text, label); layout.observe(text); found.set(id, label);
      }
      for (const [id, label] of labels) {
        if (found.get(id) === label) continue;
        layout.unobserve(label.text); texts.delete(label.text);
      }
      labels.clear();
      for (const [id, label] of found) labels.set(id, label);
    };
    const refreshHud = () => {
      for (const anchor of anchors) layout.unobserve(anchor);
      anchors = hud ? [...hud.querySelectorAll('.hud-anchor')] : [];
      for (const anchor of anchors) layout.observe(anchor);
      hudDirty = true;
      schedule();
    };
    function update() {
      frame = 0;
      if (paused || document.hidden) return;
      if (nodesDirty) refreshLabels();
      let scene: DOMRect | undefined;
      const origin = () => scene ??= root!.getBoundingClientRect();
      if (hudDirty) {
        hudBoxes = hud?.getAttribute('aria-hidden') === 'true' ? [] :
          anchors.map(anchor => offsetBy(anchor.getBoundingClientRect(), -origin().left, -origin().top));
        hudDirty = false;
      }
      const accepted: Box[] = [];
      const changes: { marker: HTMLElement; hide: boolean }[] = [];
      for (const position of latest) {
        const label = labels.get(position.id);
        if (!label) continue;
        const { x, y, left, unlocked } = position;
        if (!label.offset || label.left !== left || label.unlocked !== unlocked) {
          label.left = left;
          label.unlocked = unlocked;
          label.offset = offsetBy(label.text.getBoundingClientRect(), -origin().left - x, -origin().top - y);
        }
        const box = offsetBy(label.offset, x, y);
        const hide = hudBoxes.some(other => intersects(box, other)) || accepted.some(other => intersects(box, other));
        if (!hide) accepted.push(box);
        if ((label.marker.dataset.labelHidden === 'true') !== hide) changes.push({ marker: label.marker, hide });
      }
      for (const { marker, hide } of changes) {
        if (hide) marker.dataset.labelHidden = 'true';
        else delete marker.dataset.labelHidden;
      }
    }
    const structure = new MutationObserver(records => {
      if (records.some(record => record.target === layer)) nodesDirty = true;
      if (records.some(record => record.target === hud)) refreshHud();
      schedule();
    });
    structure.observe(layer, { childList: true });
    if (hud) structure.observe(hud, { childList: true, attributes: true, attributeFilter: ['aria-hidden'] });
    layout.observe(root);
    refreshHud();
    updateInputs.current = (positions, viewport, disabled) => {
      if ((paused && !disabled) || view !== viewport) invalidateLayout();
      paused = disabled;
      latest = positions;
      view = viewport;
      if (paused && frame) { cancelAnimationFrame(frame); frame = 0; }
      else schedule();
    };
    return () => {
      updateInputs.current = () => {};
      layout.disconnect();
      structure.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [surface]);
  useLayoutEffect(() => { updateInputs.current(positions, viewport, Boolean(disabled)); }, [positions, viewport, disabled]);
}
