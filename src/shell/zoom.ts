/**
 * Text size. Older associates and residents asked for bigger text, so every
 * surface has A− / A+ controls. Implemented as CSS zoom on #root (5% steps,
 * 50% to 150%), saved per device.
 */
import { safeStorage } from '../lib/storage';
import { createSharedStore, useShared } from '../lib/sharedStore';

const KEY = 'kisco_text_zoom';
const clamp = (v: number) => Math.min(1.5, Math.max(0.5, Math.round(v * 20) / 20));

const zoom = createSharedStore<number>(() => clamp(parseFloat(safeStorage.get(KEY) ?? '') || 1));

function apply(v: number) {
  const root = document.getElementById('root');
  if (root) root.style.zoom = v === 1 ? '' : String(v);
}

apply(zoom.get());
zoom.subscribe(() => apply(zoom.get()));

export function setZoom(v: number): void {
  const next = clamp(v);
  safeStorage.set(KEY, String(next));
  zoom.set(next);
}

export function useZoom(): number {
  return useShared(zoom);
}
