import { serverName } from '../../../../domain/servers';
import type { ServerTriviaRow } from '../../../../store/trivia';
import { BarRow } from '../shared/BarRow';
import s from './TriviaServersCard.module.css';

/** Green from 70%, amber from 50%, red below. */
export function triviaRateColor(pct: number | null): string {
  if (pct == null) return 'var(--s200)';
  return pct >= 70 ? 'var(--green)' : pct >= 50 ? '#b07a1e' : 'var(--danger)';
}

/** How often each server played trivia at their tables in a month. */
export function TriviaServersCard({ rows, me, month }: { rows: ServerTriviaRow[]; me?: string; month: string }) {
  return (
    <section className={s.card}>
      <h3 className={s.cap}>Trivia at each server's tables</h3>
      <p className={s.sub}>
        How often each server played the question of the day with a table in {month}. A table counts once the answer is revealed there.
      </p>
      {rows.length ? (
        <div className={s.rows}>
          {rows.map((r) => (
            <BarRow
              key={r.server}
              mine={r.server === me}
              label={(r.server === me ? 'You · ' : '') + serverName(r.server)}
              pct={r.pct ?? 0}
              value={r.pct == null ? '–' : `${r.pct}%`}
              detail={`${r.played} of ${r.tables} tables`}
              color={triviaRateColor(r.pct)}
            />
          ))}
        </div>
      ) : (
        <p className={s.sub}>No tables yet.</p>
      )}
    </section>
  );
}
