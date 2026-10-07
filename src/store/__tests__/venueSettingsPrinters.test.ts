import { afterEach, describe, expect, it } from 'vitest';
import {
  addPrinter,
  kitchenPrinters,
  patchPrinter,
  removePrinter,
  renamePrinter,
  setPrinterRoutes,
  venuePrinters,
  venueSettingsStore,
  type VenueSettings,
} from '../venueSettings';

const start: VenueSettings = venueSettingsStore.get();
afterEach(() => venueSettingsStore.set(start));

const printer = (id: string) => venueSettingsStore.get().printers.find((p) => p.id === id);

describe('printer settings', () => {
  it('renames and patches a printer', () => {
    renamePrinter('p1', '  Grill  ');
    expect(printer('p1')?.name).toBe('Grill');
    renamePrinter('p1', '   ');
    expect(printer('p1')?.name).toBe('Grill');
    patchPrinter('p1', { type: 'Label', ip: '10.1.20.99' });
    expect(printer('p1')).toMatchObject({ id: 'p1', name: 'Grill', type: 'Label', ip: '10.1.20.99' });
  });

  it('removes a printer with its venue links', () => {
    removePrinter('p1');
    const s = venueSettingsStore.get();
    expect(printer('p1')).toBeUndefined();
    expect(s.printerLinks.some((l) => l.printerId === 'p1')).toBe(false);
    expect(venuePrinters(s, 'v3')).toEqual([]);
  });

  it('adds a printer to several venues, or none', () => {
    addPrinter({ id: 'px', name: 'Pastry', type: 'Kitchen', ip: '10.1.20.40', active: true, reachable: true }, ['v1', 'v3'], ['l1', 'l2']);
    const s = venueSettingsStore.get();
    expect(venuePrinters(s, 'v1').map((x) => x.printer.id)).toContain('px');
    expect(kitchenPrinters(s, 'bistro').map((p) => p.id)).toContain('px');
    addPrinter({ id: 'py', name: 'Spare', type: 'Receipt', ip: '', active: true, reachable: true }, [], []);
    expect(venueSettingsStore.get().printerLinks.some((l) => l.printerId === 'py')).toBe(false);
  });

  it('saves several routes at once', () => {
    setPrinterRoutes([
      { id: 'p1', print: 'all' },
      { id: 'p3', print: { groups: [], subs: [], recipes: ['r1'] } },
    ]);
    expect(printer('p1')?.print).toBe('all');
    expect(printer('p3')?.print).toEqual({ groups: [], subs: [], recipes: ['r1'] });
    expect(printer('p2')?.print).toEqual(start.printers.find((p) => p.id === 'p2')?.print);
  });
});
