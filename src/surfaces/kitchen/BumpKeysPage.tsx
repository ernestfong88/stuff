import { ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cx } from '../../ui';
import {
  actionForKey,
  actionLabel,
  ASSIGNABLE_ACTIONS,
  assignBumpKey,
  barKeyName,
  BUMP_ACTIONS,
  DEFAULT_BUMP_KEYS,
  keyName,
  resetBumpKeys,
  resolveBumpKeys,
  useBumpAssignments,
  type BumpAction,
} from './bumpKeys';
import s from './BumpKeysPage.module.css';
import { KitchenHeader } from './KitchenShell';

interface SeenKey {
  key: string;
  code: string;
  keyCode: number;
  /** "held with Ctrl", "sent on release only" */
  how: string;
  count: number;
}

const shownKey = (k: { key: string; code: string }) => keyName(k.code === 'NumpadSubtract' ? k.code : k.key);

/**
 * Listens to every key the bar sends and records it, so the kitchen sees
 * exactly what each button sends. Keys that only arrive on release, or
 * held with Ctrl, are recorded too, to show what a button really sends.
 * Escape goes back to the line.
 */
function useKeyRecorder(onEscape: () => void): { seen: SeenKey[]; last: SeenKey | null } {
  const [seen, setSeen] = useState<SeenKey[]>([]);
  const [last, setLast] = useState<SeenKey | null>(null);
  const escape = useRef(onEscape);
  escape.current = onEscape;
  useEffect(() => {
    const down = new Set<string>();
    const put = (e: KeyboardEvent, how: string) => {
      const rec = { key: e.key, code: e.code, keyCode: e.keyCode, how, count: 1 };
      setLast(rec);
      setSeen((list) => {
        const same = list.find((x) => x.key === rec.key && x.code === rec.code);
        return same ? list.map((x) => (x === same ? { ...x, count: x.count + 1, how } : x)) : [rec, ...list];
      });
    };
    const held = (e: KeyboardEvent) =>
      [
        e.ctrlKey && e.key !== 'Control' && 'Ctrl',
        e.altKey && e.key !== 'Alt' && 'Alt',
        e.metaKey && e.key !== 'Meta' && 'Win',
        e.shiftKey && e.key !== 'Shift' && e.key.length > 1 && 'Shift',
      ].filter(Boolean);
    const onDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return escape.current();
      if (/^(select|option)$/i.test((e.target as HTMLElement | null)?.tagName ?? '')) return;
      e.preventDefault();
      e.stopPropagation();
      down.add(e.code || e.key);
      const h = held(e);
      put(e, h.length ? 'held with ' + h.join(' + ') : '');
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      if (down.delete(e.code || e.key)) return;
      put(e, 'sent on release only');
    };
    window.addEventListener('keydown', onDown, true);
    window.addEventListener('keyup', onUp, true);
    return () => {
      window.removeEventListener('keydown', onDown, true);
      window.removeEventListener('keyup', onUp, true);
    };
  }, []);
  return { seen, last };
}

/** Bump bar keys: what each key sends and what it does, assignable per device. */
export function BumpKeysPage({ onBack }: { onBack: () => void }) {
  const { seen, last } = useKeyRecorder(onBack);
  const assigned = useBumpAssignments();
  const map = resolveBumpKeys(assigned);
  const lastAction = last ? actionForKey(map, last) : undefined;

  return (
    <>
      <KitchenHeader
        lead={
          <button className={s.back} onClick={onBack}>
            <ChevronLeft size={18} strokeWidth={2.5} />
            Back to the line
          </button>
        }
        title="BUMP BAR KEYS"
        subtitle="Tickets do not move while this page is open"
      />
      <div className={s.page}>
        <section className={s.column} aria-label="Keys the bar sends">
          <div className={cx(s.box, s.last, last && s.lastOn)} aria-live="polite">
            <div className={s.lastLabel}>{last ? 'Last key' : 'Press a key on the bar'}</div>
            <div className={s.lastKey}>{last ? shownKey(last) : ''}</div>
            {last && (
              <>
                <div className={s.lastCodes}>
                  <span>
                    key <b>{JSON.stringify(last.key)}</b>
                  </span>
                  <span>
                    code <b>{last.code || 'none'}</b>
                  </span>
                  <span>
                    keyCode <b>{last.keyCode}</b>
                  </span>
                </div>
                {last.how && <div className={s.how}>{last.how}</div>}
                <div className={cx(s.does, lastAction ? s.doesOn : s.doesOff)}>
                  On the line this {lastAction ? 'does: ' + actionLabel(lastAction) : 'does nothing yet'}
                </div>
              </>
            )}
          </div>
          <h2 className={s.heading}>Keys this bar has sent · {seen.length}</h2>
          {seen.length ? (
            <div className={s.box}>
              {seen.map((k) => {
                const action = actionForKey(map, k);
                const fallback = actionForKey(DEFAULT_BUMP_KEYS, k);
                return (
                  <div key={k.key + k.code} className={s.row}>
                    <span className={s.chip}>{shownKey(k)}</span>
                    <span className={s.rowMeta}>
                      {k.code || 'no code'} · {k.keyCode} · {k.count}x{k.how ? ' · ' + k.how : ''}
                    </span>
                    <select
                      className={cx(s.select, !action && s.selectOff)}
                      aria-label={`What ${shownKey(k)} does`}
                      value={assigned[k.key] ?? ''}
                      onChange={(e) => {
                        assignBumpKey(k.key, e.target.value as BumpAction | 'none' | '');
                        e.target.blur();
                      }}
                    >
                      <option value="">{fallback ? 'Default: ' + actionLabel(fallback) : 'Not assigned'}</option>
                      {ASSIGNABLE_ACTIONS.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                      <option value="none">Does nothing</option>
                    </select>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={cx(s.box, s.empty)}>Nothing yet. Press each key on the bar once.</div>
          )}
        </section>

        <section className={s.column} aria-label="Actions">
          <h2 className={s.heading}>What each action is on right now</h2>
          <p className={s.help}>The bar&apos;s arrows send different keys from the ones printed on them, so they are listed by the arrow you press.</p>
          <div className={s.box}>
            {BUMP_ACTIONS.map((a) => {
              const keys = a.keys ? [] : [...new Set(map[a.id as BumpAction].map(barKeyName))];
              return (
                <div key={a.id} className={s.row}>
                  <span className={s.action}>{a.label}</span>
                  {a.keys ? (
                    <span className={s.builtIn}>{a.keys} · built in</span>
                  ) : keys.length ? (
                    <span className={s.keys}>
                      {keys.map((k) => (
                        <span key={k} className={s.chip}>
                          {k}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className={s.noKey}>No key</span>
                  )}
                </div>
              );
            })}
          </div>
          {Object.keys(assigned).length > 0 && (
            <button className={s.reset} onClick={resetBumpKeys}>
              Put the default keys back
            </button>
          )}
        </section>
      </div>
    </>
  );
}
