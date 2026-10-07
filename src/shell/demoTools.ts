/**
 * Demo-only actions (reset the demo, clear all tickets). Stores register them
 * here and the account menu lists them under "Demo", away from the main nav,
 * so they can't be tapped by accident mid-service.
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
