/**
 * Ctrl K page search. Every word typed must appear somewhere in the page's
 * label, section, one-line description or extra keywords; pages whose label
 * starts with the query come first, then labels that contain it.
 */
export interface SearchablePage {
  id: string;
  label: string;
  blurb: string;
  keywords: string;
  section: string;
}

export function searchPages<P extends SearchablePage>(pages: P[], query: string): P[] {
  const q = query.trim().toLowerCase();
  if (!q) return pages;
  const words = q.split(/\s+/);
  return pages
    .map((p, i) => {
      const hay = `${p.label} ${p.section} ${p.blurb} ${p.keywords}`.toLowerCase();
      if (!words.every((w) => hay.includes(w))) return null;
      const label = p.label.toLowerCase();
      return { p, i, rank: label.startsWith(q) ? 0 : label.includes(q) ? 1 : 2 };
    })
    .filter((x): x is { p: P; i: number; rank: number } => x !== null)
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((x) => x.p);
}
