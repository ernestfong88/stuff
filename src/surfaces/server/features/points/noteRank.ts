import type { ResidentNote } from '../../../../domain/types';

export interface NoteRank {
  /** My points (one per note I added). */
  mine: number;
  /** Points by staff initials. */
  by: Record<string, number>;
  /** Everyone ranked: me, tonight's servers and anyone who added a note. */
  list: string[];
  of: number;
  /** My place, 1 = most points; ties share the better place. */
  rank: number;
}

/**
 * Every note about a resident is one point for the server who added it.
 * The ranking includes tonight's servers even with no points yet, so "1st
 * of 3" means something.
 */
export function noteRank(notes: ResidentNote[], me: string, servers: string[] = []): NoteRank {
  const by: Record<string, number> = {};
  for (const n of notes) if (n.by) by[n.by] = (by[n.by] ?? 0) + 1;
  const list = [...new Set([me, ...servers, ...Object.keys(by)])].filter(Boolean);
  const mine = by[me] ?? 0;
  return { mine, by, list, of: list.length, rank: 1 + list.filter((s) => s !== me && (by[s] ?? 0) > mine).length };
}
