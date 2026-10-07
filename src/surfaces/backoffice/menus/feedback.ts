/**
 * Resident feedback by dish: what was said over the last months (seeded),
 * plus dining feedback servers add today (notes of kind "fb").
 */
import { useMemo } from 'react';
import { getResident } from '../../../data';
import type { ResidentNote } from '../../../domain/types';
import { now } from '../../../lib/clock';
import { useNotes } from '../../../store/notes';
import type { Recipe } from '../../../store/menuEdits';
import { normName, noteDish, noteSentiment, popularity, recipeScore, type FeedbackEntry, type RecipeScore, type Sentiment } from './model/score';
import feedbackJson from './seed/feedback.json';

type Row = [number, string, string, Sentiment, number, string, string, string, number];
const MEALS: Record<string, string> = { B: 'Breakfast', L: 'Lunch', D: 'Dinner' };

function seedFeedback(at: number): FeedbackEntry[] {
  const { names, rows } = feedbackJson as unknown as { names: string[]; rows: Row[] };
  return rows.map(([ni, rid, who, sent, off, meal, venue, text, rating], i) => ({
    id: 'sfb' + i,
    name: names[ni],
    rid,
    who,
    sent,
    at: at + off,
    meal: MEALS[meal],
    venue: venue || undefined,
    text,
    src: rating ? 'Rating' : 'Voice note',
  }));
}

const SEED_FEEDBACK = seedFeedback(now());

function venueOfTable(table: string | undefined): string | undefined {
  if (!table) return undefined;
  return /^EG/i.test(table) ? 'Evergreen Dining Room' : /^B/i.test(table) ? 'Bistro' : 'Sequoia Dining Room';
}

/** Dining feedback notes linked to the dish they mention. */
export function noteFeedback(notes: ResidentNote[], recipes: Recipe[]): FeedbackEntry[] {
  const out: FeedbackEntry[] = [];
  for (const n of notes) {
    if (n.kind !== 'fb') continue;
    const r = noteDish(n.text, recipes);
    if (!r) continue;
    out.push({
      id: n.id,
      name: r.name,
      rid: n.rid,
      who: getResident(n.rid)?.name ?? '',
      text: n.text,
      sent: noteSentiment(n.text),
      at: n.at,
      venue: venueOfTable(n.table),
      src: n.src === 'tap' ? 'Quick feedback' : 'Voice note',
    });
  }
  return out;
}

export function feedbackIndex(entries: FeedbackEntry[]): Map<string, FeedbackEntry[]> {
  const idx = new Map<string, FeedbackEntry[]>();
  for (const f of entries) {
    const k = normName(f.name);
    idx.set(k, [...(idx.get(k) ?? []), f]);
  }
  for (const list of idx.values()) list.sort((a, b) => b.at - a.at);
  return idx;
}

/** Score lookup for the recipes on screen; recomputes when notes or recipes change. */
export function useRecipeScores(recipes: Recipe[]): (r: Recipe) => RecipeScore | null {
  const notes = useNotes();
  return useMemo(() => {
    const idx = feedbackIndex([...SEED_FEEDBACK, ...noteFeedback(notes, recipes)]);
    const pop = popularity(recipes);
    const at = now();
    const cache = new Map<string, RecipeScore | null>();
    return (r: Recipe) => {
      if (!cache.has(r.id)) cache.set(r.id, recipeScore(r, idx.get(normName(r.name)) ?? [], pop, at));
      return cache.get(r.id) ?? null;
    };
  }, [notes, recipes]);
}
