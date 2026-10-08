import { useState } from 'react';
import { COMMUNITY_NAME } from '../../../../../data';
import { cx, Tabs, useNow } from '../../../../../ui';
import { highScores, type GamePlay } from './gameLogic';
import { useGamePlays } from './gameStore';
import s from './HighScores.module.css';

const SHOWN = 8;

/** Best score per associate, here or across communities, last 30 days or all time. */
export function HighScores({ me }: { me: string }) {
  const plays = useGamePlays();
  const at = useNow(60_000);
  const [scope, setScope] = useState<'home' | 'all'>('home');
  const [period, setPeriod] = useState<'30' | 'all'>('30');
  const list = highScores(plays, { me, home: COMMUNITY_NAME, scope, period, at });
  const mine = list.findIndex((x) => x.who === me && x.community === COMMUNITY_NAME);

  const row = (x: GamePlay, i: number) => {
    const isMe = i === mine;
    return (
      <div key={x.who + x.community} className={cx(s.row, isMe && s.me)}>
        <span className={cx(s.rank, i < 3 && s.top)}>#{i + 1}</span>
        <span className={s.name}>
          {x.name}
          {isMe && ' (you)'}
        </span>
        {scope === 'all' && <span className={s.community}>{x.community}</span>}
        <span className={s.score}>{x.score.toLocaleString()}</span>
      </div>
    );
  };

  return (
    <div>
      <div className={s.filters}>
        <Tabs
          size="sm"
          aria-label="Where"
          value={scope}
          onChange={setScope}
          options={[
            { id: 'home', label: COMMUNITY_NAME },
            { id: 'all', label: 'All communities' },
          ]}
        />
        <Tabs
          size="sm"
          aria-label="When"
          value={period}
          onChange={setPeriod}
          options={[
            { id: '30', label: 'Last 30 days' },
            { id: 'all', label: 'All time' },
          ]}
        />
      </div>
      <div className={s.list}>
        {list.length ? list.slice(0, SHOWN).map(row) : <p className={s.empty}>No scores yet.</p>}
        {mine >= SHOWN && (
          <>
            <div className={s.gap} aria-hidden>
              · · ·
            </div>
            {row(list[mine], mine)}
          </>
        )}
      </div>
      {mine < 0 && <p className={s.empty}>Play a game to get on the board.</p>}
    </div>
  );
}
