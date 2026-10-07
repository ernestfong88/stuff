import { useEffect, useState } from 'react';
import { now } from '../lib/clock';

/**
 * Re-render every `intervalMs` and return the current demo-clock time.
 * Use for ticket timers and "4m ago" labels.
 */
export function useNow(intervalMs = 1000): number {
  const [t, setT] = useState(now);
  useEffect(() => {
    const id = setInterval(() => setT(now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return t;
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
