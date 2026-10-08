import { Plus, Printer as PrinterIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { printerIpProblem } from '../../../domain/deviceChecks';
import { uid } from '../../../lib/id';
import { Button, Chip, Modal, TextField, cx, toast } from '../../../ui';
import { addPrinter, linkPrinter, type PrinterType, type Venue, type VenueSettings } from '../../../store/venueSettings';
import s from './AddPrinterDialog.module.css';

const TYPES: PrinterType[] = ['Kitchen', 'Receipt', 'Label'];

/**
 * Add one of the community's printers to a venue, or set up a new one. With
 * no venue (the Printers page) it only sets up a new printer, for the venues
 * picked here.
 */
export function AddPrinterDialog({ settings, venue, onClose }: { settings: VenueSettings; venue?: Venue; onClose: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<PrinterType>('Kitchen');
  const [ip, setIp] = useState('10.1.20.');
  const [venueIds, setVenueIds] = useState<string[]>(venue ? [venue.id] : []);
  const typeField = useId();
  const linked = new Set(venue ? settings.printerLinks.filter((l) => l.venueId === venue.id).map((l) => l.printerId) : []);
  const existing = venue ? settings.printers.filter((p) => p.active && !linked.has(p.id)) : [];
  const venues = settings.venues.filter((v) => v.active);
  const ipProblem = printerIpProblem(ip, settings.printers);
  // Only point out a bad IP once a name is in, so the half-typed default doesn't shout straight away.
  const showIp = !!name.trim() && !!ipProblem;
  const toggleVenue = (id: string) => setVenueIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <Modal open onClose={onClose} title={venue ? `Add printer · ${venue.name}` : 'Add printer'}>
      {venue && existing.length > 0 && (
        <>
          <h3 className={s.head}>Existing printers</h3>
          <div className={s.existing}>
            {existing.map((p) => (
              <button
                key={p.id}
                className={s.printer}
                onClick={() => {
                  linkPrinter({ id: uid('pr'), printerId: p.id, venueId: venue.id });
                  toast(`${p.name} added to ${venue.name}`);
                  onClose();
                }}
              >
                <PrinterIcon size={15} className={s.icon} />
                <span className={s.name}>{p.name}</span>
                <Chip>{p.type}</Chip>
                <span className={s.ip}>{p.ip}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {venue && <h3 className={s.head}>New printer</h3>}
      <div className={s.form}>
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Grill, Pastry..." className={s.grow} />
        <label className={s.field} htmlFor={typeField}>
          <span className={s.label}>Type</span>
          <select id={typeField} className={s.select} value={type} onChange={(e) => setType(e.target.value as PrinterType)}>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <TextField label="IP" value={ip} onChange={(e) => setIp(e.target.value)} inputMode="decimal" error={showIp ? ipProblem : undefined} />
      </div>
      {!venue && (
        <div className={s.venues}>
          <span className={s.label}>Venues that use it</span>
          <div className={s.venueChips} role="group" aria-label="Venues that use it">
            {venues.map((v) => {
              const on = venueIds.includes(v.id);
              return (
                <button key={v.id} className={cx(s.venue, on && s.venueOn)} aria-pressed={on} onClick={() => toggleVenue(v.id)}>
                  {v.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className={s.actions}>
        <Button
          variant="primary"
          icon={<Plus size={15} />}
          disabled={!name.trim() || !!ipProblem}
          onClick={() => {
            addPrinter(
              { id: uid('p'), name: name.trim(), type, ip: ip.trim(), active: true, reachable: true },
              venueIds,
              venueIds.map(() => uid('pr')),
            );
            toast('Printer added. Reachability is checked in the background, not on page load.');
            onClose();
          }}
        >
          {venue ? <>Create &amp; add</> : 'Add printer'}
        </Button>
      </div>
    </Modal>
  );
}
