/**
 * Special diets at a glance on the server's Residents page: which residents
 * carry an allergy, a diet or a texture, how many carry each, and the quick
 * filter over them. The tags are the kitchen ticket's own (see Back Office
 * Residents' dietTags), so the server, the ticket and the office agree.
 */
import type { Resident } from '../../../../domain/types';
import { dietRows, tagCounts, tagKey, type DietRow, type TagCount } from '../../../backoffice/pages/residents/dietTags';

/** Filter key for "any allergy at all". */
export const ANY_ALLERGY = 'allergy|*';

export interface DietFilter {
  /** Only residents with any allergy, diet or texture. */
  special: boolean;
  /** Tag keys (tagKey) or ANY_ALLERGY; a resident matching any one of them shows. */
  keys: string[];
}

export const NO_DIET_FILTER: DietFilter = { special: false, keys: [] };

export interface DietSummary {
  /** Residents with any tag. */
  special: number;
  /** Residents with any allergy. */
  allergies: number;
  /** Each tag with how many residents carry it: allergies first, then diets, then textures. */
  tags: TagCount[];
}

/** Every resident's tags, by resident id. */
export function dietIndex(list: Resident[]): Map<string, DietRow> {
  return new Map(dietRows(list).map((row) => [row.r.id, row]));
}

export function dietSummary(index: Map<string, DietRow>): DietSummary {
  const rows = [...index.values()];
  return {
    special: rows.filter((r) => r.tags.length > 0).length,
    allergies: rows.filter((r) => r.tags.some((t) => t.cat === 'allergy')).length,
    tags: tagCounts(rows),
  };
}

export const isFiltering = (f: DietFilter) => f.special || f.keys.length > 0;

/** Does this resident show under the filter? */
export function matchesDiet(row: DietRow | undefined, f: DietFilter): boolean {
  if (!isFiltering(f)) return true;
  if (!row || row.tags.length === 0) return false;
  if (f.keys.length === 0) return true;
  return f.keys.some((k) => (k === ANY_ALLERGY ? row.tags.some((t) => t.cat === 'allergy') : row.tags.some((t) => tagKey(t) === k)));
}

/** Tap a tag chip: on or off. Picking a tag turns "Special diets" on with it; clearing the last one leaves it on. */
export function toggleDietKey(f: DietFilter, key: string): DietFilter {
  const keys = f.keys.includes(key) ? f.keys.filter((k) => k !== key) : [...f.keys, key];
  return { special: f.special || keys.length > 0, keys };
}

/** Tap "Special diets": on shows everyone with a tag; off clears the tag picks too. */
export function toggleSpecial(f: DietFilter): DietFilter {
  return f.special ? NO_DIET_FILTER : { special: true, keys: [] };
}
