import type { ResidentNote } from '../../../../domain/types';

export interface LittleThing {
  text: string;
  /** Added by a server (newest first), as opposed to the profile's own notes. */
  fresh: boolean;
  by?: string;
  at?: number;
}

const key = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Good to know: what servers added lately (newest first), then the
 * profile's own notes, each said once. Only "know" notes: observations go
 * to the care team and never show here, because this box is hospitality.
 */
export function littleThings(notes: ResidentNote[], profileNotes: string[]): LittleThing[] {
  const seen = new Set<string>();
  const once = (t: string) => {
    const k = key(t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  };
  const fresh = notes
    .filter((n) => n.kind === 'know')
    .sort((a, b) => b.at - a.at)
    .filter((n) => once(n.text))
    .map((n) => ({ text: n.text, fresh: true, by: n.by, at: n.at }));
  return [...fresh, ...profileNotes.filter(once).map((text) => ({ text, fresh: false }))];
}
