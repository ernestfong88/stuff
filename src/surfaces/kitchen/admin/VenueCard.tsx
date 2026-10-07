import { AlertTriangle, Plus, Printer as PrinterIcon, Send, Trash2, Wifi, WifiOff, X } from 'lucide-react';
import { useState } from 'react';
import { today } from '../../../lib/clock';
import { Button, Chip, toast } from '../../../ui';
import { menuById, patchVenue, unlinkPrinter, venuePrinters, type Venue, type VenueSettings } from '../venueSettings';
import { AddPrinterDialog } from './AddPrinterDialog';
import { KdsScreensEditor } from './KdsScreensEditor';
import { cycleWeekLabel } from './menuCycle';
import s from './VenueCard.module.css';

/** One venue: its name, menu, printers and, where it has a kitchen, its KDS screens. */
export function VenueCard({ settings, venue }: { settings: VenueSettings; venue: Venue }) {
  const [adding, setAdding] = useState(false);
  const menu = menuById(settings, venue.menuId);
  const unbound = !menu;
  const noStart = !!menu && menu.cycleLen > 0 && !venue.menuStartDt;
  const week = cycleWeekLabel(venue.menuStartDt, menu, today().getTime());
  const kitchenOwner = venue.room ? settings.venues.find((v) => v.active && v.room === venue.room) : undefined;
  const printers = venuePrinters(settings, venue.id);

  return (
    <section className={s.card} aria-label={venue.name}>
      <header className={s.head}>
        <input
          className={s.name}
          value={venue.name}
          aria-label="Venue name"
          onChange={(e) => patchVenue(venue.id, { name: e.target.value })}
        />
        {unbound || noStart ? (
          <Chip tone="danger" icon={<AlertTriangle size={12} />}>
            {unbound ? 'No menu bound: serves nothing' : 'No start date: the cycle can’t be worked out'}
          </Chip>
        ) : (
          <Chip tone="success">
            {menu.name} · {week ? week.toLowerCase() : 'static'}
          </Chip>
        )}
        <Button
          size="sm"
          variant="softDanger"
          iconOnly
          aria-label={`Retire ${venue.name}`}
          title="Retire this venue"
          className={s.retire}
          icon={<Trash2 size={15} />}
          onClick={() => {
            patchVenue(venue.id, { active: false });
            toast('Venue retired. Layouts, prices and history are kept.');
          }}
        />
      </header>

      <h3 className={s.label}>Printers</h3>
      <div className={s.printers}>
        {printers.map(({ link, printer }) => (
          <span key={link.id} className={s.printer}>
            <PrinterIcon size={14} className={s.printerIcon} />
            {printer.name}
            <Chip size="xs">{printer.type}</Chip>
            {printer.reachable ? (
              <Chip size="xs" tone="success" icon={<Wifi size={11} />}>
                OK
              </Chip>
            ) : (
              <Chip size="xs" tone="danger" icon={<WifiOff size={11} />}>
                Unreachable
              </Chip>
            )}
            <button
              className={s.iconBtn}
              aria-label={`Send a test page to ${printer.name}`}
              title="Send test page"
              onClick={() => toast(printer.reachable ? `Test page sent to ${printer.name}` : `${printer.name} not reachable at ${printer.ip}`)}
            >
              <Send size={14} />
            </button>
            <button className={s.iconBtn} aria-label={`Remove ${printer.name} from ${venue.name}`} title="Remove from this venue" onClick={() => unlinkPrinter(link.id)}>
              <X size={14} />
            </button>
          </span>
        ))}
        <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
          Add printer
        </Button>
      </div>

      {venue.room && <KdsScreensEditor settings={settings} room={venue.room} ownerName={kitchenOwner && kitchenOwner.id !== venue.id ? kitchenOwner.name : null} />}
      {adding && <AddPrinterDialog settings={settings} venue={venue} onClose={() => setAdding(false)} />}
    </section>
  );
}
