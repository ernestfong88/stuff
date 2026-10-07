/**
 * The Modify screen's logic: which modifier groups an item offers (pinned
 * groups first, then the ones used most with it), the ordering rules on a
 * group (required, how many picks), and turning picks into the line's
 * modifier selection and back.
 *
 * A pick is a modifier option with an action prefix: "Xtra Bacon",
 * "No Onions", or a plain option for Add.
 */
import { getItem, modGroups, modifierRules, modPrefixes, pinSeq } from '../../../../data';
import { flattenMods } from '../../../../domain/menu';
import type { ModGroup, ModSelection } from '../../../../domain/types';

export const ACTIONS = modPrefixes;
export type ModAction = string;

export interface ModPick {
  /** Modifier group id, when the option belongs to one. */
  group: string | null;
  /** Option name without the action. */
  name: string;
  /** Add, No, Sub, Xtra, Lite or Side. */
  type: ModAction;
  /** What prints: "Xtra Bacon", or "Bacon" for Add. */
  label: string;
}

export interface GroupRule {
  required: boolean;
  min: number;
  /** 0 = no limit. */
  max: number;
  included: number | null;
  extra: number;
  ask: string;
  label: string;
}

const FREE: GroupRule = { required: false, min: 0, max: 0, included: null, extra: 0, ask: '', label: '' };

/** __kMRule: a group's ordering rule (free and open when none is set). */
export function groupRule(groupId: string): GroupRule {
  const r = modifierRules.groups[groupId]?.rule;
  if (!r) return FREE;
  const max = Math.max(0, r.max || 0);
  const min = Math.max(r.required ? 1 : 0, r.min || 0);
  return {
    required: min > 0,
    min: max ? Math.min(min, max) : min,
    max,
    included: r.included,
    extra: Math.max(0, r.extra || 0),
    ask: r.ask,
    label: r.label,
  };
}

/** __kMRuleSet: the group carries a rule worth showing. */
export function hasRule(groupId: string): boolean {
  const r = groupRule(groupId);
  return r.required || r.max > 0 || r.extra > 0;
}

/** __kMRuleTxt: "Required · pick 1", "Optional · up to 4 · 3 included, then $1.00 each". */
export function ruleText(groupId: string): string {
  const r = groupRule(groupId);
  const base = r.required
    ? r.max === 1
      ? 'Required · pick 1'
      : 'Required · pick ' + (r.min > 1 ? `${r.min} or more` : 'at least 1') + (r.max ? `, up to ${r.max}` : '')
    : r.max === 1
      ? 'Optional · pick 1'
      : r.max
        ? `Optional · up to ${r.max}`
        : 'Optional';
  return base + (r.extra > 0 ? ` · ${r.included || 0} included, then $${r.extra.toFixed(2)} each` : '');
}

/** Groups pinned to an item open first, in the order the kitchen set. */
export function pinnedGroupIds(itemId: string): string[] {
  return pinSeq[itemId] ?? [];
}

const groupById = new Map(modGroups.map((g) => [g.id, g]));
const groupOfOption = new Map<string, string>();
for (const g of modGroups) for (const m of g.mods) groupOfOption.set(m, g.id);

export function modGroup(id: string): ModGroup | undefined {
  return groupById.get(id);
}

/**
 * The item's modifier groups: the pinned ones and the most used ones up top
 * (at least three, pinned in their set order), the rest behind "View all".
 */
export function groupsForItem(itemId: string, usage: Record<string, number>): { top: ModGroup[]; more: ModGroup[] } {
  const pinned = pinnedGroupIds(itemId);
  const rank = (g: ModGroup) => (pinned.includes(g.id) ? 0 : 1);
  const sorted = [...modGroups].sort(
    (a, b) => rank(a) - rank(b) || (usage[b.id] || 0) - (usage[a.id] || 0) || a.name.localeCompare(b.name),
  );
  const n = Math.max(3, sorted.filter((g) => rank(g) === 0).length);
  const order = (g: ModGroup) => pinned.indexOf(g.id) + 1 || 99;
  return { top: sorted.slice(0, n).sort((a, b) => order(a) - order(b)), more: sorted.slice(n) };
}

/** Read a printed modifier back into a pick. */
export function parsePick(label: string): ModPick {
  const word = label.split(' ')[0];
  const prefixed = ACTIONS.includes(word) && word !== 'Add';
  const type = prefixed ? word : 'Add';
  const name = prefixed ? label.slice(word.length + 1) : label;
  return { group: groupOfOption.get(name) ?? null, name, type, label };
}

export function pickLabel(type: ModAction, name: string): string {
  return type === 'Add' ? name : `${type} ${name}`;
}

/** The line's current modifiers as picks. */
export function picksFromMods(mods: ModSelection | undefined): ModPick[] {
  return flattenMods(mods).map(parsePick);
}

/**
 * Tap an option with the chosen action. Tapping it again with the same
 * action takes it off. A one-pick group swaps; a group at its limit
 * ignores more picks. "No" never counts against a limit.
 */
export function togglePick(picks: ModPick[], groupId: string, name: string, action: ModAction): ModPick[] {
  const rule = groupRule(groupId);
  const rest = picks.filter((p) => p.name !== name);
  const existing = picks.find((p) => p.name === name);
  if (existing && existing.type === action) return rest;
  const pick: ModPick = { group: groupId, name, type: action, label: pickLabel(action, name) };
  if (action === 'No' || !rule.max) return [...rest, pick];
  const inGroup = rest.filter((p) => p.group === groupId && p.type !== 'No');
  if (rule.max === 1) return [...rest.filter((p) => !inGroup.includes(p)), pick];
  return inGroup.length >= rule.max ? picks : [...rest, pick];
}

/** A group at its pick limit greys the options not yet picked. */
export function groupFull(picks: ModPick[], groupId: string, action: ModAction): boolean {
  const rule = groupRule(groupId);
  return action !== 'No' && rule.max > 1 && picks.filter((p) => p.group === groupId && p.type !== 'No').length >= rule.max;
}

export function pickedCount(picks: ModPick[], groupId: string): number {
  return picks.filter((p) => p.group === groupId && p.type !== 'No').length;
}

/** __kMRMiss: the first required pinned group still short of picks, as the question to ask. */
export function missingRequired(itemId: string, picks: ModPick[]): string {
  for (const gid of pinnedGroupIds(itemId)) {
    const r = groupRule(gid);
    if (r.min > 0 && pickedCount(picks, gid) < r.min) {
      const g = modGroup(gid);
      return (r.ask || `Choose from ${g?.name ?? 'the options'}`) + (r.min > 1 ? ` (at least ${r.min})` : '') + ' before adding it.';
    }
  }
  return '';
}

/**
 * Picks back into the line's selection. A plain pick that is one of the
 * item's own choices (Temp: Medium Rare) keeps that key, so unchanged
 * defaults stay hidden on tickets; anything else is listed under its
 * modifier group's name.
 */
export function modsFromPicks(itemId: string, picks: ModPick[]): ModSelection {
  const item = getItem(itemId);
  const out: ModSelection = {};
  for (const p of picks) {
    const own = p.type === 'Add' ? item?.mods.find((g) => g.opts.includes(p.name)) : undefined;
    if (own && !own.multi) {
      out[own.group] = p.name;
      continue;
    }
    const key = own?.group ?? (p.group ? (modGroup(p.group)?.name ?? 'Mods') : 'Mods');
    const prev = out[key];
    out[key] = [...(Array.isArray(prev) ? prev : prev ? [prev] : []), p.label];
  }
  return out;
}

/** __kDefMods: an item's default choices, used when it is added with one tap. */
export function defaultMods(itemId: string): ModSelection {
  const out: ModSelection = {};
  for (const g of getItem(itemId)?.mods ?? []) if (g.default) out[g.group] = g.default;
  return out;
}

/** The item opens the Modify screen when added: a group is pinned to it. */
export function opensModifiers(itemId: string): boolean {
  return pinnedGroupIds(itemId).length > 0;
}
