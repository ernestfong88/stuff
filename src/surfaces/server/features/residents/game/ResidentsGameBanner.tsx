import { useState } from 'react';
import { COMMUNITY_NAME, getResident } from '../../../../../data';
import { useMe } from '../../../../../shell/session';
import { Avatar, Button, useNow } from '../../../../../ui';
import { MAX_PLAYS_PER_DAY, myRank, playsLeft } from './gameLogic';
import { useGamePlays } from './gameStore';
import { ResidentsGame, gameMode } from './ResidentsGame';
import s from './ResidentsGameBanner.module.css';

const FACES = ['r2', 'r5', 'r4', 'r9'];

/** The game's banner at the top of the Residents page: plays left, best score, top here. */
export function ResidentsGameBanner() {
  const me = useMe();
  const plays = useGamePlays();
  const at = useNow(60_000);
  const [mode, setMode] = useState<'play' | 'board' | null>(null);
  const left = playsLeft(plays, me.initials, at);
  const mine = myRank(plays, { me: me.initials, home: COMMUNITY_NAME, scope: 'home', period: '30', at });
  const faces = gameMode() === 'faces';
  return (
    <section className={s.banner} aria-label="Do you know the Residents? game">
      <div className={s.faces} aria-hidden>
        {FACES.map((id) => (
          <Avatar key={id} person={getResident(id)} size={42} className={s.face} />
        ))}
      </div>
      <div className={s.text}>
        <h2 className={s.title}>Do you know the Residents?</h2>
        <p className={s.sub}>
          {faces ? 'Match each name to the right face' : 'Match each resident to their apartment'}, then a bonus round from their stories. 60
          seconds, faster answers score more, and three misses ends the game.
        </p>
      </div>
      <div className={s.stats}>
        <div className={s.stat}>
          <b>
            {left} of {MAX_PLAYS_PER_DAY}
          </b>
          <span>plays left today</span>
        </div>
        <div className={s.stat}>
          <b>{mine.best ? mine.best.toLocaleString() : '—'}</b>
          <span>your best, 30 days</span>
        </div>
        <div className={s.stat}>
          <b>{mine.top ? mine.top.score.toLocaleString() : '—'}</b>
          <span>{mine.top ? `top here: ${mine.top.name.split(' ')[0]}` : 'top here'}</span>
        </div>
      </div>
      <div className={s.actions}>
        <Button variant="ghost" className={s.scores} onClick={() => setMode('board')}>
          High scores
        </Button>
        <Button className={s.play} disabled={!left} onClick={() => setMode('play')}>
          {left ? 'Play' : 'Back tomorrow'}
        </Button>
      </div>
      {mode && <ResidentsGame start={mode === 'play'} onClose={() => setMode(null)} />}
    </section>
  );
}
