import { UserPlus } from 'lucide-react';
import { getResident } from '../../../../data';
import { dinerPerson } from '../../../../domain/orders';
import type { Order, Resident } from '../../../../domain/types';
import { Avatar, cx } from '../../../../ui';
import s from './SpouseSuggest.module.css';

/** The first resident at the table whose spouse is not seated yet. */
export function spouseToAdd(o: Order): { host: Resident; spouse: Resident } | null {
  for (const d of o.diners) {
    if (d.kind !== 'resident' || d.isGuest) continue;
    const host = dinerPerson(d) as Resident | undefined;
    const spouse = host?.spouse ? getResident(host.spouse) : undefined;
    if (host && spouse && !o.diners.some((x) => x.kind === 'resident' && x.refId === spouse.id)) return { host, spouse };
  }
  return null;
}

/** "Add Cathie? Marty's spouse · Apt 153" */
export function SpouseSuggest({ host, spouse, onAdd }: { host: Resident; spouse: Resident; onAdd: () => void }) {
  return (
    <button className={cx(s.card, 'fade-in')} onClick={onAdd}>
      <Avatar person={spouse} size={36} />
      <span className={s.text}>
        <span className={s.title}>Add {spouse.name.split(' ')[0]}?</span>
        <span className={s.sub}>
          {host.name.split(' ')[0]}'s spouse · Apt {spouse.apt}
        </span>
      </span>
      <span className={s.add}>
        <UserPlus size={14} strokeWidth={2} aria-hidden /> Add
      </span>
    </button>
  );
}
