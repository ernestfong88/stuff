import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { associates, residents } from '../../../../data';
import { moveNote, seatedAt, seatedAtText } from '../../../../domain/seating';
import type { Contact, Order, Resident } from '../../../../domain/types';
import { initials } from '../../../../lib/format';
import { useDiningActions, useDiningOrders } from '../../../../store/dining';
import { Avatar, Button, cx, SearchField, TextField, useConfirm } from '../../../../ui';
import s from './AddDiner.module.css';
import { GUEST_RELATIONS, saveContact, searchPeople, useContacts } from './guestContacts';

type Kind = 'resident' | 'guest' | 'associate';
const KINDS: Array<{ id: Kind; label: string }> = [
  { id: 'resident', label: 'Resident' },
  { id: 'guest', label: 'Guest' },
  { id: 'associate', label: 'Associate' },
];

/** Add a resident, a resident's guest or an associate to the check. */
export function AddDiner({
  order,
  guestHost,
  onClose,
  onAdded,
}: {
  order: Order;
  guestHost: Resident | null;
  onClose: () => void;
  onAdded: (dinerId: string) => void;
}) {
  const { addDiner, patchOrder, removeDiner, closeOrder } = useDiningActions();
  const orders = useDiningOrders();
  const [ask, confirmDialog] = useConfirm();
  // An associate meal starts on the associate list.
  const [kind, setKind] = useState<Kind>(guestHost ? 'guest' : order.assoc ? 'associate' : 'resident');
  const [q, setQ] = useState('');
  const [host, setHost] = useState<Resident | null>(guestHost);
  const [guestName, setGuestName] = useState('');
  const [askRel, setAskRel] = useState(false);
  const contacts = useContacts(host);
  const seated = order.diners.filter((d) => d.kind === 'resident' && !d.isGuest).map((d) => d.refId);

  const pool =
    kind === 'associate' ? associates.map((a) => ({ ...a, apt: undefined })) : residents.filter((r) => kind === 'guest' || !seated.includes(r.id));
  const matches = searchPeople<{ id: string; name: string; apt?: string; photo: string; dept?: string }>(pool, q, 8);

  /** A resident already seated at another open table: say where, and move them or stop. */
  const elsewhere = (id: string) => (kind === 'resident' && !order.queueType ? seatedAt(orders, id, order.id) : null);
  const pick = async (id: string) => {
    if (kind === 'guest') {
      setHost(residents.find((r) => r.id === id) ?? null);
      return;
    }
    const at = elsewhere(id);
    if (at) {
      const name = residents.find((r) => r.id === id)?.name ?? 'This resident';
      const ok = await ask({
        title: seatedAtText(name, at),
        message: `${moveNote(name, at)} Cancel if they are still sitting there.`,
        confirmLabel: `Move ${name.split(' ')[0]} here`,
      });
      if (!ok) return;
      removeDiner(at.order.id, at.dinerId);
      // Nobody left on the old check: it goes, rather than sitting empty on the floor.
      if (at.order.diners.length === 1) closeOrder(at.order.id);
    }
    const added = addDiner(order.id, kind === 'associate' ? 'associate' : 'resident', id, false);
    // The first associate on an associate meal names the order, as Expo and Pick up show it.
    if (added && order.assoc && kind === 'associate' && !order.assocName) {
      const a = associates.find((x) => x.id === id);
      if (a) patchOrder(order.id, { assocName: a.name });
    }
    if (added) onAdded(added);
  };
  const addGuest = (c: Contact | null) => {
    if (!host) return;
    const extra = c ? { guestName: c.name, guestRel: c.rel } : guestName.trim() ? { guestName: guestName.trim(), guestRel: 'Guest' } : {};
    const added = addDiner(order.id, 'resident', host.id, true, extra);
    setHost(null);
    setGuestName('');
    if (added) onAdded(added);
  };

  const hostFirst = host?.name.split(' ')[0] ?? '';
  return (
    <div className={cx(s.box, 'fade-in')}>
      <div className={s.top}>
        <div className={s.kinds} role="tablist" aria-label="Who is sitting down">
          {KINDS.map((k) => (
            <button
              key={k.id}
              role="tab"
              aria-selected={kind === k.id}
              className={cx(s.kind, kind === k.id && s.kindOn)}
              onClick={() => {
                setKind(k.id);
                setQ('');
                setHost(null);
              }}
            >
              {k.label}
            </button>
          ))}
        </div>
        <button className={s.close} onClick={onClose} aria-label="Close">
          <X size={16} aria-hidden />
        </button>
      </div>

      {!(kind === 'guest' && host) && (
        <SearchField
          large
          autoFocus
          value={q}
          onChange={setQ}
          placeholder={kind === 'associate' ? 'Type an associate name' : 'Type a name or apartment number'}
          className={s.search}
        />
      )}
      {kind === 'guest' && !host && <p className={s.hint}>Pick whose guest they are, then choose the visitor from the resident's contacts.</p>}

      {kind === 'guest' && host ? (
        <div className="fade-in">
          <div className={s.hostRow}>
            <Avatar person={host} size={30} />
            <span className={s.hostText}>
              Guest of <strong>{host.name}</strong>
            </span>
            <Button size="sm" variant="ghost" onClick={() => setHost(null)}>
              Change
            </Button>
          </div>
          <div className={s.eyebrow}>From {hostFirst}'s contacts</div>
          {contacts.map((c) => (
            <button key={c.name} className={s.person} onClick={() => addGuest(c)}>
              <span className={s.initials}>{initials(c.name)}</span>
              <span className={s.personText}>
                <span className={s.personName}>{c.name}</span>
                <span className={s.personSub}>{c.rel}</span>
              </span>
              <Plus size={16} strokeWidth={2.5} className={s.plus} aria-hidden />
            </button>
          ))}
          {contacts.length === 0 && <p className={s.none}>No contacts on file.</p>}
          <div className={s.newGuest}>
            <TextField
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="New guest's name"
              aria-label="New guest's name"
              className={s.newInput}
            />
            <Button variant="primary" disabled={!guestName.trim()} onClick={() => setAskRel(true)}>
              Add
            </Button>
          </div>
          {askRel && guestName.trim() && (
            <div className={cx(s.rel, 'fade-in')}>
              <div className={s.relQ}>
                How is {guestName.trim()} related to {hostFirst}?
              </div>
              <div className={s.relChoices} role="group" aria-label="Relationship">
                {GUEST_RELATIONS.map((r) => (
                  <button
                    key={r}
                    className={cx(s.relBtn, r === 'Unknown' && s.relUnknown)}
                    onClick={() => {
                      const rel = r === 'Unknown' ? 'Guest' : r;
                      saveContact(host.id, guestName.trim(), rel);
                      setAskRel(false);
                      addGuest({ name: guestName.trim(), rel });
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className={s.relNote}>Saved to {hostFirst}'s contacts for next time.</div>
            </div>
          )}
          <p className={s.fine}>
            Guest meals draw on the host's comp allowance first, then charge à la carte. Naming the visitor tracks who's visiting.
          </p>
        </div>
      ) : (
        <>
          {matches.map((p) => {
            const at = elsewhere(p.id);
            return (
              <button key={p.id} className={s.person} onClick={() => pick(p.id)}>
                <Avatar person={p} size={38} />
                <span className={s.personText}>
                  <span className={s.personName}>{p.name}</span>
                  <span className={s.personSub}>
                    {p.apt ? `Apt ${p.apt}` : p.dept}
                    {at && <span className={s.seatedAt}> · At {at.table} with {at.server}</span>}
                  </span>
                </span>
                <Plus size={16} strokeWidth={2.5} className={s.plus} aria-hidden />
              </button>
            );
          })}
          {matches.length === 0 && <p className={s.none}>No matches.</p>}
        </>
      )}
      {confirmDialog}
    </div>
  );
}
