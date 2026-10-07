/**
 * Ordering rules on a modifier group: required, how many picks, how many
 * come included and the charge for each pick past that. The kiosk asks each
 * pinned group as its own step and the server's Modify screen holds to the
 * same rules, so both check and price alike. A group with no rule set stays
 * free and open.
 */
import type { LiveRuledGroup, ModRuleEdit } from '../../../../store/menuEdits';

export type ModRule = LiveRuledGroup['rule'];

/** A group's rule: Back Office's edit over the built-in default. */
export function resolveRule(def: ModRuleEdit | undefined, edit: ModRuleEdit | undefined): ModRule {
  const r: ModRuleEdit = { ...def, ...edit };
  const max = Math.max(0, Number(r.max) || 0);
  const min = Math.max(r.req ? 1 : 0, Number(r.min) || 0);
  return {
    required: min > 0,
    min: max ? Math.min(min, max) : min,
    max,
    included: r.incl == null ? null : Math.max(0, Number(r.incl) || 0),
    extra: Math.max(0, Number(r.extra) || 0),
    ask: r.ask ?? '',
    label: r.lbl ?? '',
  };
}

/** A rule that changes ordering at all (otherwise the group is free and open). */
export function ruleIsSet(r: ModRule): boolean {
  return r.required || r.max > 0 || r.extra > 0;
}

/** "Required · pick 1 · 3 included, then $1.00 each" */
export function ruleText(r: ModRule): string {
  let a: string;
  if (r.required)
    a = r.max === 1 ? 'Required · pick 1' : 'Required · pick ' + (r.min > 1 ? r.min + ' or more' : 'at least 1') + (r.max ? ', up to ' + r.max : '');
  else a = r.max === 1 ? 'Optional · pick 1' : r.max ? 'Optional · up to ' + r.max : 'Optional';
  return a + (r.extra > 0 ? ' · ' + (r.included ?? 0) + ' included, then $' + r.extra.toFixed(2) + ' each' : '');
}
