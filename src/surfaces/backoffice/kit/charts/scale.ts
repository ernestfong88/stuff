/**
 * Geometry for the hand-built SVG charts. Pure functions, so the maths is
 * tested apart from the drawing.
 */

/** Map a value onto a pixel height between a floor and a ceiling (clamped, never negative). */
export function barHeight(value: number, floor: number, ceil: number, plotHeight: number): number {
  if (ceil <= floor) return 0;
  const t = (value - floor) / (ceil - floor);
  return Math.max(0, Math.min(1, t)) * plotHeight;
}

/** x position and width of each of `count` bars across `width`, with `gap` between them. */
export function bandLayout(count: number, width: number, gap: number): Array<{ x: number; w: number }> {
  if (count <= 0 || width <= 0) return [];
  const g = Math.min(gap, (width / count) * 0.4);
  const w = Math.max(1, (width - g * (count - 1)) / count);
  return Array.from({ length: count }, (_, i) => ({ x: i * (w + g), w }));
}

/** Gap between bars that keeps 28 days readable while 7 days stay chunky. */
export function barGap(count: number): number {
  return count > 14 ? 2 : count > 7 ? 4 : 6;
}

const TAU = Math.PI * 2;

/**
 * SVG path of a ring slice from angle a0 to a1 (radians, clockwise from 12
 * o'clock) between radii r0 (inner) and r1 (outer). A full circle is drawn
 * as two halves, because one arc cannot start and end on the same point.
 */
export function ringSlicePath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  if (a1 - a0 >= TAU - 1e-6) {
    const mid = a0 + Math.PI;
    return ringSlicePath(cx, cy, r0, r1, a0, mid) + ringSlicePath(cx, cy, r0, r1, mid, a0 + TAU);
  }
  const pt = (r: number, a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)].map((v) => +v.toFixed(3));
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = pt(r1, a0);
  const [x1, y1] = pt(r1, a1);
  const [x2, y2] = pt(r0, a1);
  const [x3, y3] = pt(r0, a0);
  return `M${x0} ${y0}A${r1} ${r1} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`;
}

/** Start and end angles for slices of the given values, in order, filling the circle. */
export function sliceAngles(values: number[]): Array<{ a0: number; a1: number }> {
  const total = values.reduce((s, v) => s + Math.max(0, v), 0);
  let a = 0;
  return values.map((v) => {
    const a0 = a;
    a += total ? (Math.max(0, v) / total) * TAU : 0;
    return { a0, a1: a };
  });
}

/** Round a percentage share so it reads well (never "0%" for a non-zero part). */
export function sharePct(part: number, total: number): number {
  if (!total || part <= 0) return 0;
  return Math.max(1, Math.round((part / total) * 100));
}
