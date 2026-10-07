/**
 * Bump bar keys, saved on this device only.
 *
 * The defaults are the real bar the kitchen tested. Its arrows are printed
 * one way and send another: the down arrow sends ArrowRight, up sends
 * ArrowLeft, right sends ArrowDown, and left is the numpad minus, whose
 * e.key is "-" but whose e.code is "NumpadSubtract". So a key matches on
 * e.key or e.code. Bump ticket sends Enter. The bar's bump item button
 * reads as Ctrl, so Ctrl is on bump item (with Space for a keyboard).
 */
import { createSharedStore, useShared } from '../../lib/sharedStore';
import { safeStorage } from '../../lib/storage';

export type BumpAction = 'bumpItem' | 'bumpTicket' | 'left' | 'right' | 'up' | 'down' | 'menu';
/** Built-in behaviour that can't be reassigned. */
export type FixedBumpAction = 'line' | 'jump';

export interface BumpActionInfo {
  id: BumpAction | FixedBumpAction;
  label: string;
  /** For built-in actions, the keys that do it. */
  keys?: string;
}

export const BUMP_ACTIONS: readonly BumpActionInfo[] = [
  { id: 'bumpItem', label: 'Bump the highlighted item' },
  { id: 'bumpTicket', label: 'Bump the whole ticket' },
  { id: 'left', label: 'Previous ticket' },
  { id: 'right', label: 'Next ticket' },
  { id: 'up', label: 'Previous item, then the row above' },
  { id: 'down', label: 'Next item, then the next row of tickets' },
  { id: 'line', label: 'Next or previous item (keyboard)', keys: 'Tab / Shift+Tab' },
  { id: 'jump', label: 'Jump to ticket 0 to 9', keys: '0 to 9' },
  { id: 'menu', label: 'Recall the last bumped ticket' },
];

export const ASSIGNABLE_ACTIONS = BUMP_ACTIONS.filter((a): a is BumpActionInfo & { id: BumpAction } => !a.keys);

export const DEFAULT_BUMP_KEYS: Readonly<Record<BumpAction, readonly string[]>> = {
  bumpItem: [' ', 'Control'],
  bumpTicket: ['Enter'],
  left: ['NumpadSubtract', 'ArrowUp'],
  right: ['ArrowDown'],
  up: ['ArrowLeft'],
  down: ['ArrowRight'],
  menu: ['m', 'M'],
};

/** Key (e.key) → the action it was pointed at, or "none" to switch a default off. */
export type BumpAssignments = Record<string, BumpAction | 'none'>;
export type BumpKeyMap = Record<BumpAction, string[]>;

export interface KeyLike {
  key: string;
  code?: string;
}

const STORAGE_KEY = 'kisco_bump_keys';

export const bumpAssignmentsStore = createSharedStore<BumpAssignments>(() => safeStorage.getJSON<BumpAssignments>(STORAGE_KEY) ?? {});

const save = (next: BumpAssignments) => {
  if (Object.keys(next).length) safeStorage.setJSON(STORAGE_KEY, next);
  else safeStorage.remove(STORAGE_KEY);
  bumpAssignmentsStore.set(next);
};

/** Point a key at an action, "none" to make it do nothing, or "" to give it back its default. */
export function assignBumpKey(key: string, action: BumpAction | 'none' | ''): void {
  const next = { ...bumpAssignmentsStore.get() };
  if (action === '') delete next[key];
  else next[key] = action;
  save(next);
}

export function resetBumpKeys(): void {
  save({});
}

export function useBumpAssignments(): BumpAssignments {
  return useShared(bumpAssignmentsStore);
}

/** The keys for each action: the defaults not reassigned, plus the assigned ones. */
export function resolveBumpKeys(assigned: BumpAssignments): BumpKeyMap {
  const map = {} as BumpKeyMap;
  for (const a of Object.keys(DEFAULT_BUMP_KEYS) as BumpAction[]) map[a] = DEFAULT_BUMP_KEYS[a].filter((k) => !(k in assigned));
  for (const [k, a] of Object.entries(assigned)) if (a !== 'none') map[a].push(k);
  return map;
}

/** Does this key event do the action? */
export function bumpHit(map: Readonly<Record<BumpAction, readonly string[]>>, action: BumpAction, e: KeyLike): boolean {
  const keys = map[action] ?? [];
  return keys.includes(e.key) || (!!e.code && keys.includes(e.code));
}

/** The action a key does with this map, if any. */
export function actionForKey(map: Readonly<Record<BumpAction, readonly string[]>>, e: KeyLike): BumpAction | undefined {
  return (Object.keys(map) as BumpAction[]).find((a) => bumpHit(map, a, e));
}

export function actionLabel(action: string | undefined): string {
  return BUMP_ACTIONS.find((a) => a.id === action)?.label ?? 'Does nothing';
}

/** "Space", "Numpad -", "Ctrl" ... */
export function keyName(k: string): string {
  if (k === ' ') return 'Space';
  if (k === 'NumpadSubtract') return 'Numpad -';
  if (k === 'Control') return 'Ctrl';
  return k.length === 1 ? k.toUpperCase() : k;
}

/** The bar's arrows are listed by the arrow you press, not the key they send. */
export function barKeyName(k: string): string {
  const arrows: Record<string, string> = {
    ArrowDown: '→ on the bar',
    ArrowLeft: '↑ on the bar',
    ArrowRight: '↓ on the bar',
    NumpadSubtract: '← on the bar',
  };
  return arrows[k] ?? keyName(k);
}
