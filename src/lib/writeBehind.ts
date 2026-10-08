/**
 * localStorage writes, a moment behind the change. Serialising every order
 * (or the whole menu) on each tap is the slow part of saving, and a run of
 * taps only needs the last one on disk: a store hands over a write here,
 * and the latest write per key runs once, WRITE_DELAY_MS after the first
 * change. The in-memory state, the other tabs (BroadcastChannel) and the
 * screen update at once; only the disk copy waits.
 *
 * Nothing is lost on the way out: pending writes run when the page is hidden
 * or left (pagehide, visibilitychange), and any write after that runs at
 * once; a store flushes its own write when it is reset. Outside a browser
 * (unit tests) writes run straight away.
 */

/** How long a write waits for more changes before it runs. */
export const WRITE_DELAY_MS = 300;

const pending = new Map<string, () => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let delay = typeof document === 'undefined' ? 0 : WRITE_DELAY_MS;
/** The page is being left: a timer might never run, so writes happen at once. */
let leaving = false;

/** Queue the write for `key`, replacing any write already waiting for it. */
export function writeBehind(key: string, write: () => void): void {
  if (delay <= 0 || leaving) {
    pending.delete(key);
    write();
    return;
  }
  pending.set(key, write);
  timer ??= setTimeout(() => flushWrites(), delay);
}

/** Run the waiting write for `key` now, or every waiting write. */
export function flushWrites(key?: string): void {
  if (key != null) {
    const write = pending.get(key);
    pending.delete(key);
    write?.();
  } else {
    const writes = [...pending.values()];
    pending.clear();
    writes.forEach((w) => w());
  }
  if (!pending.size && timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/** Drop the waiting write for `key` (its stored copy is being removed). */
export function cancelWrite(key: string): void {
  pending.delete(key);
}

/** Tests: change the delay (0 writes at once). Waiting writes run first. */
export function setWriteDelay(ms: number): void {
  flushWrites();
  delay = ms;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('pagehide', () => {
    leaving = true;
    flushWrites();
  });
  // Back from the back/forward cache.
  window.addEventListener('pageshow', () => (leaving = false));
  document.addEventListener('visibilitychange', () => {
    leaving = document.visibilityState === 'hidden';
    if (leaving) flushWrites();
  });
}
