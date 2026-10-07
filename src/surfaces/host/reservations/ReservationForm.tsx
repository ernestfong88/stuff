import { useRef, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { residents } from '../../../data';
import type { MealName } from '../../../domain/types';
import { now } from '../../../lib/clock';
import { Avatar, Button, Modal, Stepper, TextArea, cx } from '../../../ui';
import { FloorPlan } from '../../manager/floor/FloorPlan';
import type { RoomPlan } from '../../../store/floorLayout';
import { searchResidents } from '../residentSearch';
import { GUESTS_ON_FILE, recipients, recipientsLine, type GuestOnFile } from './contacts';
import {
  RESV_MEALS,
  RESV_NOTES,
  clashes,
  hasNote,
  toggleNote,
  dayFromToday,
  dayWord,
  hm,
  mealAtMinutes,
  mealSlots,
  nowMinutes,
  partyLast,
  partyName,
  personName,
  tableLabel,
  type Reservation,
  type ResvPerson,
} from './model';
import s from './ReservationForm.module.css';

interface Props {
  plan: RoomPlan;
  /** The booking being edited; absent for a new one. */
  init?: Reservation;
  list: Reservation[];
  day: string;
  meal: MealName;
  onClose: () => void;
  onSave: (r: Reservation) => void;
}

const guestPerson = (g: GuestOnFile): ResvPerson => ({ gid: g.id, guest: g.name, rel: g.rel, host: g.host });

/**
 * __KResvForm: new or edit. Who comes first, because that is what the caller
 * says first; a typed name that is not a resident becomes a guest.
 */
export function ReservationForm({ plan, init, list, day, meal, onClose, onSave }: Props) {
  const editing = !!init;
  const nm = nowMinutes();
  const [people, setPeople] = useState<ResvPerson[]>(() => init?.people.slice() ?? []);
  const [size, setSize] = useState(() => init?.size ?? 1);
  const [date, setDate] = useState(() => init?.date ?? day);
  const [ml, setMl] = useState<MealName>(() => init?.meal ?? meal);
  const [time, setTime] = useState<number | null>(() => {
    if (init) return init.time;
    const slots = mealSlots(meal);
    return (day === dayFromToday(0) ? slots.find((t) => t > nm) : slots[0]) ?? null;
  });
  const [tableId, setTableId] = useState<string | null>(() => init?.tableId ?? null);
  const [notes, setNotes] = useState(() => init?.notes ?? '');
  const [remind, setRemind] = useState(() => !!init?.remind);
  const [q, setQ] = useState('');
  const [view, setView] = useState<'map' | 'list'>('map');
  const input = useRef<HTMLInputElement>(null);

  const isToday = date === dayFromToday(0);
  const base = mealSlots(ml);
  const slots = time != null && !base.includes(time) && mealAtMinutes(time) === ml ? [...base, time].sort((a, b) => a - b) : base;
  const past = (t: number) => isToday && t <= nm && !(init && init.time === t && init.date === date);
  const hits = q.trim() ? searchResidents(residents.filter((r) => !people.some((p) => p.rid === r.id)), q, 5) : [];
  const freeGuests = GUESTS_ON_FILE.filter((g) => !people.some((p) => p.gid === g.id));
  const guestHits = q.trim() ? freeGuests.filter((g) => g.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 4) : [];
  const suggested = freeGuests.filter((g) => people.some((p) => p.rid === g.host));
  const textable = recipients(people).to.length > 0;
  const draft = { id: init?.id ?? '', room: plan.key, date, time: time ?? 0, tableId };
  const clash = time != null ? clashes(draft, list) : [];
  const ok = people.length > 0 && time != null;
  const party = Math.max(size, people.length, 1);
  const labelOf = (id: string) => plan.items.find((t) => t.id === id)?.label;

  const addPerson = (p: ResvPerson) => {
    setPeople((a) => [...a, p]);
    setSize((n) => Math.max(n, people.length + 1));
    setQ('');
    input.current?.focus();
  };
  const addTyped = () => {
    const g = q.trim().slice(0, 40);
    if (g) addPerson({ guest: g, rel: 'Guest' });
  };
  const pickMeal = (m: MealName) => {
    setMl(m);
    const ss = mealSlots(m);
    if (time == null || !ss.includes(time)) setTime((isToday ? ss.find((t) => t > nm) : ss[0]) ?? null);
  };
  const pickDay = (k: string) => {
    setDate(k);
    if (k === dayFromToday(0) && time != null && time <= nm) setTime(mealSlots(ml).find((t) => t > nm) ?? null);
  };
  const save = () => {
    if (!ok || time == null) return;
    const host = people.find((p) => p.rid)?.rid ?? null;
    const same = !!init && init.date === date && init.time === time;
    onSave({
      ...init,
      id: init?.id ?? `rv${now().toString(36)}`,
      room: plan.key,
      date,
      meal: ml,
      time,
      size: party,
      people: people.map((p) => (p.rid ? p : { ...p, host: p.host || host })),
      tableId,
      notes: notes.trim().slice(0, 240),
      remind: remind && textable,
      remindedAt: same ? init?.remindedAt : undefined,
      createdAt: init?.createdAt ?? now(),
    });
  };
  const clashOf = (id: string) => time != null && clashes({ ...draft, tableId: id }, list).length > 0;

  return (
    <Modal
      open
      onClose={onClose}
      width={680}
      title={editing ? 'Edit reservation' : 'New reservation'}
      subtitle={plan.name}
      footer={
        <div className={s.footer}>
          <Button size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button size="lg" variant="primary" className={s.grow} disabled={!ok} onClick={save}>
            {!people.length
              ? 'Add who is coming'
              : time == null
                ? 'Pick a time'
                : editing
                  ? 'Save changes'
                  : `Book ${partyLast({ people })}, party of ${party}, ${dayWord(date)} at ${hm(time)}`}
          </Button>
        </div>
      }
    >
      <div className={s.cap}>Who is coming</div>
      {people.length > 0 && (
        <div className={s.people}>
          {people.map((p, i) => (
            <span key={i} className={cx(s.person, p.rid && s.resident)}>
              {personName(p)}
              {p.guest ? ` (${p.gid && p.rel ? p.rel : 'guest'})` : ''}
              <button className={s.remove} onClick={() => setPeople((a) => a.filter((_, j) => j !== i))} aria-label={`Remove ${personName(p)}`}>
                <X size={14} strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        ref={input}
        className={s.input}
        value={q}
        autoFocus={!editing}
        maxLength={40}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          if (hits.length) addPerson({ rid: hits[0].id });
          else if (guestHits.length) addPerson(guestPerson(guestHits[0]));
          else addTyped();
        }}
        aria-label="Resident name, apartment or guest name"
        placeholder={people.length ? 'Add someone else' : 'Resident name or apartment, or type a guest’s name'}
      />
      {q.trim() && (
        <div className={s.hits}>
          {hits.map((r) => (
            <button key={r.id} className={s.hit} onClick={() => addPerson({ rid: r.id })}>
              <Avatar person={r} size={30} />
              <span className={s.hitText}>
                <span className={s.hitName}>{r.name}</span>
                <span className={s.hitSub}>Apt {r.apt}</span>
              </span>
              <Plus size={16} strokeWidth={2.5} className={s.plus} />
            </button>
          ))}
          {guestHits.map((g) => (
            <button key={g.id} className={s.hit} onClick={() => addPerson(guestPerson(g))}>
              <span className={s.hitText}>
                <span className={s.hitName}>{g.name}</span>
                <span className={s.hitSub}>
                  Guest on file · {g.rel} of {personName({ rid: g.host })}
                  {g.mobile ? '' : ' · no mobile'}
                </span>
              </span>
              <Plus size={16} strokeWidth={2.5} className={s.plus} />
            </button>
          ))}
          <button className={cx(s.hit, s.addGuest)} onClick={addTyped}>
            <Plus size={16} strokeWidth={2.5} />
            Add “{q.trim()}” as a guest
          </button>
        </div>
      )}
      {!q.trim() && suggested.length > 0 && (
        <div className={s.suggest}>
          <span className={s.suggestLabel}>Guests on file:</span>
          {suggested.map((g) => (
            <button key={g.id} className={s.chip} onClick={() => addPerson(guestPerson(g))}>
              + {g.name} ({g.rel})
            </button>
          ))}
        </div>
      )}
      <div className={s.sizeRow}>
        <span className={s.sizeLabel}>Party size</span>
        <Stepper value={party} onChange={(v) => setSize(Math.max(v, people.length, 1))} min={Math.max(1, people.length)} max={20} />
        {party > people.length && people.length > 0 && <span className={s.unnamed}>{party - people.length} not named yet</span>}
      </div>

      <div className={s.cap}>When</div>
      <div className={s.chips}>
        <button className={cx(s.chip, isToday && s.on)} aria-pressed={isToday} onClick={() => pickDay(dayFromToday(0))}>
          Today
        </button>
        <button className={cx(s.chip, date === dayFromToday(1) && s.on)} aria-pressed={date === dayFromToday(1)} onClick={() => pickDay(dayFromToday(1))}>
          Tomorrow
        </button>
        <input
          type="date"
          className={cx(s.chip, s.date, !isToday && date !== dayFromToday(1) && s.on)}
          value={date}
          min={dayFromToday(0)}
          aria-label="Another day"
          onChange={(e) => e.target.value && pickDay(e.target.value)}
        />
        <span className={s.gap} />
        {RESV_MEALS.map((m) => (
          <button key={m} className={cx(s.chip, ml === m && s.on)} aria-pressed={ml === m} onClick={() => pickMeal(m)}>
            {m}
          </button>
        ))}
      </div>
      <div className={s.slots} role="group" aria-label="Time">
        {slots.map((t) => (
          <button key={t} className={cx(s.slot, t === time && s.slotOn, past(t) && s.slotPast)} disabled={past(t)} aria-pressed={t === time} onClick={() => setTime(t)}>
            {hm(t)}
          </button>
        ))}
      </div>

      <div className={cx(s.cap, s.capRow)}>
        <span className={s.grow}>Table</span>
        <button className={cx(s.chip, s.small, !tableId && s.on)} aria-pressed={!tableId} onClick={() => setTableId(null)}>
          Assign at arrival
        </button>
        <button className={cx(s.chip, s.small)} onClick={() => setView(view === 'map' ? 'list' : 'map')}>
          {view === 'map' ? 'Show a list' : 'Show the map'}
        </button>
      </div>
      {view === 'map' ? (
        <div className={s.map}>
          <FloorPlan
            plan={plan}
            compact
            minHeight={220}
            tile={(t, box) => {
              const on = t.id === tableId;
              const c = clashOf(t.id);
              return (
                <button
                  key={t.id}
                  style={box}
                  className={cx(s.mapTable, t.shape === 'round' && s.round, on && s.mapOn, !on && c && s.mapClash)}
                  aria-pressed={on}
                  title={c ? `${t.label} has another booking near this time` : t.label}
                  onClick={() => setTableId(on ? null : t.id)}
                >
                  {t.label}
                </button>
              );
            }}
          />
        </div>
      ) : (
        <div className={s.chips}>
          {plan.tables.map((t) => {
            const on = t.id === tableId;
            return (
              <button key={t.id} className={cx(s.chip, on && s.on, !on && clashOf(t.id) && s.chipClash)} aria-pressed={on} onClick={() => setTableId(on ? null : t.id)}>
                {t.label}
              </button>
            );
          })}
        </div>
      )}
      <div className={s.hint}>{tableId ? `${tableLabel(tableId, labelOf)} is held from an hour before.` : 'The host picks a table when they arrive.'}</div>
      {clash.length > 0 && (
        <div className={s.clash} role="alert">
          ⚠ {tableLabel(tableId, labelOf)} is also booked for {clash.map((x) => `${partyName(x)} at ${hm(x.time)}`).join(' and ')}. Tables turn in about 90 minutes, so
          pick another table or another time if you can.
        </div>
      )}

      <div className={s.cap}>Notes</div>
      <div className={s.chips}>
        {RESV_NOTES.map((w) => {
          const on = hasNote(notes, w);
          return (
            <button key={w} className={cx(s.chip, s.small, on && s.on)} aria-pressed={on} onClick={() => setNotes((n) => toggleNote(n, w))}>
              {on && <Check size={13} strokeWidth={3} />}
              {w}
            </button>
          );
        })}
      </div>
      <TextArea value={notes} rows={2} maxLength={240} onChange={(e) => setNotes(e.target.value)} aria-label="Notes" placeholder="Occasion, mobility, seating, who is paying..." className={s.notes} />

      <div className={s.cap}>Texts</div>
      <label className={cx(s.check, !textable && s.checkOff)}>
        <input type="checkbox" checked={remind && textable} disabled={!textable} onChange={(e) => setRemind(e.target.checked)} />
        Text a reminder an hour before
      </label>
      {people.length > 0 && (
        <div className={s.recipients} aria-live="polite">
          {recipientsLine(people)}
        </div>
      )}
      <div className={s.small2}>Each resident and guest with a mobile on file gets their own text.</div>
    </Modal>
  );
}
