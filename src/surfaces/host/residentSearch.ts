import type { Resident } from '../../domain/types';

/**
 * __kResSearch: residents by apartment or name, best match first: an exact
 * apartment, an apartment that starts with it, a name word that starts with
 * it, then any name that contains it.
 */
export function searchResidents(list: Resident[], query: string, limit: number): Resident[] {
  const q = query.trim().toLowerCase();
  if (!q) return list.slice(0, limit);
  const score = (r: Resident) => {
    const name = r.name.toLowerCase();
    const apt = String(r.apt || '').toLowerCase();
    if (apt === q) return 0;
    if (apt.startsWith(q)) return 1;
    if (name.split(' ').some((w) => w.startsWith(q))) return 2;
    if (name.includes(q)) return 3;
    return 99;
  };
  return list
    .map((r) => ({ r, s: score(r) }))
    .filter((x) => x.s < 99)
    .sort((a, b) => a.s - b.s || a.r.name.localeCompare(b.r.name))
    .slice(0, limit)
    .map((x) => x.r);
}
