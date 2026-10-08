import { useMemo, useState } from 'react';
import { today } from '../../../../lib/clock';
import { useDiningHistory, useDiningOrders } from '../../../../store/dining';
import { monthBoard, serverTrivia, useTrivia } from '../../../../store/trivia';
import { Avatar, Tabs } from '../../../../ui';
import { RankBadge } from './RankBadge';
import { TriviaServersCard } from './TriviaServersCard';
import s from './TriviaScoreboard.module.css';

/** The trivia scoreboard at the end of a shift: this month or last, and how often each server played it. */
export function TriviaScoreboard({ who }: { who: string }) {
  const state = useTrivia();
  const orders = useDiningOrders();
  const history = useDiningHistory();
  const [period, setPeriod] = useState<'this' | 'last'>('this');
  const now = today();
  const ref = new Date(now.getFullYear(), now.getMonth() + (period === 'last' ? -1 : 0), 1, 12);
  const month = ref.toLocaleDateString('en-US', { month: 'long' });
  const live = useMemo(() => [...orders, ...history], [orders, history]);
  const board = monthBoard(state, ref.getFullYear(), ref.getMonth());
  const servers = serverTrivia(state, ref.getFullYear(), ref.getMonth(), live);
  return (
    <div className={s.wrap}>
      <div className={s.head}>
        <h2 className={s.title}>{month} scoreboard</h2>
        <Tabs
          aria-label="Month"
          size="sm"
          value={period}
          onChange={setPeriod}
          options={[
            { id: 'this', label: 'This month' },
            { id: 'last', label: 'Last month' },
          ]}
        />
      </div>
      <TriviaServersCard rows={servers} me={who} month={month} />
      <section className={s.board} aria-label={`${month} standings`}>
        {!board.length && <p className={s.empty}>No one played in {month}.</p>}
        {board.slice(0, 20).map((e) => (
          <div key={e.resident.id} className={s.row}>
            <RankBadge rank={e.rank} />
            <Avatar person={e.resident} size={34} />
            <div className={s.who}>
              <div className={s.name}>{e.resident.name}</div>
              <div className={s.days}>
                {e.days} {e.days === 1 ? 'day played' : 'days played'}
              </div>
            </div>
            <span className={s.pts}>{e.pts}</span>
            <span className={s.unit}>{e.pts === 1 ? 'point' : 'points'}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
