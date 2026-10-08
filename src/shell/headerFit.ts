/**
 * How far a tablet header has had to fold to fit on one row. The header
 * measures itself: it starts with everything spelled out and steps up one
 * level at a time, before the frame is painted, until nothing overflows.
 * That covers every tablet, both ways round, and the A−/A+ text sizes,
 * which no viewport breakpoint can see.
 *
 *   0  everything spelled out
 *   1  chips go short, page buttons keep their icons only
 *   2  the view buttons keep their icons only
 *   3  page buttons fold into a More menu
 *   4  the least-used chips step aside, text size drops its %
 *   5  still too wide (very large text): the row wraps, and nothing is cut off
 */
import { createContext, useContext, useEffect, useLayoutEffect, useState, type RefObject } from 'react';

export const MAX_HEADER_FIT = 5;

export const HeaderFitContext = createContext(0);

/** This header's fold level (0 outside a measured header). */
export function useHeaderFit(): number {
  return useContext(HeaderFitContext);
}

const overflows = (el: HTMLElement | null) => !!el && el.scrollWidth > el.clientWidth;

/**
 * Fold level for a header row. `parts` are the header and any shrinking,
 * scrolling group inside it; any of them overflowing steps the level up.
 * The level starts over when the row gets wider or `resetKey` changes.
 */
export function useFitLevel(parts: ReadonlyArray<RefObject<HTMLElement | null>>, resetKey?: string): number {
  const [level, setLevel] = useState(0);
  const [key, setKey] = useState(resetKey);
  const [checks, recheck] = useState(0);
  if (key !== resetKey) {
    setKey(resetKey);
    setLevel(0);
  }

  // Before paint, on mount, after each fold and whenever the observers below ask:
  // still too wide, so fold one more step. (Not after every render: that forced a
  // layout read each time anything in the header changed.)
  useLayoutEffect(() => {
    if (level < MAX_HEADER_FIT && parts.some((r) => overflows(r.current))) setLevel(level + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the refs are stable; checks and resetKey are the triggers
  }, [level, checks, resetKey]);

  useEffect(() => {
    const row = parts[0]?.current;
    if (!row || typeof ResizeObserver === 'undefined') return;
    let width = row.clientWidth;
    const ro = new ResizeObserver(() => {
      const w = row.clientWidth;
      // Wider (turned to landscape, smaller text): start over from full labels.
      if (w > width + 1) setLevel(0);
      else recheck((n) => n + 1);
      width = w;
    });
    ro.observe(row);
    // A count or a name changed length, or a chip changed look: check again.
    const mo = new MutationObserver(() => recheck((n) => n + 1));
    mo.observe(row, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the refs are stable, so observe once
  }, []);

  return level;
}
