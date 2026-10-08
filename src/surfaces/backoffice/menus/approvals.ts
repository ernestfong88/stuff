/**
 * Recipe Approval data: the seed merged with what is saved in
 * src/store/recipeApprovals, and the actions the Recipe Book and the
 * Recipe Approval page (HO Settings) take.
 */
import { COMMUNITY_NAME } from '../../../data';
import { DAY, HOUR, now } from '../../../lib/clock';
import { uid } from '../../../lib/id';
import { useShared } from '../../../lib/sharedStore';
import type { Recipe } from '../../../store/menuEdits';
import { SHIPPED_RECIPES } from '../../../store/shippedRecipes';
import { recipeApprovalsStore, type RecipeApprovalsState, type RecipeSnapshot, type RecipeSubmission } from '../../../store/recipeApprovals';
import { BACK_OFFICE_USER, backOfficeUser } from '../seed/associates';
import { decide, reopen, sendForApproval, snapshotOf, withdraw } from './model/recipeApproval';
import approvalsJson from './seed/approvals.json';

/** The community whose Recipe Book this is: its recipes are sent under its name. */
export const RECIPE_BOOK_COMMUNITY = COMMUNITY_NAME;

interface SeedSubmission extends Omit<RecipeSubmission, 'sentAt' | 'decidedAt' | 'recipe'> {
  recipe?: RecipeSnapshot;
  /** Take the recipe from the Recipe Book seed (this community's own). */
  fromSeedRecipe?: boolean;
  sentDaysAgo?: number;
  sentHoursAgo?: number;
  decidedDaysAgo?: number;
}

/** Seeded submissions, dated relative to today so the queue always looks current. */
function seedSubmissions(at: number): RecipeSubmission[] {
  const recipes = SHIPPED_RECIPES;
  return (approvalsJson as unknown as SeedSubmission[]).flatMap(({ fromSeedRecipe, sentDaysAgo, sentHoursAgo, decidedDaysAgo, recipe, ...s }) => {
    const r = fromSeedRecipe ? recipes.find((x) => x.id === s.recipeId) : recipe;
    if (!r) return [];
    return [
      {
        ...s,
        recipe: snapshotOf(r),
        sentAt: at - (sentDaysAgo ?? 0) * DAY - (sentHoursAgo ?? 0) * HOUR,
        ...(decidedDaysAgo != null ? { decidedAt: at - decidedDaysAgo * DAY } : {}),
      },
    ];
  });
}

export const SEED_SUBMISSIONS: RecipeSubmission[] = seedSubmissions(now());

const subsOf = (s: RecipeApprovalsState) => s.subs ?? SEED_SUBMISSIONS;

export function getSubmissions(): RecipeSubmission[] {
  return subsOf(recipeApprovalsStore.get());
}

/** Every submission, in a component. */
export function useSubmissions(): RecipeSubmission[] {
  return useShared(recipeApprovalsStore, subsOf);
}

function change(fn: (subs: RecipeSubmission[]) => RecipeSubmission[]): void {
  recipeApprovalsStore.set((prev) => {
    const subs = subsOf(prev);
    const next = fn(subs);
    return next === subs ? prev : { ...prev, subs: next };
  });
}

/** Send one of this community's recipes to Home Office. */
export function sendRecipe(r: Recipe, note: string): void {
  change((subs) => sendForApproval(subs, r, { id: uid('ap'), community: RECIPE_BOOK_COMMUNITY, by: BACK_OFFICE_USER.name, at: now(), note }));
}

export function withdrawSubmission(id: string): void {
  change((subs) => withdraw(subs, id));
}

/** Put a withdrawn submission back, for Undo. */
export function restoreSubmission(sub: RecipeSubmission): void {
  change((subs) => (subs.some((s) => s.id === sub.id) ? subs : [sub, ...subs]));
}

export function approveSubmission(id: string, comment: string): void {
  change((subs) => decide(subs, id, { status: 'approved', by: backOfficeUser().name, at: now(), comment }));
}

export function denySubmission(id: string, reason: string): void {
  change((subs) => decide(subs, id, { status: 'denied', by: backOfficeUser().name, at: now(), comment: reason }));
}

/** Undo an approval or a denial. */
export function reopenSubmission(id: string): void {
  change((subs) => reopen(subs, id));
}
