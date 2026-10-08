/**
 * Demo-only actions (reset the demo, clear all tickets). Stores register them
 * here and the screen menu (top right, on every screen) lists them at the
 * top under "Demo". Each one asks before it runs.
 */
import { createSharedStore, useShared } from '../lib/sharedStore';

export interface DemoAction {
  id: string;
  label: string;
  /** Shown in the confirmation dialog. */
  confirm: string;
  run: () => void;
}

const actions = createSharedStore<DemoAction[]>([]);

export function registerDemoAction(a: DemoAction): () => void {
  actions.set((list) => [...list.filter((x) => x.id !== a.id), a]);
  return () => actions.set((list) => list.filter((x) => x.id !== a.id));
}

export function useDemoActions(): DemoAction[] {
  return useShared(actions);
}
