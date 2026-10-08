/**
 * Printer mode: the kitchen tickets each change prints. Every path that puts
 * food in front of the kitchen prints through here (the dining store calls
 * it): the server's Send, a released hold sent later, kiosk orders, a
 * scheduled pick up or delivery when its fire time comes, and remakes.
 *
 * Printing is simulated: each ticket is kept in a short shared log, which
 * the Cook and Expo printer screens list, and the caller gets what printed
 * where, what printed nowhere and which printers could not be reached.
 */
import { getItem } from '../data';
import { printerMode, type DiningConfig } from '../domain/config';
import { dinerName, tableName } from '../domain/orders';
import { newlyFired, printJobs, printSummary, unprintedItems, type PrintJob } from '../domain/printing';
import type { Order, OrderLine } from '../domain/types';
import { now } from '../lib/clock';
import { uid } from '../lib/id';
import { createSharedStore, useShared } from '../lib/sharedStore';
import { printItemsFor } from './printing';
import { kitchenPrinters, venueSettingsStore } from './venueSettings';

/** One ticket run: a check's newly fired lines going to the printers. */
export interface KitchenPrint {
  id: string;
  at: number;
  orderId: string;
  /** "SQ 7", "Pick Up · Harold" */
  label: string;
  /** "Printed at Hot Line (2 items) · …" */
  summary: string;
  jobs: PrintJob[];
  /** Printers that should have printed but can't be reached. */
  down: string[];
  /** Items no printer takes: nobody in the kitchen got them on paper. */
  unprinted: string[];
}

/** What the log keeps of a print (the jobs' printers reduced to names). */
export type PrintLogEntry = Omit<KitchenPrint, 'jobs'> & { printers: string[] };

const KEEP = 30;

export const kitchenPrintLog = createSharedStore<PrintLogEntry[]>([], {
  persistKey: 'kisco_kitchen_prints_v1',
  channel: 'kisco-kitchen-prints',
});

export const useKitchenPrintLog = (): PrintLogEntry[] => useShared(kitchenPrintLog);

/** A drink someone other than the kitchen makes (the server pours it, or the Bar screen has it) needs no paper. */
const handledElsewhere = (l: OrderLine) => l.kitchenState === 'pour' || l.kitchenState === 'bar' || l.kitchenState === 'up';

const orderLabel = (o: Order) => (o.queueType && o.diners[0] ? `${tableName(o)} · ${dinerName(o.diners[0]).split(' ')[0]}` : tableName(o));

/** Print these lines of one order at its kitchen's active printers. */
export function printLines(o: Order, lines: OrderLine[]): KitchenPrint | null {
  if (!lines.length) return null;
  const printers = kitchenPrinters(venueSettingsStore.get(), o.room).filter((p) => p.active);
  const items = printItemsFor(lines.map((l) => l.itemId));
  const jobs = printJobs(items, printers);
  const paperless = new Set(lines.filter(handledElsewhere).map((l) => getItem(l.itemId)?.name));
  const unprintedNames = new Set(
    unprintedItems(
      items.filter((it) => !paperless.has(it.name)),
      printers,
    ).map((it) => it.name),
  );
  const print: KitchenPrint = {
    id: uid('pr'),
    at: now(),
    orderId: o.id,
    label: orderLabel(o),
    summary: printSummary(jobs),
    jobs,
    down: jobs.filter((j) => !j.printer.reachable).map((j) => j.printer.name),
    unprinted: [...unprintedNames],
  };
  const { jobs: _jobs, ...rest } = print;
  kitchenPrintLog.set((log) => [{ ...rest, printers: jobs.filter((j) => j.printer.reachable).map((j) => j.printer.name) }, ...log].slice(0, KEEP));
  return print;
}

/**
 * In printer mode, print what a change to the open checks put in front of the
 * kitchen (see newlyFired), one ticket run per check. Nothing in KDS mode.
 */
export function printChanges(before: readonly Order[], after: readonly Order[], cfg: DiningConfig): KitchenPrint[] {
  if (!printerMode(cfg) || before === after) return [];
  const was = new Map(before.map((o) => [o.id, o]));
  return after.flatMap((o) => {
    if (was.get(o.id) === o) return [];
    const p = printLines(o, newlyFired(was.get(o.id), o));
    return p ? [p] : [];
  });
}

/** The warning a print needs, or null when everything printed: "Expo Receipt can't be reached. …" */
export function printWarning(p: KitchenPrint): string | null {
  const parts = [
    p.down.length ? `${p.down.join(' and ')} can't be reached.` : '',
    p.unprinted.length ? `No printer takes ${p.unprinted.join(', ')}.` : '',
  ].filter(Boolean);
  return parts.length ? `${p.label}: ${parts.join(' ')} Tell the kitchen what's on the ticket.` : null;
}
