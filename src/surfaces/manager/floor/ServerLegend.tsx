import type { ServerOnFloor } from '../../../domain/servers';
import s from './ServerLegend.module.css';

/** __KSrvLegend: each server's colour, name and open checks. */
export function ServerLegend({ servers, label = 'Servers' }: { servers: ServerOnFloor[]; label?: string }) {
  return (
    <ul className={s.legend} aria-label={label}>
      {servers.map((sv) => (
        <li key={sv.id} className={s.item} title={`${sv.name || sv.id}: ${sv.open} open`}>
          <span className={s.dot} style={{ background: sv.color }}>
            {sv.id}
          </span>
          {sv.name && <span className={s.name}>{sv.name}</span>}
          <span className={s.count}>{sv.open}</span>
        </li>
      ))}
    </ul>
  );
}
