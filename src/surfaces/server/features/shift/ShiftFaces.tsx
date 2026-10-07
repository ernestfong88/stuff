import type { Order } from '../../../../domain/types';
import { Avatar, cx } from '../../../../ui';
import { tablePeople } from '../shared/tablePeople';
import s from './ShiftFaces.module.css';

const MAX = 5;

/** Who sat at a closed check: faces and first names, guests in grey. */
export function ShiftFaces({ order }: { order: Order }) {
  const people = tablePeople(order);
  const shown = people.slice(0, people.length > MAX ? MAX - 1 : MAX);
  return (
    <div className={s.faces}>
      {shown.map((p) => (
        <span key={p.key} className={s.person}>
          <Avatar person={p.resident ?? { name: p.name }} size={26} />
          <span className={cx(s.name, p.guest && s.guest)}>{p.first}</span>
        </span>
      ))}
      {people.length > shown.length && <span className={s.more}>+{people.length - shown.length}</span>}
    </div>
  );
}
