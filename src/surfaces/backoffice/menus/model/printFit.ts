/**
 * Fitting a printed menu to its page. Each page is measured in the browser
 * at two spacings, which gives the height of its text and of its spacing;
 * from those the spacing is stretched or squeezed first (gaps between
 * meals, courses and dishes, and a little line height), and the type is
 * scaled second, so a short menu fills the page with air rather than with
 * giant type and a long one tightens up before it gets smaller.
 */

/** Spacing never tightens below this or opens past this (1 = as designed). */
export const SPACE_MIN = 0.65;
export const SPACE_MAX = 1.7;
/** Type grows at most this much on a short menu. */
export const ZOOM_MAX = 1.25;
/** And never shrinks past this, readable or not. */
export const ZOOM_MIN = 0.4;
/** Fill this share of the page, so rounding never pushes a line onto a second sheet. */
export const FILL = 0.975;

/** The smallest a menu's reading text (dish descriptions and sides) may print, in points. */
export const READ_FLOOR_PT = 8.5;
/** Dish descriptions and sides, as designed (px at 96 per inch). */
export const BODY_PX = 12.5;

/** The smallest zoom at which text designed at `px` stays at or above the floor. */
export function readableZoom(px = BODY_PX, floorPt = READ_FLOOR_PT): number {
  return floorPt / (px * 0.75);
}

export interface Fit {
  /** Scale of the whole page's type and layout. */
  zoom: number;
  /** Multiplier on the gaps between blocks, courses and dishes. */
  space: number;
  /** The type is at or above the reading floor. */
  readable: boolean;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * The spacing and zoom that fit a page whose content is `text` tall plus
 * `space` × spacing, into `avail` (all in the same unit). The content's
 * height is `zoom × (text + space × spacing)`. A table that should fill
 * the page (the week at a glance) passes a larger `spaceMax`.
 */
export function fitPlan(text: number, space: number, avail: number, floor = readableZoom(), spaceMax = SPACE_MAX): Fit {
  const target = avail * FILL;
  const h = (sp: number) => text + space * sp;
  let sp = 1;
  let z = 1;
  if (h(1) > target) {
    // Too long: tighten the spacing, then shrink the type.
    if (space > 0) sp = clamp((target - text) / space, SPACE_MIN, 1);
    z = Math.min(1, target / h(sp));
  } else {
    // Short: open the spacing, then grow the type.
    if (space > 0) sp = clamp((target - text) / space, 1, spaceMax);
    z = clamp(target / h(sp), 1, ZOOM_MAX);
  }
  z = Math.max(z, ZOOM_MIN);
  return { zoom: r3(z), space: r3(sp), readable: z >= floor - 1e-6 };
}

/**
 * A zoom corrected by what the page measured at it: text rewraps as it is
 * scaled (and columns rebalance), so a page can come out a little taller or
 * shorter than planned. Too tall shrinks to fit; clearly short grows, up to
 * the cap; close enough stays.
 */
export function refineZoom(zoom: number, measured: number, avail: number): number {
  const target = avail * FILL;
  if (measured > avail * (FILL + 0.015)) return r3(Math.max(ZOOM_MIN, (zoom * target) / measured));
  if (measured < avail * (FILL - 0.05) && zoom < ZOOM_MAX) return r3(Math.min(ZOOM_MAX, (zoom * target) / measured));
  return zoom;
}

/**
 * Where to break a list of blocks into two pages so the taller page is as
 * short as it can be: the index the second page starts at (1 to n-1). Order
 * is kept. With fewer than two blocks, there is nothing to split (returns n).
 */
export function splitAt(heights: number[]): number {
  const n = heights.length;
  if (n < 2) return n;
  const total = heights.reduce((a, b) => a + b, 0);
  let best = 1;
  let bestMax = Infinity;
  let acc = 0;
  for (let k = 1; k < n; k++) {
    acc += heights[k - 1];
    const worst = Math.max(acc, total - acc);
    if (worst < bestMax - 1e-9) {
      bestMax = worst;
      best = k;
    }
  }
  return best;
}

/** The CSS that applies each page's fit; `availIn` is the page's printable height in inches. */
export function fitCss(fits: Fit[], availIn: number): string {
  return fits
    .map(
      (f, i) =>
        '.sheet[data-i="' +
        i +
        '"]>.fit{zoom:' +
        f.zoom +
        ';--sp:' +
        f.space +
        ';min-height:' +
        // A hair under the page, so the pinned footer never spills onto another sheet.
        r3((availIn - 0.06) / f.zoom) +
        'in}',
    )
    .join('');
}
