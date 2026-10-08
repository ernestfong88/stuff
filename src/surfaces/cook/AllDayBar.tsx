import type { AllDayCount } from './cookTickets';
import s from './AllDayBar.module.css';

/**
 * ALL DAY: a strip under the header with how many of each plate the line
 * still has to make: the solid number is on the line now, the outlined one
 * is sent but not fired yet (a later course, or a pick up booked ahead).
 */
export function AllDayBar({ counts }: { counts: AllDayCount[] }) {
  const waiting = counts.some((c) => c.waiting > 0);
  return (
    <section className={s.bar} aria-label="All day: plates still to make">
      <span className={s.label}>
        All day
        {waiting && (
          <span className={s.key}>
            <span className={s.keyOn}>On the line</span>
            <span className={s.keyWait}>Not fired</span>
          </span>
        )}
      </span>
      {counts.length ? (
        <ul className={s.list}>
          {counts.map((c) => (
            <li
              key={c.name}
              className={s.item}
              aria-label={`${c.name}: ${c.count} on the line${c.waiting ? `, ${c.waiting} not fired yet` : ''}`}
            >
              {c.count > 0 && <span className={s.count}>{c.count}</span>}
              {c.waiting > 0 && <span className={s.waiting}>{c.count > 0 ? `+${c.waiting}` : c.waiting}</span>}
              <span className={s.name}>{c.name}</span>
            </li>
          ))}
        </ul>
      ) : (
        <span className={s.none}>Nothing left to make on this screen.</span>
      )}
    </section>
  );
}
