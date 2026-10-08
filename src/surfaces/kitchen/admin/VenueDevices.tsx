import { CreditCard, Plus, Printer as PrinterIcon, Send, X } from 'lucide-react';
import { useState } from 'react';
import { COMMUNITY_NAME } from '../../../data';
import { formatTime } from '../../../lib/format';
import { Button, Chip, Modal, TextField, toast, useConfirm } from '../../../ui';
import { BoSection } from '../../backoffice/kit';
import { cleanPairingCode } from '../../../domain/deviceChecks';
import { uid } from '../../../lib/id';
import { addTerminal, linkPrinter, unlinkPrinter, venuePrinters, type Venue, type VenueSettings } from '../../../store/venueSettings';
import { AddPrinterDialog } from './AddPrinterDialog';
import s from './VenueDevices.module.css';

/** A venue's printers and card terminals, each with whether it is working. */
export function VenueDevices({ settings, venue }: { settings: VenueSettings; venue: Venue }) {
  const [adding, setAdding] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [ask, dialog] = useConfirm();
  const printers = venuePrinters(settings, venue.id);
  const terminals = settings.terminals.filter((t) => t.venueId === venue.id);

  return (
    <>
      <BoSection
        title="Printers"
        sub="Tickets and receipts for this venue print here. Rename or remove printers, and set what each prints, on Venues › Printers."
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
                {printer.reachable ? <Chip tone="success">Working</Chip> : <Chip tone="danger">Can't be reached</Chip>}
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Send size={14} />}
                  onClick={() =>
                    toast(
                      printer.reachable
                        ? `Test page sent to ${printer.name}`
                        : `${printer.name} can't be reached at ${printer.ip}. Check it's on and plugged in.`,
                    )
                  }
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
                  onClick={async () => {
                    const ok = await ask({
                      title: `Remove ${printer.name} from ${venue.name}?`,
                      message: `${venue.name} stops printing on it. Other venues keep it, and it stays on Venues › Printers.`,
                      confirmLabel: 'Remove from venue',
                      tone: 'danger',
                    });
                    if (!ok) return;
                    unlinkPrinter(link.id);
                    toast(`${printer.name} removed from ${venue.name}. Other venues keep it.`, {
                      action: { label: 'Undo', onClick: () => linkPrinter(link) },
                    });
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
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setPairing(true)}>
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
                {t.online ? (
                  <Chip tone="success">Online</Chip>
                ) : (
                  <Chip tone="warning">Offline{t.lastSeen ? ` · last seen ${formatTime(t.lastSeen)}` : ''}</Chip>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.empty}>No card terminal. Guests at this venue pay at another venue's terminal or charge to an apartment.</p>
        )}
      </BoSection>
      {adding && <AddPrinterDialog settings={settings} venue={venue} onClose={() => setAdding(false)} />}
      {pairing && <PairTerminalDialog venue={venue} count={terminals.length} onClose={() => setPairing(false)} />}
      {dialog}
    </>
  );
}

/** Pair a Square Terminal: type the code it shows, name it, and it joins this venue. */
function PairTerminalDialog({ venue, count, onClose }: { venue: Venue; count: number; onClose: () => void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState(`${venue.name} terminal${count ? ` ${count + 1}` : ''}`);
  const clean = cleanPairingCode(code);
  const pair = () => {
    if (!clean || !name.trim()) return;
    addTerminal({ id: uid('term'), name: name.trim(), venueId: venue.id, online: true, lastSeen: null });
    toast(`${name.trim()} paired with ${venue.name}`, { tone: 'success' });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={`Pair a terminal · ${venue.name}`}>
      <p className={s.pairNote}>On the Square Terminal, open Settings › Device › Pair, then type the code it shows here.</p>
      <form
        className={s.pairForm}
        onSubmit={(e) => {
          e.preventDefault();
          pair();
        }}
      >
        <TextField
          label="Pairing code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="6 letters or numbers"
          autoComplete="off"
          autoFocus
          maxLength={9}
          error={code.trim() && !clean ? 'The code is 6 letters or numbers, as shown on the terminal.' : undefined}
        />
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} error={name.trim() ? undefined : 'Give the terminal a name.'} />
        <div className={s.pairActions}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={!clean || !name.trim()}>
            Pair terminal
          </Button>
        </div>
      </form>
    </Modal>
  );
}
