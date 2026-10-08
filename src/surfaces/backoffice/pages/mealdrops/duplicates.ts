/**
 * Groups of names that are the same option typed twice: equal once case and
 * spaces are ignored ("A la Carte" and "Ala Carte").
 */
export function duplicateNames(names: string[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const n of names) {
    const k = n.toLowerCase().replace(/\s/g, '');
    groups.set(k, [...(groups.get(k) ?? []), n]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}
