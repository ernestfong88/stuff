import type { AllDayCount } from './cookTickets';
import s from './AllDayBar.module.css';

/** ALL DAY: a strip under the header with how many of each plate the line still has to make. */
export function AllDayBar({ counts }: { counts: AllDayCount[] }) {
  return (
    <section className={s.bar} aria-label="All day: plates still to make">
      <span className={s.label}>All day</span>
      {counts.length ? (
        <ul className={s.list}>
          {counts.map((c) => (
            <li key={c.name} className={s.item}>
              <span className={s.count}>{c.count}</span>
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
