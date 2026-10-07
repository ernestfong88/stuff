/**
 * Pure helpers for arranging a floor plan: snapping, keeping items on the
 * plan, and naming new tables.
 */
import type { FloorBand } from '../../../domain/types';
import { sectionAt, type PlanItem } from './layout';

/** Positions snap to half a percent of the plan. */
export const SNAP = 0.5;

export const snap = (v: number) => Math.round(v / SNAP) * SNAP;

/** Keep an item fully on the plan. */
export function clampItem(it: PlanItem): PlanItem {
  const w = Math.min(100, Math.max(2, it.w));
  const h = Math.min(100, Math.max(2, it.h));
  return { ...it, w, h, x: Math.min(100 - w, Math.max(0, snap(it.x))), y: Math.min(100 - h, Math.max(0, snap(it.y))) };
}

/** Move an item by a delta in percent, snapped and kept on the plan. */
export function moveItem(it: PlanItem, dx: number, dy: number): PlanItem {
  return clampItem({ ...it, x: it.x + dx, y: it.y + dy });
}

export type NewKind = 'table' | 'round' | 'wall';

/** "SQ 17": the most common label prefix in the room and the next free number. */
export function nextTableLabel(items: PlanItem[], fallbackPrefix: string): string {
  const seats = items.filter((t) => t.type === 'seat');
  const counts = new Map<string, number>();
  let max = 0;
  for (const t of seats) {
    const m = /^(.*?)\s*(\d+)$/.exec(t.label);
    if (!m) continue;
    counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
    max = Math.max(max, Number(m[2]));
  }
  const prefix = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallbackPrefix;
  return `${prefix} ${max + 1}`;
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The first place, reading left to right and top to bottom, where a w × h item touches nothing. */
export function freeSpot(items: Box[], w: number, h: number): { x: number; y: number } {
  for (let y = 8; y + h <= 98; y += 2) {
    for (let x = 4; x + w <= 98; x += 2) {
      const box = { x, y, w: w + 1, h: h + 1 };
      if (!items.some((it) => overlaps(box, { ...it, w: it.w + 1, h: it.h + 1 }))) return { x, y };
    }
  }
  return { x: 4, y: 8 };
}

/** A new table or wall in the first free spot on the plan. */
export function newItem(kind: NewKind, items: PlanItem[], bands: FloorBand[], id: string, roomName: string): PlanItem {
  const size = kind === 'wall' ? { w: 20, h: 3 } : { w: 11, h: 10 };
  const { x, y } = freeSpot(items, size.w, size.h);
  if (kind === 'wall') return { id, label: 'Wall', section: '', type: 'wall', x, y, ...size };
  return {
    id,
    label: nextTableLabel(items, roomName.slice(0, 2).toUpperCase()),
    section: sectionAt(bands, x + size.w / 2, y + size.h / 2),
    type: 'seat',
    x,
    y,
    ...size,
    ...(kind === 'round' ? { shape: 'round' } : {}),
  };
}
