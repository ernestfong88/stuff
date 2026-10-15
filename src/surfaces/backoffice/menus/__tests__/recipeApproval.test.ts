import { describe, expect, it } from 'vitest';
import type { Recipe } from '../../../../store/menuEdits';
import type { RecipeSubmission } from '../../../../store/recipeApprovals';
import { attentionItems } from '../../pages/dashboard/model/attention';
import { SEED_SUBMISSIONS } from '../approvals';
import {
  approvalStatus,
  changedKeys,
  changedParts,
  decide,
  needsNote,
  previousApproved,
  queueCounts,
  queueOf,
  recipeChanges,
  reopen,
  sameContent,
  sendForApproval,
  snapshotOf,
  whenText,
  withdraw,
} from '../model/recipeApproval';

const VT = 'Valencia Terrace';
const soup: Recipe = {
  id: 'r1',
  name: 'Tomato Bisque',
  cat: 'Starters',
  desc: 'Creamy tomato soup',
  ingredients: [
    { qty: 6, unit: 'fl oz', name: 'tomato puree' },
    { qty: 1, unit: 'fl oz', name: 'cream' },
  ],
  method: ['Simmer', 'Blend'],
  nutrition: { calories: 210, sodium: 900 },
  allergens: ['Milk'],
};
const send = (subs: RecipeSubmission[], r: Recipe, id: string, at: number, note?: string) =>
  sendForApproval(subs, r, { id, community: VT, by: 'Dana Whitaker', at, note });

describe('recipe approval', () => {
  it('sends a recipe as pending, with who sent it, when, and the note', () => {
    const subs = send([], soup, 's1', 100, '  New for fall  ');
    expect(subs).toHaveLength(1);
    expect(subs[0]).toMatchObject({ recipeId: 'r1', community: VT, sentBy: 'Dana Whitaker', sentAt: 100, note: 'New for fall', status: 'waiting' });
    const st = approvalStatus(subs, VT, soup);
    expect(st.step).toBe('waiting');
    expect(st.label).toBe('Pending approval');
    expect(st.canSend).toBe(false);
    expect(approvalStatus([], VT, soup)).toMatchObject({ step: 'none', canSend: true });
  });

  it('approves with an optional comment and denies only with a reason', () => {
    const subs = send([], soup, 's1', 100);
    const ok = decide(subs, 's1', { status: 'approved', by: 'Ernest Fong', at: 200 });
    expect(ok[0]).toMatchObject({ status: 'approved', decidedBy: 'Ernest Fong', decidedAt: 200 });
    expect(ok[0].comment).toBeUndefined();
    expect(approvalStatus(ok, VT, soup)).toMatchObject({ step: 'approved', label: 'Approved', canSend: false });

    expect(decide(subs, 's1', { status: 'denied', by: 'Ernest Fong', at: 200, comment: '   ' })).toBe(subs);
    const no = decide(subs, 's1', { status: 'denied', by: 'Ernest Fong', at: 200, comment: 'Cut the sodium' });
    expect(no[0]).toMatchObject({ status: 'denied', comment: 'Cut the sodium' });
    expect(approvalStatus(no, VT, soup)).toMatchObject({ step: 'denied', canSend: true });
    // A decided submission is not decided again.
    expect(decide(no, 's1', { status: 'approved', by: 'X', at: 300 })[0].status).toBe('denied');
  });

  it('asks for changes only with a note; the team can send it again', () => {
    const subs = send([], soup, 's1', 100);
    expect(needsNote('approved')).toBe(false);
    expect(needsNote('changes')).toBe(true);
    expect(needsNote('denied')).toBe(true);
    expect(decide(subs, 's1', { status: 'changes', by: 'E', at: 200 })).toBe(subs);
    const back = decide(subs, 's1', { status: 'changes', by: 'E', at: 200, comment: ' Tick Milk ' });
    expect(back[0]).toMatchObject({ status: 'changes', comment: 'Tick Milk', decidedBy: 'E' });
    expect(approvalStatus(back, VT, soup)).toMatchObject({ step: 'changes', label: 'Changes requested', tone: 'warning', canSend: true });
    expect(queueCounts(back)).toEqual({ waiting: 0, approved: 0, changes: 1, denied: 0 });
    expect(queueOf(back, 'changes').map((x) => x.id)).toEqual(['s1']);
    // Sent again: it waits, and the earlier copy stays on record.
    const again = send(back, { ...soup, allergens: ['Milk', 'Wheat'] }, 's2', 300);
    expect(again.map((x) => x.status)).toEqual(['waiting', 'changes']);
    expect(reopen(back, 's1')[0].status).toBe('waiting');
    expect(reopen(back, 's1')[0].comment).toBeUndefined();
  });

  it('marks the parts of the review that changed since the version approved before', () => {
    const before = snapshotOf(soup);
    expect(changedParts(undefined, before).size).toBe(0);
    expect(changedParts(before, before).size).toBe(0);
    const after = snapshotOf({ ...soup, name: 'Tomato Soup', cookMin: 30, equipment: ['Blender'], nutrition: { calories: 210, sodium: 600 } });
    expect(changedKeys(before, after)).toEqual(['name', 'cookMin', 'equipment', 'nutrition']);
    expect([...changedParts(before, after)].sort()).toEqual(['about', 'method', 'numbers', 'nutrition']);
    const plated = snapshotOf({ ...soup, garnish: 'Basil', variations: 'Dairy free: no cream' });
    expect([...changedParts(before, plated)].sort()).toEqual(['notes', 'plating']);
  });

  it('withdraws only while waiting, and undo puts a decision back to waiting', () => {
    const subs = send([], soup, 's1', 100);
    expect(withdraw(subs, 's1')).toEqual([]);
    const ok = decide(subs, 's1', { status: 'approved', by: 'E', at: 200, comment: 'Nice' });
    expect(withdraw(ok, 's1')).toBe(ok);
    const back = reopen(ok, 's1');
    expect(back[0].status).toBe('waiting');
    expect(back[0].decidedBy).toBeUndefined();
    expect(back[0].comment).toBeUndefined();
  });

  it('an edit after approval needs approving again; favorites and sales do not count as edits', () => {
    const ok = decide(send([], soup, 's1', 100), 's1', { status: 'approved', by: 'E', at: 200 });
    expect(approvalStatus(ok, VT, { ...soup, retired: true, sales: { orders: 3, per: 3, src: '' }, method: ['Simmer', 'Blend'] }).step).toBe(
      'approved',
    );
    const edited = { ...soup, method: ['Simmer 20 minutes', 'Blend'] };
    expect(approvalStatus(ok, VT, edited)).toMatchObject({ step: 'edited', label: 'Edited since approval', canSend: true });
    // Sending again replaces nothing on record and waits.
    const again = send(ok, edited, 's2', 300);
    expect(approvalStatus(again, VT, edited).step).toBe('waiting');
    expect(previousApproved(again, again[0])?.id).toBe('s1');
  });

  it('flags a waiting recipe changed after it was sent', () => {
    const subs = send([], soup, 's1', 100);
    expect(approvalStatus(subs, VT, { ...soup, desc: 'Roasted tomato soup' }).editedSinceSent).toBe(true);
    expect(approvalStatus(subs, VT, soup).editedSinceSent).toBe(false);
  });

  it('sending again while waiting replaces the waiting copy', () => {
    const subs = send(send([], soup, 's1', 100), { ...soup, desc: 'v2' }, 's2', 150);
    expect(subs.map((x) => x.id)).toEqual(['s2']);
  });

  it('counts and orders the queue', () => {
    let subs = send([], soup, 'a', 300);
    subs = send(subs, { ...soup, id: 'r2' }, 'b', 100);
    subs = send(subs, { ...soup, id: 'r3' }, 'c', 200);
    subs = decide(subs, 'c', { status: 'denied', by: 'E', at: 400, comment: 'No' });
    expect(queueCounts(subs)).toEqual({ waiting: 2, approved: 0, changes: 0, denied: 1 });
    expect(queueOf(subs, 'waiting').map((x) => x.id)).toEqual(['b', 'a']);
    expect(queueOf(subs, 'denied').map((x) => x.id)).toEqual(['c']);
  });

  it('lists what changed, field by field', () => {
    const after = snapshotOf({
      ...soup,
      desc: 'Roasted tomato soup',
      ingredients: [
        { qty: 6, unit: 'fl oz', name: 'tomato puree' },
        { qty: 1, unit: 'tsp', name: 'basil' },
      ],
      nutrition: { calories: 210, sodium: 600 },
      allergens: [],
    });
    const ch = recipeChanges(snapshotOf(soup), after);
    expect(ch.map((c) => c.label)).toEqual(['Description', 'Ingredients', 'Sodium', 'Allergens']);
    expect(ch[0]).toMatchObject({ before: 'Creamy tomato soup', after: 'Roasted tomato soup' });
    expect(ch[1]).toMatchObject({ added: ['1 tsp basil'], removed: ['1 fl oz cream'] });
    expect(ch[2]).toMatchObject({ before: '900 mg', after: '600 mg' });
    expect(ch[3]).toMatchObject({ added: [], removed: ['Milk'] });
    expect(recipeChanges(snapshotOf(soup), snapshotOf({ ...soup, method: ['Blend', 'Simmer'] }))[0].after).toBe('In a new order');
    expect(sameContent(soup, { ...soup, garnish: '' })).toBe(true);
  });

  it('says when, in plain words', () => {
    const at = new Date('2026-10-08T15:00:00').getTime();
    expect(whenText(new Date('2026-10-08T09:00:00').getTime(), at)).toBe('today');
    expect(whenText(new Date('2026-10-07T22:00:00').getTime(), at)).toBe('yesterday');
    expect(whenText(new Date('2026-10-05T12:00:00').getTime(), at)).toBe('3 days ago');
    expect(whenText(new Date('2026-09-12T12:00:00').getTime(), at)).toBe('Sep 12');
  });

  it('seeds 5 waiting, 3 approved, 1 with changes requested and 1 denied, with re-submissions to compare', () => {
    expect(queueCounts(SEED_SUBMISSIONS)).toEqual({ waiting: 5, approved: 3, changes: 1, denied: 1 });
    expect(SEED_SUBMISSIONS.find((x) => x.status === 'changes')?.comment).toBeTruthy();
    // Every recipe sent has enough to judge it: ingredients, method, plating and nutrition.
    for (const x of SEED_SUBMISSIONS) {
      expect(x.recipe.ingredients?.length, x.id).toBeGreaterThanOrEqual(4);
      expect(x.recipe.method?.length, x.id).toBeGreaterThanOrEqual(4);
      expect(x.recipe.plating?.length, x.id).toBeGreaterThanOrEqual(2);
      expect(x.recipe.nutrition?.sodium, x.id).toBeGreaterThan(0);
    }
    // The soup re-submission is compared with the version approved last winter: lower sodium stock.
    const soupNow = SEED_SUBMISSIONS.find((x) => x.id === 'ap_vt_soup')!;
    expect(previousApproved(SEED_SUBMISSIONS, soupNow)?.id).toBe('ap_vt_soup_1');
    expect(changedParts(previousApproved(SEED_SUBMISSIONS, soupNow)!.recipe, soupNow.recipe).has('ingredients')).toBe(true);
    expect(SEED_SUBMISSIONS.find((x) => x.status === 'denied')?.comment).toBeTruthy();
    const resubs = SEED_SUBMISSIONS.filter((x) => x.status === 'waiting' && previousApproved(SEED_SUBMISSIONS, x));
    expect(resubs.map((x) => x.community).sort()).toEqual(['La Posada', VT]);
    const resub = resubs.find((x) => x.community === 'La Posada');
    expect(recipeChanges(previousApproved(SEED_SUBMISSIONS, resub!)!.recipe, resub!.recipe).length).toBeGreaterThan(2);
    expect(SEED_SUBMISSIONS.some((x) => x.community === VT && x.status === 'waiting')).toBe(true);
  });

  it('asks the dashboard to review waiting recipes, for Home Office', () => {
    const base = { out: [], lateTickets: 0, lateMinutes: 15, waiversUsedUp: [], chargesToReview: 0, amountToReview: 0, venues: [], menus: [], at: 0, homeOffice: true };
    expect(attentionItems(base)).toEqual([]);
    const [it] = attentionItems({ ...base, recipesWaiting: 3 });
    expect(it).toMatchObject({ kind: 'recipes', action: 'Review 3 recipes waiting for approval', goto: { page: 'recipeApproval' } });
  });
});
