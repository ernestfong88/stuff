import { createContext, useContext, useEffect, useState, type RefObject } from 'react';

/**
 * Pixels per kiosk unit. CSS sizes everything in units of
 * --k = 1% of the kiosk's shorter side / 12, which is about 0.9px on a
 * 1080 x 1920 lobby screen. Components that take a pixel size (avatars)
 * read the same number from here.
 */
export const KioskUnit = createContext(0.9);

export const useKioskUnit = () => useContext(KioskUnit);

/** px per kiosk unit for an element, kept up to date as it resizes. */
export function useMeasuredUnit(ref: RefObject<HTMLElement | null>): number {
  const [k, setK] = useState(0.9);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setK(Math.min(el.clientWidth, el.clientHeight) / 100 / 12);
    measure();
    if (typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return k;
}
