/**
 * Small stable string hashes for seeded demo data, so the same key always
 * gives the same made-up value.
 */

/** Small string hash, 0 to 9972 (kept from the mockup so seeded spreads match it). */
export function seedHash(s: string): number {
  let t = 0;
  for (const ch of s) t = (t * 31 + ch.charCodeAt(0)) % 9973;
  return t;
}

/** seedHash spread over 32 bits, so neighbouring keys don't give neighbouring values. */
export function mixHash(s: string): number {
  let x = Math.imul(seedHash(s) | 0, 2654435761) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822519) >>> 0;
  x ^= x >>> 13;
  return x >>> 0;
}
