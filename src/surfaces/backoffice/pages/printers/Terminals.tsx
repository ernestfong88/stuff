import { CreditCard, Plus } from 'lucide-react';
import { useState } from 'react';
import { COMMUNITY_NAME } from '../../../../data';
import { cleanPairingCode } from '../../../../domain/deviceChecks';
import { formatTime } from '../../../../lib/format';
import { uid } from '../../../../lib/id';
import { addTerminal, type Venue, type VenueSettings } from '../../../../store/venueSettings';
import { Button, Chip, Modal, TextField, toast } from '../../../../ui';
import { BoSection } from '../../kit';
import s from './terminals.module.css';

/**
 * Card terminals, venue by venue (or for the one venue picked), each with
 * whether it is online, and pairing a new one.
 */
export function Terminals({ settings, venues }: { settings: VenueSettings; venues: Venue[] }) {
  const [pairing, setPairing] = useState<Venue | null>(null);
  const one = venues.length === 1 ? venues[0] : null;
  const pairButton = (v: Venue) => (
    <Button size="sm" icon={<Plus size={14} />} onClick={() => setPairing(v)} aria-label={one ? undefined : `Pair a terminal at ${v.name}`}>
      Pair a terminal
    </Button>
  );
  return (
    <BoSection
      title="Card terminals"
      sub={`Square Terminal, connected to ${COMMUNITY_NAME}. Guests tap their card on it; no card data touches KiscoConnect.`}
      actions={one && pairButton(one)}
    >
      {venues.map((v) => {
        const terminals = settings.terminals.filter((t) => t.venueId === v.id);
        return (
          <section key={v.id} className={s.group} aria-label={one ? undefined : v.name}>
            {!one && (
              <div className={s.groupHead}>
                <h3 className={s.groupName}>{v.name}</h3>
                {pairButton(v)}
              </div>
            )}
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
          </section>
        );
      })}
      {pairing && (
        <PairTerminalDialog
          venue={pairing}
          count={settings.terminals.filter((t) => t.venueId === pairing.id).length}
          onClose={() => setPairing(null)}
        />
      )}
    </BoSection>
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
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={name.trim() ? undefined : 'Give the terminal a name.'}
        />
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
