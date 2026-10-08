/**
 * Pure helpers for arranging a floor plan: snapping, keeping items on the
 * plan, and naming new tables.
 */
import type { FloorBand } from '../../../domain/types';
import { sectionAt, type PlanItem } from '../../../store/floorLayout';

/** Positions snap to half a percent of the plan. */
export const SNAP = 0.5;

export const snap = (v: number) => Math.round(v / SNAP) * SNAP;

/** Keep an item fully on the plan, and a table big enough to read and tap. */
export function clampItem(it: PlanItem): PlanItem {
  const min = minSize(it);
  const w = Math.min(100, Math.max(min, it.w));
  const h = Math.min(100, Math.max(min, it.h));
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

// ─── Reshaping, copying and lining up ────────────────────────────────────

/** A resize handle: which edges it moves (n, s, e, w, or a corner). */
export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Smallest wall, in percent of the plan. */
export const MIN_SIZE = 2;

/** Smallest table, in percent of the plan: its name still fits, and a finger can hit it. */
export const MIN_SEAT = 6;

/** The smallest an item can be made, either way. */
export const minSize = (it: Pick<PlanItem, 'type'>) => (it.type === 'seat' ? MIN_SEAT : MIN_SIZE);

/**
 * Drag a handle by a delta in percent: the opposite edge stays put, sizes
 * snap, and the item stays on the plan and at least minSize across.
 */
export function resizeItem(it: PlanItem, handle: Handle, dx: number, dy: number): PlanItem {
  const MIN = minSize(it);
  let { x, y, w, h } = it;
  const right = x + w;
  const bottom = y + h;
  if (handle.includes('e')) w = Math.min(100 - x, Math.max(MIN, snap(w + dx)));
  if (handle.includes('s')) h = Math.min(100 - y, Math.max(MIN, snap(h + dy)));
  if (handle.includes('w')) {
    x = Math.max(0, Math.min(right - MIN, snap(x + dx)));
    w = right - x;
  }
  if (handle.includes('n')) {
    y = Math.max(0, Math.min(bottom - MIN, snap(y + dy)));
    h = bottom - y;
  }
  return { ...it, x, y, w, h };
}

/** Turn an item a quarter: width and height trade, around its centre, kept on the plan. */
export function turnItem(it: PlanItem): PlanItem {
  const cx = it.x + it.w / 2;
  const cy = it.y + it.h / 2;
  return clampItem({ ...it, w: it.h, h: it.w, x: cx - it.h / 2, y: cy - it.w / 2 });
}

/**
 * Copies of some items, placed just beside the originals (or at
 * `at`, the top-left of the group, when pasting), each table with the next
 * free name in the room.
 */
export function copyItems(all: PlanItem[], picked: PlanItem[], newId: () => string, at?: { x: number; y: number }): PlanItem[] {
  if (!picked.length) return [];
  const left = Math.min(...picked.map((t) => t.x));
  const top = Math.min(...picked.map((t) => t.y));
  const right = Math.max(...picked.map((t) => t.x + t.w));
  const bottom = Math.max(...picked.map((t) => t.y + t.h));
  // Beside the originals (to the right, else below), so the copy is easy to grab.
  const besideRight = right + 1 + (right - left) <= 100;
  const dx = at ? at.x - left : besideRight ? right - left + 1 : 0;
  const dy = at ? at.y - top : besideRight ? 0 : bottom - top + 1;
  const named = [...all];
  const copies = picked.map((t) => {
    const copy = clampItem({ ...t, id: newId(), x: t.x + dx, y: t.y + dy });
    if (copy.type === 'seat') copy.label = nextTableLabel(named, t.label.replace(/\s*\d+$/, '') || 'T');
    named.push(copy);
    return copy;
  });
  // One copy that would land on a neighbour goes to the first free spot instead.
  if (!at && copies.length === 1 && all.some((x) => overlaps(copies[0], x))) return [{ ...copies[0], ...freeSpot(all, copies[0].w, copies[0].h) }];
  return copies;
}

export type Align = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

/** Line items up on the group's left, centre or right edge (or top, middle, bottom). */
export function alignItems(items: PlanItem[], how: Align): PlanItem[] {
  if (items.length < 2) return items;
  const left = Math.min(...items.map((t) => t.x));
  const right = Math.max(...items.map((t) => t.x + t.w));
  const top = Math.min(...items.map((t) => t.y));
  const bottom = Math.max(...items.map((t) => t.y + t.h));
  return items.map((t) => {
    switch (how) {
      case 'left':
        return clampItem({ ...t, x: left });
      case 'right':
        return clampItem({ ...t, x: right - t.w });
      case 'center':
        return clampItem({ ...t, x: (left + right) / 2 - t.w / 2 });
      case 'top':
        return clampItem({ ...t, y: top });
      case 'bottom':
        return clampItem({ ...t, y: bottom - t.h });
      default:
        return clampItem({ ...t, y: (top + bottom) / 2 - t.h / 2 });
    }
  });
}

/** Space three or more items evenly across (or down), keeping the two outer ones where they are. */
export function distributeItems(items: PlanItem[], axis: 'across' | 'down'): PlanItem[] {
  if (items.length < 3) return items;
  const k = axis === 'across' ? 'x' : 'y';
  const size = axis === 'across' ? 'w' : 'h';
  const order = [...items].sort((a, b) => a[k] - b[k]);
  const first = order[0];
  const last = order[order.length - 1];
  const gap = (last[k] + last[size] - first[k] - order.reduce((n, t) => n + t[size], 0)) / (order.length - 1);
  let at = first[k];
  const placed = new Map<string, PlanItem>();
  for (const t of order) {
    placed.set(t.id, clampItem({ ...t, [k]: at }));
    at += t[size] + gap;
  }
  return items.map((t) => placed.get(t.id) ?? t);
}
