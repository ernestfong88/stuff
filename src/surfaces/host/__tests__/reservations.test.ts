import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { residents, seedOrders } from '../../../data';
import { fillText, recipients, recipientsLine } from '../reservations/contacts';
import {
  clashes,
  dayFromToday,
  hasNote,
  heldFor,
  hm,
  hmAmPm,
  mealAtMinutes,
  mealSlots,
  partyList,
  partyName,
  resvAt,
  resvStatus,
  seatedDelta,
  seatsFor,
  toggleNote,
  type Reservation,
} from '../reservations/model';
import { seedReservations } from '../reservations/store';
import { searchResidents } from '../residentSearch';

/** 5:45 PM on a fixed day. */
const T0 = new Date(2026, 9, 7, 17, 45, 0, 0).getTime();
const MIN = 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

const resv = (extra: Partial<Reservation>): Reservation => ({
  id: 'r' + Math.random(),
  room: 'sequoia',
  date: dayFromToday(0),
  time: 18 * 60,
  meal: 'Dinner',
  size: 2,
  people: [{ rid: 'r3' }, { gid: 'g7', guest: 'Jim Carver', rel: 'Friend', host: 'r3' }],
  tableId: 't_eg8',
  notes: '',
  remind: false,
  createdAt: T0 - 60 * MIN,
  ...extra,
});

describe('reservation times', () => {
  it('formats slots and picks the meal from the time', () => {
    expect(hm(1020)).toBe('5:00');
    expect(hmAmPm(690)).toBe('11:30 AM');
    expect([mealAtMinutes(480), mealAtMinutes(700), mealAtMinutes(1000)]).toEqual(['Breakfast', 'Lunch', 'Dinner']);
    expect(mealSlots('Dinner')).toEqual([1020, 1035, 1050, 1065, 1080, 1095, 1110, 1125]);
  });

  it('is booked, arriving soon, late, then seated', () => {
    const r = resv({ time: 18 * 60 + 30 });
    expect(resvStatus(r, T0)).toBe('booked');
    expect(resvStatus({ ...r, time: 18 * 60 }, T0)).toBe('soon');
    expect(resvStatus({ ...r, time: 17 * 60 + 30 }, T0)).toBe('late');
    expect(resvStatus({ ...r, seatedAt: T0 }, T0)).toBe('seated');
    expect(resvStatus({ ...r, noShowAt: T0 }, T0)).toBe('noshow');
    expect(seatedDelta(r, resvAt(r) + 19 * MIN)).toBe('19 min late');
    expect(seatedDelta(r, resvAt(r))).toBe('on time');
  });
});

describe('tables and parties', () => {
  it('holds a table from an hour before until 30 minutes late', () => {
    const r = resv({ time: 18 * 60 + 30 });
    expect(heldFor('t_eg8', 'sequoia', [r], T0)?.id).toBe(r.id);
    expect(heldFor('t_eg8', 'sequoia', [r], T0 - 30 * MIN)).toBeNull();
    expect(heldFor('t_eg8', 'sequoia', [r], resvAt(r) + 31 * MIN)).toBeNull();
  });

  it('warns about two bookings within one table turn', () => {
    const a = resv({ time: 18 * 60 });
    const b = resv({ time: 19 * 60 });
    const c = resv({ time: 20 * 60 });
    expect(clashes(a, [a, b, c]).map((x) => x.id)).toEqual([b.id]);
    expect(clashes({ ...a, tableId: null }, [a, b])).toEqual([]);
  });

  it('names the party and seats guests against their resident', () => {
    const r = resv({});
    expect(partyName(r)).toBe('Tom Beaumont +1');
    expect(partyList(r)).toBe('Tom Beaumont, Jim Carver (Friend)');
    expect(seatsFor(r)).toEqual([
      { name: 'Tom Beaumont', residentId: 'r3' },
      { name: 'Jim Carver', residentId: null, guest: { name: 'Jim Carver', rel: 'Friend' }, host: 'r3' },
    ]);
  });

  it('starts the day’s book with one party seated at a check that is open now', () => {
    const list = seedReservations(seedOrders(), T0);
    const seated = list.filter((r) => r.seatedAt && r.orderId);
    expect(seated).toHaveLength(1);
    expect(partyName(seated[0])).toBe('Marty Martin +4');
    expect(list.some((r) => r.noShowAt)).toBe(true);
    expect(list.some((r) => r.date === dayFromToday(1))).toBe(true);
  });
});

describe('texts', () => {
  it('texts residents and guests on file with a mobile, and says who it cannot', () => {
    const r = recipients([{ rid: 'r3' }, { rid: 'r4' }, { rid: 'r6' }, { gid: 'g7' }, { guest: 'Lucy' }]);
    expect(r.to.map((x) => x.name)).toEqual(['Tom Beaumont', 'Jim Carver']);
    expect(r.skip).toEqual([
      { name: 'Rose Delgado', why: 'home phone only' },
      { name: 'Joan Petrovic', why: 'no mobile on file' },
      { name: 'Lucy', typed: true },
    ]);
    expect(recipientsLine([{ rid: 'r3' }, { guest: 'Lucy' }])).toBe('Texts Tom (1). No mobile for: Guest “Lucy”.');
  });

  it('fills placeholders and leaves unknown ones as written', () => {
    expect(fillText('Hi {first}, see you at {time}. {nope}', { first: 'Tom', time: '6:00 PM' })).toBe('Hi Tom, see you at 6:00 PM. {nope}');
  });
});

describe('notes and search', () => {
  it('toggles one-tap notes without losing the rest', () => {
    expect(toggleNote('', 'Birthday')).toBe('Birthday');
    expect(toggleNote('Birthday', 'Walker')).toBe('Birthday. Walker');
    expect(toggleNote('Birthday. Walker', 'Birthday')).toBe('Walker');
    expect(hasNote('uses a WALKER', 'Walker')).toBe(true);
  });

  it('finds residents by apartment first, then name', () => {
    expect(searchResidents(residents, '308', 3)[0].name).toBe('Tom Beaumont');
    expect(searchResidents(residents, 'mar', 7).map((r) => r.name)).toContain('Marty Martin');
    expect(searchResidents(residents, 'zzz', 7)).toEqual([]);
  });
});
