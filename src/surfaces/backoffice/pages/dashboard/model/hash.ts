/**
 * Deterministic hashes for the dashboard's history. The demo has no
 * reporting backend, so past days are drawn from these keyed on the date:
 * the same day always shows the same tables, comps and comments.
 */

import { mixHash, seedHash } from '../../../../../lib/hash';

/** Small string hash (0 to 9972). */
export const strHash = seedHash;
export { mixHash };

/** A number in [0, 1) for a key. */
export const unit = (s: string) => (mixHash(s) % 10000) / 10000;
