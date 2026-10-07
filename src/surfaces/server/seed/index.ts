/**
 * Server tablet seed data extracted from the prototype. In production this
 * comes from the resident profile service.
 */
import goodToKnowJson from './goodToKnow.json';

export interface GoodToKnow {
  /** Little things to know about the resident. */
  k: string[];
  /** A question to open with. */
  q?: string;
}

/** Hospitality notes per resident id, written by the life enrichment team. */
export const goodToKnow = goodToKnowJson as Record<string, GoodToKnow>;
