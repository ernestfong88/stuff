import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { COMMUNITY_NAME, residents } from '../../../../../data';
import { residentPhoto } from '../../../../../data/photos';
import type { Resident } from '../../../../../domain/types';
import { now } from '../../../../../lib/clock';
import { uid } from '../../../../../lib/id';
import { useMe } from '../../../../../shell/session';
import { gameClues } from '../../../../../store/residentStories';
import { Avatar, Button, Modal, cx } from '../../../../../ui';
import { careLevel } from '../residentInfo';
import {
  BONUS_MS,
  CARE_TYPES,
  COUNTDOWN_MS,
  MAIN_MS,
  MAX_PLAYS_PER_DAY,
  STRIKES_OUT,
  enoughForGame,
  gamePool,
  makeQuestions,
  myRank,
  playsLeft,
  type CareType,
  type GameMode,
} from './gameLogic';
import { currentQuestion, gameReducer, initialGame, type GameState } from './gameMachine';
import { gameTypesStore, recordPlay, updatePlay, useGamePlays, useGameTypes } from './gameStore';
import { HighScores } from './HighScores';
import s from './ResidentsGame.module.css';

const hasPhoto = (id: string) => !!residentPhoto(id);

/** Faces once at least four residents have a photo on file; apartments until then. */
export function gameMode(): GameMode {
  return residents.filter((r) => hasPhoto(r.id)).length >= 4 ? 'faces' : 'apartments';
}

/**
 * A line about a resident for the "Who you missed" list: a clue from their
 * story, else their care level (and apartment, when the apartment is not
 * already shown by their name).
 */
function missLine(r: Resident, mode: GameMode): string {
  return gameClues(r.id)[0] ?? [careLevel(r.level), mode === 'faces' && r.apt && `Apt ${r.apt}`].filter(Boolean).join(' · ');
}

const isPlaying = (g: GameState) => g.phase === 'count' || g.phase === 'main' || g.phase === 'bonusIntro' || g.phase === 'bonus';

/** The game itself, in a dialog: pick care types, play, see the results and the board. */
export function ResidentsGame({ start, onClose }: { start: boolean; onClose: () => void }) {
  const me = useMe();
  const plays = useGamePlays();
  const savedTypes = useGameTypes();
  const mode = gameMode();
  const available = CARE_TYPES.map((t) => t[0]).filter((t) => gamePool(residents, [t], mode, hasPhoto).length);
  const types = (savedTypes ?? available).filter((t) => available.includes(t));
  const [g, dispatch] = useReducer(gameReducer, undefined, () => initialGame(start ? 'setup' : 'board', now()));
  const playId = useRef<string | null>(null);
  const latest = useRef(g);
  latest.current = g;
  const left = playsLeft(plays, me.initials, now());
  const playing = isPlaying(g);

  // The clock: a tick every 100 ms while a round runs, which also redraws the timer.
  const [clock, setClock] = useState(now);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      const at = now();
      setClock(at);
      dispatch({ type: 'tick', at });
    }, 100);
    return () => clearInterval(t);
  }, [playing]);

  // Save the finished game.
  useEffect(() => {
    if (g.phase === 'done' && playId.current) {
      updatePlay(playId.current, { score: g.score, right: g.right, done: true, why: g.why ?? 'done' });
      playId.current = null;
    }
  }, [g.phase, g.score, g.right, g.why]);

  // Leaving mid-game still counts the game, with the score so far.
  useEffect(
    () => () => {
      if (playId.current) updatePlay(playId.current, { score: latest.current.score, right: latest.current.right, done: true, why: 'quit' });
    },
    [],
  );

  const pool = gamePool(residents, types, mode, hasPhoto);
  const ready = enoughForGame(pool, mode);

  const begin = () => {
    if (!ready || left <= 0) return;
    const at = now();
    const id = uid('p');
    playId.current = id;
    recordPlay({ id, who: me.initials, name: me.name, community: COMMUNITY_NAME, at, score: 0, right: 0, done: false });
    gameTypesStore.set(types);
    const q = makeQuestions(pool, mode, gameClues);
    dispatch({ type: 'start', main: q.main, bonus: q.bonus, at });
  };

  const toggleType = (t: CareType) => {
    const on = types.includes(t);
    gameTypesStore.set(on ? types.filter((x) => x !== t) : CARE_TYPES.map((c) => c[0]).filter((x) => x === t || types.includes(x)));
  };

  const title = (text: string, sub?: string) => (
    <header className={s.titleRow}>
      <div className={s.titles}>
        <h2 className={s.title}>{text}</h2>
        {sub && <p className={s.sub}>{sub}</p>}
      </div>
      <Button variant="secondary" iconOnly aria-label="Close" icon={<X size={18} />} onClick={onClose} />
    </header>
  );

  const big = (main: string, caption: string) => (
    <div className={s.big}>
      <div key={main} className={cx(s.bigText, main.length > 2 && s.bigWord)}>
        {main}
      </div>
      <div className={s.bigCaption}>{caption}</div>
    </div>
  );

  let body: ReactNode;
  if (g.phase === 'board') {
    body = (
      <>
        {title('High scores', 'Do you know the Residents?')}
        <HighScores me={me.initials} />
      </>
    );
  } else if (g.phase === 'setup') {
    const countLabel = (n: number) =>
      n ? `${n} resident${n === 1 ? '' : 's'}${mode === 'faces' ? ' with photos' : ''}` : mode === 'faces' ? 'No residents with photos yet' : 'No residents';
    body = (
      <>
        {title('Who should the quiz include?', 'Pick one or more care types. Questions and answers come only from these residents.')}
        {mode === 'apartments' && (
          <p className={s.modeNote}>
            Resident photos haven't been added yet, so round one asks where each resident lives. Once photos are added it becomes name the
            face.
          </p>
        )}
        <div className={s.types}>
          {CARE_TYPES.map(([k, label]) => {
            const n = gamePool(residents, [k], mode, hasPhoto).length;
            const on = types.includes(k);
            return (
              <button key={k} type="button" className={cx(s.type, on && s.typeOn)} aria-pressed={on} disabled={!n} onClick={() => toggleType(k)}>
                <span className={s.typeHead}>
                  <span className={s.typeCode}>{k}</span>
                  <span className={s.typeBox}>{on && <Check size={15} strokeWidth={3} />}</span>
                </span>
                <span className={s.typeName}>{label}</span>
                <span className={s.typeCount}>{countLabel(n)}</span>
              </button>
            );
          })}
        </div>
        <div className={s.footer}>
          <span className={cx(s.status, !ready && s.statusWarn)}>
            {ready
              ? `${pool.length} residents in this game · ${left} of ${MAX_PLAYS_PER_DAY} plays left today`
              : types.length
                ? 'Pick more care types. A game needs at least 4 residents.'
                : 'Pick at least one care type.'}
          </span>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="lg" disabled={!ready || !left} onClick={begin}>
            {left ? 'Start' : 'No plays left today'}
          </Button>
        </div>
      </>
    );
  } else if (g.phase === 'count') {
    body = (
      <>
        {title(
          mode === 'faces' ? 'Round 1: name the face' : 'Round 1: where do they live?',
          mode === 'faces' ? "Tap the face that goes with the name. Three misses and you're out." : "Tap their apartment. Three misses and you're out.",
        )}
        {big(String(Math.max(1, 3 - Math.floor((clock - g.phaseAt) / (COUNTDOWN_MS / 3)))), 'Get ready')}
      </>
    );
  } else if (g.phase === 'bonusIntro') {
    body = (
      <>
        {title('Bonus round', 'Double points. Match the story to the resident.')}
        {big('Bonus!', '15 seconds, 3 clues from residents’ stories')}
      </>
    );
  } else if (g.phase === 'done') {
    const here = myRank(plays, { me: me.initials, home: COMMUNITY_NAME, scope: 'home', period: '30', at: now() });
    const all = myRank(plays, { me: me.initials, home: COMMUNITY_NAME, scope: 'all', period: '30', at: now() });
    const head = g.why === 'out' ? 'Out of strikes' : g.why === 'time' ? "Time's up" : 'Nice work!';
    body = (
      <>
        {title(head, `${g.right} right, ${g.strikes} ${g.strikes === 1 ? 'miss' : 'misses'}${g.timeBonus ? `, +${g.timeBonus} time bonus` : ''}`)}
        <div className={s.results}>
          <div className={s.scoreTile}>
            <b>{g.score.toLocaleString()}</b>
            <span>this game</span>
          </div>
          <div className={s.resultTile}>
            <b>{here.rank ? `#${here.rank} of ${here.of}` : '—'}</b>
            <span>rank here, 30 days</span>
          </div>
          <div className={s.resultTile}>
            <b>{all.rank ? `#${all.rank} of ${all.of}` : '—'}</b>
            <span>company rank, 30 days</span>
          </div>
          <div className={s.resultTile}>
            <b>{here.best.toLocaleString()}</b>
            <span>your best, 30 days</span>
          </div>
        </div>
        {g.missed.length > 0 && (
          <section className={s.missed}>
            <h3 className={s.missedTitle}>Who you missed</h3>
            {g.missed.map((r, i) => (
              <div key={r.id + i} className={s.miss}>
                <span className={s.missX} aria-hidden>
                  <X size={13} strokeWidth={3} />
                </span>
                <Avatar person={r} size={52} className={s.missFace} />
                <div className={s.missText}>
                  <div className={s.missName}>
                    {r.name}
                    {mode === 'apartments' && <span className={s.missApt}> · Apt {r.apt}</span>}
                  </div>
                  <div className={s.missLine}>{missLine(r, mode)}</div>
                </div>
              </div>
            ))}
          </section>
        )}
        <HighScores me={me.initials} />
        <div className={s.footer}>
          <span className={s.status}>
            {left} of {MAX_PLAYS_PER_DAY} plays left today
          </span>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" disabled={!left} onClick={() => dispatch({ type: 'setup' })}>
            {left ? 'Play again' : 'No plays left today'}
          </Button>
        </div>
      </>
    );
  } else {
    const bonus = g.phase === 'bonus';
    const round = bonus ? g.bonus : g.main;
    const q = currentQuestion(g);
    const total = bonus ? BONUS_MS : MAIN_MS;
    // The clock pauses while an answer shows; never show more than the round's length.
    const ms = Math.min(total, Math.max(0, g.endAt - clock));
    const fb = g.feedback;
    const optionKind = mode === 'faces' ? 'face' : bonus ? 'name' : 'apt';
    body = q && (
      <>
        <header className={s.playHead}>
          <div>
            <div className={cx(s.roundLabel, bonus && s.roundBonus)}>{bonus ? 'Bonus round · 2x' : 'Round 1'}</div>
            <div className={s.progress}>
              {g.index + 1} of {round.length}
            </div>
          </div>
          <div className={s.timer}>
            <div className={s.track}>
              <div className={cx(s.fill, bonus && s.fillBonus, ms < 5000 && s.fillLow)} style={{ width: `${(100 * ms) / total}%` }} />
            </div>
            <span className={cx(s.secs, ms < 5000 && s.secsLow)}>{Math.ceil(ms / 1000)}s</span>
          </div>
          <div className={s.strikes} aria-label={`${g.strikes} of ${STRIKES_OUT} misses`}>
            {Array.from({ length: STRIKES_OUT }, (_, i) => (
              <span key={i} className={cx(s.strike, i < g.strikes && s.strikeOn)}>
                {i < g.strikes && <X size={13} strokeWidth={3} />}
              </span>
            ))}
          </div>
          <div className={s.score}>{g.score.toLocaleString()}</div>
          <Button variant="secondary" iconOnly aria-label="Stop the game" icon={<X size={18} />} onClick={onClose} />
        </header>
        <div className={s.prompt} aria-live="polite">
          <div className={s.promptSmall}>
            {fb
              ? fb.right
                ? `+${fb.points}${fb.fast ? ' · fast!' : ''}`
                : `Strike ${g.strikes}${g.strikes >= STRIKES_OUT ? " · you're out" : ''}`
              : bonus
                ? 'Who is this?'
                : mode === 'faces'
                  ? 'Which one is'
                  : 'Where does this resident live?'}
          </div>
          <div className={cx(s.promptBig, bonus && s.promptClue, fb && (fb.right ? s.promptRight : s.promptWrong))}>
            {bonus ? `“${q.clue}”` : q.target.name}
          </div>
        </div>
        <div className={s.options}>
          {q.options.map((r) => {
            const isRight = !!fb && r.id === q.target.id;
            const isWrong = !!fb && !fb.right && r.id === fb.pickedId;
            return (
              <button
                key={r.id}
                type="button"
                disabled={!!fb}
                onClick={() => dispatch({ type: 'pick', residentId: r.id, at: now() })}
                className={cx(s.option, isRight && s.optRight, isWrong && s.optWrong, fb && !isRight && !isWrong && s.optDim)}
                aria-label={optionKind === 'face' ? `Face ${q.options.indexOf(r) + 1}` : undefined}
              >
                {optionKind === 'face' && <img className={s.face} src={residentPhoto(r.id) ?? undefined} alt="" draggable={false} />}
                {optionKind === 'apt' && <span className={s.apt}>Apt {r.apt}</span>}
                {optionKind === 'name' && (
                  <span className={s.nameOpt}>
                    <Avatar person={r} size={48} />
                    <span>{r.name}</span>
                  </span>
                )}
                <span className={s.caption}>{fb && optionKind !== 'name' ? r.name : ''}</span>
              </button>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <Modal open onClose={onClose} width={840} hideClose persistent={playing} className={s.modal}>
      {body}
    </Modal>
  );
}
