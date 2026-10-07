import { dinerName, dinerPerson } from '../../../../domain/orders';
import type { Order, Resident } from '../../../../domain/types';

export interface TablePerson {
  /** Diner id (stable key). */
  key: string;
  /** Resident id for a resident (never for a guest). */
  residentId?: string;
  resident?: Resident;
  /** Full name ("Marty Martin", or the guest's name). */
  name: string;
  first: string;
  guest: boolean;
}

/**
 * Everyone at a check, once each: residents by their record (a resident on
 * two seats is one person), guests and associates by name.
 */
export function tablePeople(o: Pick<Order, 'diners'>): TablePerson[] {
  const seen = new Set<string>();
  const out: TablePerson[] = [];
  for (const d of o.diners ?? []) {
    const resident = d.kind === 'resident' && !d.isGuest ? (dinerPerson(d) as Resident | undefined) : undefined;
    const key = resident ? resident.id : d.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const name = resident ? resident.name : dinerName(d);
    out.push({ key: d.id, residentId: resident?.id, resident, name, first: name.split(' ')[0], guest: !resident });
  }
  return out;
}

/** Residents (not guests) at a check, once each. */
export function tableResidents(o: Pick<Order, 'diners'>): Resident[] {
  return tablePeople(o).flatMap((p) => (p.resident ? [p.resident] : []));
}
