import { Plus, Printer as PrinterIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { uid } from '../../../lib/id';
import { Button, Chip, Modal, TextField, toast } from '../../../ui';
import { addPrinter, linkPrinter, type PrinterType, type Venue, type VenueSettings } from '../../../store/venueSettings';
import s from './AddPrinterDialog.module.css';

const TYPES: PrinterType[] = ['Kitchen', 'Receipt', 'Label'];

/** Add one of the community's printers to a venue, or set up a new one. */
export function AddPrinterDialog({ settings, venue, onClose }: { settings: VenueSettings; venue: Venue; onClose: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<PrinterType>('Kitchen');
  const [ip, setIp] = useState('10.1.20.');
  const typeField = useId();
  const linked = new Set(settings.printerLinks.filter((l) => l.venueId === venue.id).map((l) => l.printerId));
  const existing = settings.printers.filter((p) => p.active && !linked.has(p.id));

  return (
    <Modal open onClose={onClose} title={`Add printer · ${venue.name}`}>
      {existing.length > 0 && (
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
      <h3 className={s.head}>New printer</h3>
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
        <TextField label="IP" value={ip} onChange={(e) => setIp(e.target.value)} inputMode="decimal" />
      </div>
      <div className={s.actions}>
        <Button
          variant="primary"
          icon={<Plus size={15} />}
          disabled={!name.trim()}
          onClick={() => {
            addPrinter({ id: uid('p'), name: name.trim(), type, ip, active: true, reachable: true }, venue.id, uid('pr'));
            toast('Printer added. Reachability is checked in the background, not on page load.');
            onClose();
          }}
        >
          Create &amp; add
        </Button>
      </div>
    </Modal>
  );
}
