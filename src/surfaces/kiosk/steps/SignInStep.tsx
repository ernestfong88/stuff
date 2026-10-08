import { Delete } from 'lucide-react';
import { residents } from '../../../data';
import { cx } from '../../../ui';
import { aptLetters, findResidents } from '../model/residents';
import { KButton } from '../ui/KButton';
import { Question } from '../ui/Layout';
import type { KioskFlow } from '../useKioskFlow';
import s from './SignInStep.module.css';

const PHONE_DIGITS = 4;
const APT_CHARS = 6;

/** Whether "Find me" can be tapped yet. */
export function canFind(flow: KioskFlow): boolean {
  const { by, typed } = flow.s;
  return by === 'apt' ? typed.length > 0 : typed.length >= PHONE_DIGITS;
}

/** "Find me": on to the resident (or a choice of residents), or say nobody matched. */
export function findMe(flow: KioskFlow): void {
  const found = findResidents(residents, flow.s.by, flow.s.typed);
  if (found.length) flow.advance({ resident: found.length === 1 ? found[0] : null });
  else flow.put({ miss: true });
}

/** Last four digits of a phone on file, or the apartment number, on a big pad. */
export function SignInStep({ flow }: { flow: KioskFlow }) {
  const { by, typed, miss } = flow.s;
  const byApt = by === 'apt';
  const letters = byApt ? aptLetters(residents) : [];
  const press = (c: string) => flow.put({ typed: (typed + c).slice(0, byApt ? APT_CHARS : PHONE_DIGITS), miss: false });
  const shown = byApt ? typed || '–––' : (typed + '––––').slice(0, PHONE_DIGITS);
  return (
    <div>
      <Question title={byApt ? 'What is your apartment number?' : 'What are the last four digits of your phone number?'} />
      <div className={s.wrap}>
        <div>
          <div className={cx(s.display, miss && s.displayMiss, !typed && s.displayEmpty)} aria-live="polite" aria-label={typed ? `Typed ${typed.split('').join(' ')}` : 'Nothing typed yet'}>
            {shown}
          </div>
          {miss ? (
            <p className={s.miss} role="alert">
              {byApt
                ? `We couldn't find apartment ${typed}. Please check the number and try again.`
                : `We couldn't find a phone ending in ${typed}. Please check the digits, or use your apartment number.`}
            </p>
          ) : (
            <p className={s.hint}>
              {letters.length
                ? 'Use the number and letter keys, then tap Find me.'
                : byApt
                  ? 'Use the number pad, then tap Find me.'
                  : 'Use the number pad, then tap Find me. Any phone we have on file works.'}
            </p>
          )}
        </div>
        <div className={s.pads}>
          <div className={cx(s.pad, letters.length > 0 && s.padTight)}>
            {'123456789'.split('').map((d) => (
              <KButton key={d} className={s.key} onClick={() => press(d)}>
                {d}
              </KButton>
            ))}
            <KButton className={cx(s.key, s.keyWord)} onClick={() => flow.put({ typed: '', miss: false })}>
              Clear
            </KButton>
            <KButton className={s.key} onClick={() => press('0')}>
              0
            </KButton>
            <KButton className={s.key} aria-label="Delete" onClick={() => flow.put({ typed: typed.slice(0, -1), miss: false })}>
              <Delete size="1.4em" strokeWidth={2.2} aria-hidden />
            </KButton>
          </div>
          {letters.length > 0 && (
            <div className={s.letters} role="group" aria-label="Letters">
              {letters.map((c) => (
                <KButton key={c} className={cx(s.key, s.letter)} onClick={() => press(c)}>
                  {c}
                </KButton>
              ))}
            </div>
          )}
          <KButton block className={s.switch} onClick={() => flow.put({ by: byApt ? 'phone' : 'apt', typed: '', miss: false })}>
            {byApt ? 'Use my phone number instead' : 'No phone? Use your apartment number'}
          </KButton>
        </div>
      </div>
    </div>
  );
}
