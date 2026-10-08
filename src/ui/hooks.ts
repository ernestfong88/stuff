import { useEffect, useState } from 'react';
import { useTick } from './ticker';

/**
 * Re-render every `intervalMs` and return the current demo-clock time.
 * Use for "4m ago" labels and late checks; a timer that shows seconds is
 * better as an <Elapsed> leaf. Every caller with the same interval shares
 * one timer (see ticker.ts).
 */
export function useNow(intervalMs = 1000): number {
  return useTick(intervalMs);
}

/** Current viewport width, updated on resize. */
export function useViewportWidth(): number {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}
