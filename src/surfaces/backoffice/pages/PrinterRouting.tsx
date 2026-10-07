import { Printer as PrinterIcon, TriangleAlert } from 'lucide-react';
import { rooms } from '../../../data';
import { PRINT_GROUPS, printRoute, unprintedGroups, type PrintGroup } from '../../../domain/printing';
import { kitchenPrinters, setPrinterRoute, useVenueSettings } from '../../../store/venueSettings';
import { cx, Tabs } from '../../../ui';
import { BoSection } from '../kit';
import s from './PrinterRouting.module.css';

/**
 * Printer mode: what each printer prints. A printer prints the whole ticket
 * (the pass, a small kitchen with one printer) or only some groups of items
 * (entrées and sides to the hot line, starters and desserts to the pantry).
 */
export function PrinterRouting() {
  const settings = useVenueSettings();
  const printers = settings.printers.filter((p) => p.active && p.type !== 'Label');
  const venuesOf = (id: string) =>
    settings.printerLinks
      .filter((l) => l.printerId === id)
      .map((l) => settings.venues.find((v) => v.id === l.venueId)?.name)
      .filter(Boolean);
  const gaps = Object.keys(rooms)
    .map((room) => ({ room, missing: unprintedGroups(kitchenPrinters(settings, room).filter((p) => p.active)) }))
    .filter((g) => g.missing.length && kitchenPrinters(settings, g.room).length);

  return (
    <BoSection
      title="What each printer prints"
      sub="When the server sends, each printer gets one ticket with the items it is set to. Add or remove printers on each venue's Devices tab."
    >
      {gaps.map((g) => (
        <p key={g.room} className={s.warn} role="status">
          <TriangleAlert size={15} aria-hidden />
          {rooms[g.room].name} kitchen: {listText(g.missing)} {g.missing.length === 1 ? "doesn't" : "don't"} print anywhere.
        </p>
      ))}
      {printers.length === 0 && <p className={s.empty}>No kitchen printers yet. Add one on a venue's Devices tab.</p>}
      <ul className={s.list}>
        {printers.map((p) => {
          const route = printRoute(p);
          const whole = route === 'all';
          const groups = whole ? [] : route;
          const toggle = (g: PrintGroup) =>
            setPrinterRoute(p.id, groups.includes(g) ? groups.filter((x) => x !== g) : PRINT_GROUPS.filter((x) => x === g || groups.includes(x)));
          return (
            <li key={p.id} className={s.row}>
              <div className={s.head}>
                <PrinterIcon size={16} className={s.icon} aria-hidden />
                <span className={s.main}>
                  <span className={s.name}>{p.name}</span>
                  <span className={s.meta}>
                    {p.type} · {venuesOf(p.id).join(', ') || 'No venue'}
                  </span>
                </span>
                <Tabs
                  variant="segmented"
                  size="sm"
                  aria-label={`What ${p.name} prints`}
                  value={whole ? 'all' : 'some'}
                  onChange={(v) => setPrinterRoute(p.id, v === 'all' ? 'all' : groups.length ? groups : ['Entrées'])}
                  options={[
                    { id: 'all', label: 'Whole ticket' },
                    { id: 'some', label: 'Only some items' },
                  ]}
                />
              </div>
              {!whole && (
                <div className={s.groups} role="group" aria-label={`Items ${p.name} prints`}>
                  {PRINT_GROUPS.map((g) => {
                    const on = groups.includes(g);
                    return (
                      <button key={g} className={cx(s.group, on && s.groupOn)} aria-pressed={on} onClick={() => toggle(g)}>
                        {g}
                      </button>
                    );
                  })}
                  {!groups.length && <span className={s.none}>Prints nothing</span>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </BoSection>
  );
}

function listText(xs: string[]): string {
  return xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}
