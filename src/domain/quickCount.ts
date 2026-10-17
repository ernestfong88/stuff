/**
 * Quick-add buttons for production counts: a chef taps +100 then +25 to get
 * 125 instead of typing it. Each tap adds to the count as it stands; Clear
 * sets it back to 0. Counts are whole numbers from 0 to COUNT_MAX.
 */

/** The amounts a quick-add button adds, smallest first. */
export const QUICK_ADD_STEPS = [25, 50, 100] as const;

/** The most a single production count can be. */
export const COUNT_MAX = 9999;

/** The count after adding `step`: an unset or invalid count counts as 0, and the result stops at `max`. */
export function addToCount(current: number | null | undefined, step: number, max: number = COUNT_MAX): number {
  const base = current != null && Number.isFinite(current) && current > 0 ? Math.floor(current) : 0;
  return Math.min(max, base + Math.max(0, Math.floor(step)));
}
