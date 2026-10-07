import { CreditCard, Plus, Printer as PrinterIcon, Send, X } from 'lucide-react';
import { useState } from 'react';
import { COMMUNITY_NAME } from '../../../data';
import { formatTime } from '../../../lib/format';
import { Button, Chip, toast } from '../../../ui';
import { BoSection } from '../../backoffice/kit';
import { unlinkPrinter, venuePrinters, type Venue, type VenueSettings } from '../../../store/venueSettings';
import { AddPrinterDialog } from './AddPrinterDialog';
import s from './VenueDevices.module.css';

/** A venue's printers and card terminals, each with whether it is working. */
export function VenueDevices({ settings, venue }: { settings: VenueSettings; venue: Venue }) {
  const [adding, setAdding] = useState(false);
  const printers = venuePrinters(settings, venue.id);
  const terminals = settings.terminals.filter((t) => t.venueId === venue.id);

  return (
    <>
      <BoSection
        title="Printers"
        sub="Tickets and receipts for this venue print here."
        actions={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
            Add printer
          </Button>
        }
      >
        {printers.length ? (
          <ul className={s.list}>
            {printers.map(({ link, printer }) => (
              <li key={link.id} className={s.row}>
                <PrinterIcon size={16} className={s.icon} aria-hidden />
                <span className={s.main}>
                  <span className={s.name}>{printer.name}</span>
                  <span className={s.meta}>
                    {printer.type} · {printer.ip}
                  </span>
                </span>
                {printer.reachable ? (
                  <Chip tone="success">Working</Chip>
                ) : (
                  <Chip tone="danger">Can't be reached</Chip>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Send size={14} />}
                  onClick={() => toast(printer.reachable ? `Test page sent to ${printer.name}` : `${printer.name} can't be reached at ${printer.ip}. Check it's on and plugged in.`)}
                >
                  Test
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  iconOnly
                  icon={<X size={15} />}
                  aria-label={`Remove ${printer.name} from ${venue.name}`}
                  title="Remove from this venue"
                  onClick={() => {
                    unlinkPrinter(link.id);
                    toast(`${printer.name} removed from ${venue.name}. Other venues keep it.`);
                  }}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.empty}>No printers yet. Add one so tickets and receipts can print.</p>
        )}
      </BoSection>

      <BoSection
        title="Card terminals"
        sub={`Square Terminal, connected to ${COMMUNITY_NAME}. Guests tap their card on it; no card data touches KiscoConnect.`}
        actions={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => toast('Pairing code shown on the terminal: enter it here to link the device')}>
            Pair a terminal
          </Button>
        }
      >
        {terminals.length ? (
          <ul className={s.list}>
            {terminals.map((t) => (
              <li key={t.id} className={s.row}>
                <CreditCard size={16} className={s.icon} aria-hidden />
                <span className={s.main}>
                  <span className={s.name}>{t.name}</span>
                </span>
                {t.online ? <Chip tone="success">Online</Chip> : <Chip tone="warning">Offline{t.lastSeen ? ` · last seen ${formatTime(t.lastSeen)}` : ''}</Chip>}
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.empty}>No card terminal. Guests at this venue pay at another venue's terminal or charge to an apartment.</p>
        )}
      </BoSection>
      {adding && <AddPrinterDialog settings={settings} venue={venue} onClose={() => setAdding(false)} />}
    </>
  );
}
