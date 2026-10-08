/**
 * The paper each Menu Export printout was last printed on, and whether the
 * à la carte menu prints on one page or two, kept on this device ("Reset
 * demo data" leaves them alone).
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

const pagesStore = createSharedStore<{ alacarte?: 1 | 2 }>({}, { persistKey: 'kisco_menu_pages', channel: 'kisco-menu-pages', deviceSetting: true });

/** À la carte on one page (the default) or two. */
export function useAlaCartePages(): 1 | 2 {
  return useShared(pagesStore, (s) => (s.alacarte === 2 ? 2 : 1));
}

export function setAlaCartePages(pages: 1 | 2): void {
  pagesStore.set((s) => ({ ...s, alacarte: pages }));
}
