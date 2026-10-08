/**
 * The Printers page's address: #/backoffice/printers/<tab>?venue=<id>&printer=<id>.
 * The first tab owns the bare address; `venue` narrows every tab to one
 * venue's printers and terminals, and `printer` points at one printer.
 */
import { navigate } from '../../../../shell/router';

export const PRINTER_TABS = ['list', 'routing', 'items', 'terminals'] as const;
export type PrintersTab = (typeof PRINTER_TABS)[number];

export interface PrintersAt {
  tab?: PrintersTab;
  venueId?: string | null;
  printerId?: string;
}

export function printersPath(tab: PrintersTab = 'list'): string[] {
  return tab === PRINTER_TABS[0] ? ['printers'] : ['printers', tab];
}

/** Open Printers on a tab, for one venue (or every venue), optionally at one printer. */
export function openPrinters({ tab, venueId, printerId }: PrintersAt = {}, opts: { replace?: boolean } = {}): void {
  navigate('backoffice', printersPath(tab), { replace: opts.replace, query: { venue: venueId ?? undefined, printer: printerId } });
}
