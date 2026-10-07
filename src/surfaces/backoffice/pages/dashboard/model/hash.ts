/**
 * Deterministic hashes for the dashboard's history. The demo has no
 * reporting backend, so past days are drawn from these keyed on the date:
 * the same day always shows the same tables, comps and comments.
 */

/** Small string hash (0 to 9972). */
export function strHash(s: string): number {
  let t = 0;
  for (const ch of s) t = (t * 31 + ch.charCodeAt(0)) % 9973;
  return t;
}

/** strHash spread over 32 bits, so neighbouring keys don't give neighbouring values. */
export function mixHash(s: string): number {
  let x = Math.imul(strHash(s) | 0, 2654435761) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822519) >>> 0;
  x ^= x >>> 13;
  return x >>> 0;
}

/** A number in [0, 1) for a key. */
export const unit = (s: string) => (mixHash(s) % 10000) / 10000;
