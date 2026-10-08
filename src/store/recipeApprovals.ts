/**
 * Recipe Approval: recipes communities send to Home Office, and what Home
 * Office decided. Persisted and shared across tabs.
 *
 * `subs` missing means "still the seed"; Back Office merges it with its seed
 * (src/surfaces/backoffice/menus/approvals.ts), like the menu edits.
 */
import { createSharedStore, useShared } from '../lib/sharedStore';
import type { Recipe } from './menuEdits';

/** The parts of a recipe Home Office reviews; a change to any of them needs approving again. */
export type RecipeSnapshot = Pick<
  Recipe,
  | 'name'
  | 'cat'
  | 'sub'
  | 'desc'
  | 'menuDescriptor'
  | 'servingDesc'
  | 'garnish'
  | 'prepMin'
  | 'cookMin'
  | 'ingredients'
  | 'method'
  | 'plating'
  | 'equipment'
  | 'nutrition'
  | 'allergens'
  | 'dietFlags'
  | 'cookNotes'
  | 'variations'
>;

export type SubmissionStatus = 'waiting' | 'approved' | 'denied';

/** One recipe sent for approval, as it was when sent, and the decision. */
export interface RecipeSubmission {
  id: string;
  /** The recipe's id in the sending community's Recipe Book. */
  recipeId: string;
  community: string;
  recipe: RecipeSnapshot;
  sentBy: string;
  sentAt: number;
  /** "What changed / why", from the team that sent it. */
  note?: string;
  status: SubmissionStatus;
  decidedBy?: string;
  decidedAt?: number;
  /** The approval comment, or the reason it was denied. */
  comment?: string;
}

export interface RecipeApprovalsState {
  subs?: RecipeSubmission[];
}

export const recipeApprovalsStore = createSharedStore<RecipeApprovalsState>(() => ({}), {
  persistKey: 'kisco.recipeApprovals.v1',
  channel: 'kisco-recipe-approvals',
});

/** Read the saved submissions in a component (Back Office adds the seed). */
export function useRecipeApprovalsState(): RecipeApprovalsState {
  return useShared(recipeApprovalsStore);
}
