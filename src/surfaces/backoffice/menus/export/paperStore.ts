/**
 * The paper each Menu Export printout was last printed on, kept on this
 * device ("Reset demo data" leaves it alone).
 */
import { createSharedStore, useShared } from '../../../../lib/sharedStore';
import { paperOf, type PaperId, type PrintKind } from '../model/menuPrint';

const paperStore = createSharedStore<Partial<Record<PrintKind, PaperId>>>(
  {},
  { persistKey: 'kisco_menu_paper', channel: 'kisco-menu-paper', deviceSetting: true },
);

/** The paper for a printout: the last one picked for it, else letter. */
export function usePaper(kind: PrintKind): PaperId {
  return paperOf(useShared(paperStore, (s) => s[kind])).id;
}

export function setPaper(kind: PrintKind, paper: PaperId): void {
  paperStore.set((s) => ({ ...s, [kind]: paper }));
}
