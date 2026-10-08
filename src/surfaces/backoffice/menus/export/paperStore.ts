/**
 * The paper each Menu Export printout was last printed on, whether the à
 * la carte menu prints on one page or two, and how diets and prices print,
 * kept on this device ("Reset demo data" leaves them alone).
 */
import { createSharedStore, useShared } from '../../../../lib/sharedStore';
import { paperOf, type PaperId, type PrintKind } from '../model/menuPrint';
import type { PriceField } from '../model/pricing';

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

/** How a printout shows diets: not at all, as words after each dish, or as icons with a legend. */
export type DietStyle = 'off' | 'words' | 'icons';

const looksStore = createSharedStore<{ diet?: DietStyle; prices?: PriceField | 'off' }>(
  {},
  { persistKey: 'kisco_menu_looks', channel: 'kisco-menu-looks', deviceSetting: true },
);

/** Diets as words (the default), icons, or off. */
export function useDietStyle(): DietStyle {
  return useShared(looksStore, (s) => (s.diet === 'off' || s.diet === 'icons' ? s.diet : 'words'));
}

export function setDietStyle(diet: DietStyle): void {
  looksStore.set((s) => ({ ...s, diet }));
}

/** The price printed with each dish (guest, à la carte or resident), or null for none (the default). */
export function usePrintPrices(): PriceField | null {
  return useShared(looksStore, (s) => (s.prices === 'guest' || s.prices === 'ala' || s.prices === 'res' ? s.prices : null));
}

export function setPrintPrices(prices: PriceField | null): void {
  looksStore.set((s) => ({ ...s, prices: prices ?? 'off' }));
}
