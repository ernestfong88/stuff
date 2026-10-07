import { useEffect, useState } from 'react';
import { Delete } from 'lucide-react';
import { COMMUNITY_NAME } from '../data';
import { cx } from '../ui/cx';
import { checkPin, signIn } from './session';
import s from './SignIn.module.css';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

/** PIN pad shown on the floor devices when nobody is signed in. */
export function SignIn() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (pin.length < 4) return;
    const who = checkPin(pin);
    if (who) {
      signIn(who.id);
      return;
    }
    setError(true);
    const t = setTimeout(() => {
      setPin('');
      setError(false);
    }, 600);
    return () => clearTimeout(t);
  }, [pin]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < 4 ? p + e.key : p));
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const press = (k: string) => {
    if (k === 'del') setPin((p) => p.slice(0, -1));
    else if (k) setPin((p) => (p.length < 4 ? p + k : p));
  };

  return (
    <div className={s.screen}>
      <div className={s.card}>
        <img src="./kisco-logo.png" alt="" className={s.logo} />
        <div className={s.brand}>KiscoConnect Dining</div>
        <div className={s.community}>{COMMUNITY_NAME}</div>
        <div className={s.prompt}>Enter your 4-digit PIN</div>
        <div className={cx(s.dots, error && 'shake')} aria-live="polite">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cx(s.dot, i < pin.length && s.filled, error && s.err)} />
          ))}
        </div>
        <div className={s.pad}>
          {KEYS.map((k, i) =>
            k ? (
              <button key={i} className={cx(s.key, k === 'del' && s.del)} onClick={() => press(k)} aria-label={k === 'del' ? 'Delete' : k}>
                {k === 'del' ? <Delete size={22} /> : k}
              </button>
            ) : (
              <span key={i} />
            ),
          )}
        </div>
        <div className={s.hint}>Demo PINs: Adriana 2468 · Ricardo 1357 · Maria 1122</div>
      </div>
    </div>
  );
}
