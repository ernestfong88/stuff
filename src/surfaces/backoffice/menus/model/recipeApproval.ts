/**
 * Recipe Approval, in plain steps: a community sends a recipe to Home
 * Office, which approves it or denies it with a reason. A recipe changed
 * after it was approved needs approving again. Pure: every change takes the
 * list of submissions and returns a new one.
 */
import type { Recipe } from '../../../../store/menuEdits';
import type { RecipeSnapshot, RecipeSubmission, SubmissionStatus } from '../../../../store/recipeApprovals';
import { qtyUnit } from './recipeDraft';

/** The fields Home Office reviews, in the order a change list shows them. */
export const SNAPSHOT_KEYS = [
  'name',
  'cat',
  'sub',
  'desc',
  'menuDescriptor',
  'servingDesc',
  'garnish',
  'prepMin',
  'cookMin',
  'ingredients',
  'method',
  'plating',
  'equipment',
  'nutrition',
  'allergens',
  'dietFlags',
  'cookNotes',
  'variations',
] as const satisfies ReadonlyArray<keyof RecipeSnapshot>;

/** The reviewed parts of a recipe, with empty parts left out so two copies compare equal. */
export function snapshotOf(r: Recipe | RecipeSnapshot): RecipeSnapshot {
  const out: Record<string, unknown> = {};
  for (const k of SNAPSHOT_KEYS) {
    const v = r[k];
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
    if (k === 'nutrition') {
      const n = Object.fromEntries(Object.entries(v as object).filter(([, x]) => x != null));
      if (Object.keys(n).length) out[k] = n;
      continue;
    }
    out[k] = v;
  }
  return out as RecipeSnapshot;
}

/** Is the recipe the same as the copy that was sent (ignoring favorites, sales, retired ...)? */
export function sameContent(a: Recipe | RecipeSnapshot, b: Recipe | RecipeSnapshot): boolean {
  const x = snapshotOf(a);
  const y = snapshotOf(b);
  return SNAPSHOT_KEYS.every((k) => JSON.stringify(x[k] ?? null) === JSON.stringify(y[k] ?? null));
}

// ─── Changes ────────────────────────────────────────────────────────────

/** Send a recipe; replaces a submission still waiting for the same recipe. */
export function sendForApproval(
  subs: RecipeSubmission[],
  r: Recipe,
  x: { id: string; community: string; by: string; at: number; note?: string },
): RecipeSubmission[] {
  const note = x.note?.trim();
  const sub: RecipeSubmission = {
    id: x.id,
    recipeId: r.id,
    community: x.community,
    recipe: snapshotOf(r),
    sentBy: x.by,
    sentAt: x.at,
    ...(note ? { note } : {}),
    status: 'waiting',
  };
  return [sub, ...subs.filter((s) => !(s.status === 'waiting' && s.recipeId === r.id && s.community === x.community))];
}

/** Take back a recipe still waiting; a decided one stays on record. */
export function withdraw(subs: RecipeSubmission[], id: string): RecipeSubmission[] {
  return subs.some((s) => s.id === id && s.status === 'waiting') ? subs.filter((s) => s.id !== id) : subs;
}

/**
 * Approve or deny a waiting submission. Denying needs a reason (the team
 * reads it on the recipe); without one nothing changes.
 */
export function decide(
  subs: RecipeSubmission[],
  id: string,
  x: { status: Exclude<SubmissionStatus, 'waiting'>; by: string; at: number; comment?: string },
): RecipeSubmission[] {
  const comment = x.comment?.trim();
  if (x.status === 'denied' && !comment) return subs;
  return subs.map((s) =>
    s.id === id && s.status === 'waiting' ? { ...s, status: x.status, decidedBy: x.by, decidedAt: x.at, ...(comment ? { comment } : {}) } : s,
  );
}

/** Undo a decision: the submission waits again. */
export function reopen(subs: RecipeSubmission[], id: string): RecipeSubmission[] {
  return subs.map((s) => {
    if (s.id !== id || s.status === 'waiting') return s;
    const { decidedBy: _by, decidedAt: _at, comment: _c, ...rest } = s;
    return { ...rest, status: 'waiting' };
  });
}

// ─── Reading ────────────────────────────────────────────────────────────

const sameRecipe = (a: Pick<RecipeSubmission, 'recipeId' | 'community'>, b: Pick<RecipeSubmission, 'recipeId' | 'community'>) =>
  a.recipeId === b.recipeId && a.community === b.community;

/** The latest submission of a community's recipe, if it was ever sent. */
export function latestFor(subs: RecipeSubmission[], community: string, recipeId: string): RecipeSubmission | undefined {
  let best: RecipeSubmission | undefined;
  for (const s of subs) if (s.recipeId === recipeId && s.community === community && (!best || s.sentAt > best.sentAt)) best = s;
  return best;
}

/** The version approved before this submission was sent: what a re-submission is compared with. */
export function previousApproved(subs: RecipeSubmission[], sub: RecipeSubmission): RecipeSubmission | undefined {
  let best: RecipeSubmission | undefined;
  for (const s of subs)
    if (s.id !== sub.id && s.status === 'approved' && sameRecipe(s, sub) && s.sentAt < sub.sentAt && (!best || s.sentAt > best.sentAt)) best = s;
  return best;
}

export type RecipeApprovalStep = 'none' | 'waiting' | 'approved' | 'edited' | 'denied';

export interface RecipeApprovalInfo {
  step: RecipeApprovalStep;
  label: string;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  /** The submission it comes from. */
  sub?: RecipeSubmission;
  /** Waiting, but changed since it was sent: Home Office reviews the copy that was sent. */
  editedSinceSent?: boolean;
  /** It can be sent (again) now. */
  canSend: boolean;
}

/** Where a community's own recipe stands with Home Office. */
export function approvalStatus(subs: RecipeSubmission[], community: string, r: Recipe): RecipeApprovalInfo {
  const sub = latestFor(subs, community, r.id);
  if (!sub) return { step: 'none', label: 'Not sent for approval', tone: 'neutral', canSend: true };
  if (sub.status === 'waiting')
    return { step: 'waiting', label: 'Pending approval', tone: 'info', sub, editedSinceSent: !sameContent(sub.recipe, r), canSend: false };
  if (sub.status === 'denied') return { step: 'denied', label: 'Denied', tone: 'danger', sub, canSend: true };
  return sameContent(sub.recipe, r)
    ? { step: 'approved', label: 'Approved', tone: 'success', sub, canSend: false }
    : { step: 'edited', label: 'Edited since approval', tone: 'warning', sub, canSend: true };
}

export type QueueTab = SubmissionStatus;

export function queueCounts(subs: RecipeSubmission[]): Record<QueueTab, number> {
  const n = { waiting: 0, approved: 0, denied: 0 };
  for (const s of subs) n[s.status]++;
  return n;
}

/** A tab of the queue: waiting oldest first (first come, first reviewed), decided newest first. */
export function queueOf(subs: RecipeSubmission[], tab: QueueTab): RecipeSubmission[] {
  const list = subs.filter((s) => s.status === tab);
  return tab === 'waiting' ? list.sort((a, b) => a.sentAt - b.sentAt) : list.sort((a, b) => (b.decidedAt ?? 0) - (a.decidedAt ?? 0));
}

// ─── What changed ───────────────────────────────────────────────────────

export interface FieldChange {
  label: string;
  /** A single value that changed. */
  before?: string;
  after?: string;
  /** Lines added to or taken out of a list (ingredients, steps, allergens). */
  added?: string[];
  removed?: string[];
}

const LABELS: Record<(typeof SNAPSHOT_KEYS)[number], string> = {
  name: 'Name',
  cat: 'Category',
  sub: 'Subcategory',
  desc: 'Description',
  menuDescriptor: 'Menu description',
  servingDesc: 'Portion',
  garnish: 'Garnish',
  prepMin: 'Prep minutes',
  cookMin: 'Cook minutes',
  ingredients: 'Ingredients',
  method: 'Method',
  plating: 'Plating',
  equipment: 'Equipment',
  nutrition: 'Nutrition',
  allergens: 'Allergens',
  dietFlags: 'Diets',
  cookNotes: 'Cook notes',
  variations: "Variations and chef's notes",
};

export const NUTRIENT_UNITS: Array<[string, string, string]> = [
  ['calories', 'Calories', ''],
  ['protein', 'Protein', 'g'],
  ['carbs', 'Carbs', 'g'],
  ['fat', 'Fat', 'g'],
  ['sodium', 'Sodium', 'mg'],
  ['fiber', 'Fiber', 'g'],
  ['calcium', 'Calcium', 'mg'],
];

const lines = (k: string, v: unknown): string[] =>
  !Array.isArray(v)
    ? []
    : k === 'ingredients'
      ? v.map((i: { qty: number; unit: string; name: string }) => `${qtyUnit(i.qty, i.unit, false)} ${i.name}`)
      : v.map(String);

/** Field by field, what changed from one version to the next. */
export function recipeChanges(before: RecipeSnapshot, after: RecipeSnapshot): FieldChange[] {
  const a = snapshotOf(before);
  const b = snapshotOf(after);
  const out: FieldChange[] = [];
  for (const k of SNAPSHOT_KEYS) {
    if (JSON.stringify(a[k] ?? null) === JSON.stringify(b[k] ?? null)) continue;
    if (k === 'nutrition') {
      for (const [n, label, unit] of NUTRIENT_UNITS) {
        const x = (a.nutrition as Record<string, number | undefined> | undefined)?.[n];
        const y = (b.nutrition as Record<string, number | undefined> | undefined)?.[n];
        if (x !== y) out.push({ label, before: x == null ? '' : `${x}${unit && ' ' + unit}`, after: y == null ? '' : `${y}${unit && ' ' + unit}` });
      }
      continue;
    }
    if (Array.isArray(a[k]) || Array.isArray(b[k])) {
      const x = lines(k, a[k]);
      const y = lines(k, b[k]);
      const added = y.filter((l) => !x.includes(l));
      const removed = x.filter((l) => !y.includes(l));
      out.push(
        added.length || removed.length ? { label: LABELS[k], added, removed } : { label: LABELS[k], before: 'Same lines', after: 'In a new order' },
      );
      continue;
    }
    out.push({ label: LABELS[k], before: a[k] == null ? '' : String(a[k]), after: b[k] == null ? '' : String(b[k]) });
  }
  return out;
}

/** "today", "yesterday", "3 days ago", else "Sep 12": when it was sent or decided. */
export function whenText(ts: number, at: number): string {
  const midnight = (t: number) => new Date(t).setHours(0, 0, 0, 0);
  const d = Math.round((midnight(at) - midnight(ts)) / 86_400_000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
