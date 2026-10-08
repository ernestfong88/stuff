import { useEffect, useState } from 'react';
import { Delete, Plus, Thermometer } from 'lucide-react';
import { checkPin } from '../../shell/session';
import {
  ACTION_LABEL,
  COOK_LABEL,
  COLD_HOLD_F,
  HOT_HOLD_F,
  SERVICE,
  TEMP_MEALS,
  actionsFor,
  clockLabel,
  formatTemp,
  inRange,
  plausibleTemp,
  type HoldType,
  type TempAction,
  type TempCell,
  type TempMeal,
} from '../../domain/tempLog';
import { isoOf } from '../../domain/cleaning';
import { formatTime } from '../../lib/format';
import { addTempDish, mealLog, recordTemp, useTempLog, type DishLog } from '../../store/tempLog';
import { Button, Modal, Tabs, TextField, cx, toast } from '../../ui';
import { HeaderButton } from '../kitchen/KitchenShell';
import k from '../kitchen/KitchenShell.module.css';
import { PinPad } from '../server/shared/ManagerPin';
import { dayLabel } from './logic';
import s from './TempLog.module.css';

const STATUS_LABEL = { due: 'Due now', overdue: 'Overdue', missed: 'Missed' } as const;

/**
 * Food temperatures on the prep tablet for a meal today: each dish on the
 * menu, hot or cold, with its checks (as it goes on the line, then during
 * service). A cook taps a check, enters the temperature on the number pad
 * and signs it with their PIN; a reading out of range asks what was done
 * about it, and a recheck temperature.
 */
export function TempLog({ venueId, meal, onMeal, nowMs }: { venueId: string; meal: TempMeal; onMeal: (m: TempMeal) => void; nowMs: number }) {
  const state = useTempLog();
  const iso = isoOf(new Date(nowMs));
  const log = mealLog(state, venueId, iso, meal, nowMs);
  const [entry, setEntry] = useState<{ dl: DishLog; cell: TempCell } | null>(null);
  const [adding, setAdding] = useState(false);
  const { start, end } = SERVICE[meal];
  const groups = (['hot', 'cold'] as const).map((hold) => ({ hold, rows: log.dishes.filter((d) => d.dish.hold === hold) }));

  return (
    <>
      <div className={s.head}>
        <h2 className={s.capToday}>
          Today · {dayLabel(new Date(nowMs), 0)} · {meal} {clockLabel(start)} to {clockLabel(end)}
        </h2>
        <Tabs
          variant="segmented"
          dark
          aria-label="Meal"
          value={meal}
          onChange={onMeal}
          options={TEMP_MEALS.map((m) => {
            const late = mealLog(state, venueId, iso, m, nowMs)
              .dishes.flatMap((d) => d.cells)
              .filter((c) => c.status === 'overdue').length;
            return { id: m, label: m, count: late || undefined, countTone: 'danger' as const };
          })}
          className={s.meals}
        />
        <HeaderButton icon={<Plus size={16} />} onClick={() => setAdding(true)} className={s.addBtn}>
          Add a dish
        </HeaderButton>
      </div>

      {log.dishes.length ? (
        groups
          .filter((g) => g.rows.length)
          .map((g) => (
            <section key={g.hold} aria-label={g.hold === 'hot' ? 'Hot hold' : 'Cold hold'} className={s.group}>
              <header className={s.groupHead}>
                <h3 className={cx(s.name, g.hold === 'hot' ? s.hot : s.cold)}>
                  <Thermometer size={16} aria-hidden /> {g.hold === 'hot' ? 'Hot hold' : 'Cold hold'}
                </h3>
                <span className={s.rule}>
                  {g.hold === 'hot' ? `Cooked temp on the line, then ≥ ${HOT_HOLD_F}°F` : `≤ ${COLD_HOLD_F}°F the whole service`}
                </span>
              </header>
              <div className={s.items}>
                {g.rows.map((dl) => (
                  <div key={dl.dish.key} className={s.dish}>
                    <span className={s.text}>
                      <span className={s.label}>{dl.dish.name}</span>
                      <span className={s.meta}>
                        {dl.dish.added ? 'Added today' : dl.dish.category}
                        {dl.dish.hold === 'hot' && ` · ${COOK_LABEL[dl.dish.cook]}`}
                      </span>
                    </span>
                    <span className={s.cells}>
                      {dl.cells.map((c) => (
                        <CheckButton key={c.check.id} cell={c} onTap={() => setEntry({ dl, cell: c })} />
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))
      ) : (
        <p className={s.empty}>Nothing hot or cold on the menu for {meal.toLowerCase()} here. Add a dish to log it.</p>
      )}

      {entry && <TempEntry venueId={venueId} iso={iso} meal={meal} {...entry} onClose={() => setEntry(null)} />}
      {adding && (
        <AddDish
          onClose={() => setAdding(false)}
          onAdd={(name, hold) => {
            addTempDish(venueId, iso, meal, name, hold);
            setAdding(false);
            toast(`${name} added to ${meal.toLowerCase()}`, { tone: 'success' });
          }}
        />
      )}
    </>
  );
}

function CheckButton({ cell, onTap }: { cell: TempCell; onTap: () => void }) {
  const { check, target, reading, status } = cell;
  if (reading) {
    const out = status === 'out';
    return (
      <span className={cx(s.cell, out ? s.cellOut : s.cellOk)} aria-label={`${check.label}: ${formatTemp(reading.tempF)} by ${reading.by}`}>
        <span className={s.cellHead}>
          {check.label} <span className={s.target}>{target.label}</span>
        </span>
        <span className={s.temp}>{formatTemp(reading.tempF)}</span>
        <span className={s.stamp}>
          {reading.by} · {formatTime(reading.at)}
        </span>
        {out && reading.action && (
          <span className={s.fix}>
            {ACTION_LABEL[reading.action]}
            {reading.recheckF != null && ` · then ${formatTemp(reading.recheckF)}`}
          </span>
        )}
      </span>
    );
  }
  const can = status === 'due' || status === 'overdue' || status === 'upcoming';
  const pill = status === 'upcoming' ? `At ${clockLabel(check.due)}` : STATUS_LABEL[status as keyof typeof STATUS_LABEL];
  const body = (
    <>
      <span className={s.cellHead}>
        {check.label} <span className={s.target}>{target.label}</span>
      </span>
      <span className={cx(s.pill, status === 'overdue' && s.pillLate, status === 'due' && s.pillDue, status === 'missed' && s.pillMissed)}>
        {pill}
      </span>
    </>
  );
  if (!can) return <span className={cx(s.cell, s.cellMissed)}>{body}</span>;
  return (
    <button
      className={cx(s.cell, s.tap, status === 'overdue' && s.cellLate, status === 'due' && s.cellDue)}
      onClick={onTap}
      aria-label={`Take ${check.label.toLowerCase()} temperature`}
    >
      {body}
    </button>
  );
}

// ─── Entering a reading ──────────────────────────────────────────────────

/** Number pad for °F: digits, a decimal point, delete. Digits can be typed too. */
function NumPad({ value, onChange, onEnter }: { value: string; onChange: (v: string) => void; onEnter?: () => void }) {
  const press = (k: string) => {
    if (k === 'del') return onChange(value.slice(0, -1));
    if (k === '.' && value.includes('.')) return;
    if (value.replace('.', '').length >= 4) return;
    onChange(value + k);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (/^[\d.]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Enter') onEnter?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className={s.keys}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map((k) => (
        <button key={k} className={s.key} onClick={() => press(k)} aria-label={k === 'del' ? 'Delete' : k === '.' ? 'Decimal point' : k}>
          {k === 'del' ? <Delete size={20} aria-hidden /> : k}
        </button>
      ))}
    </div>
  );
}

type Step = 'temp' | 'fix' | 'pin';

function TempEntry({
  venueId,
  iso,
  meal,
  dl,
  cell,
  onClose,
}: {
  venueId: string;
  iso: string;
  meal: TempMeal;
  dl: DishLog;
  cell: TempCell;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>('temp');
  const [value, setValue] = useState('');
  const [action, setAction] = useState<TempAction | null>(null);
  const [recheck, setRecheck] = useState('');
  const tempF = parseFloat(value);
  const ok = plausibleTemp(tempF);
  const inside = ok && inRange(cell.target, tempF);
  const recheckF = recheck ? parseFloat(recheck) : undefined;
  const recheckOk = recheckF == null || plausibleTemp(recheckF);
  const { dish } = dl;
  const title = `${dish.name} · ${cell.check.label}`;
  const which = dish.hold === 'hot' ? (cell.check.kind === 'line' ? 'cook temperature' : 'hot holding') : 'cold holding';

  const next = () => {
    if (!ok) return;
    setStep(inside ? 'pin' : 'fix');
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={400}
      className={k.dialog}
      title={title}
      subtitle={step === 'pin' ? 'Enter your PIN to sign it' : `Target ${cell.target.label} (${which})`}
    >
      {step === 'temp' && (
        <>
          <div className={cx(s.readout, value && ok && !inside && s.readoutOut, value && inside && s.readoutOk)} aria-live="polite">
            {value || '–'}
            <small>°F</small>
          </div>
          <div className={s.hint} role="alert">
            {value && !ok ? 'That isn’t a temperature a probe reads.' : value && ok && !inside ? `Out of range: should be ${cell.target.label}` : ' '}
          </div>
          <NumPad value={value} onChange={setValue} onEnter={next} />
          <Button variant="primary" block size="lg" disabled={!ok} onClick={next} className={s.next}>
            Next
          </Button>
        </>
      )}
      {step === 'fix' && (
        <>
          <p className={s.outNote}>
            <strong>{formatTemp(tempF)}</strong> is out of range for {dish.name} ({cell.target.label}). What did you do?
          </p>
          <div className={s.actions} role="group" aria-label="Corrective action">
            {actionsFor(dish.hold).map((a) => (
              <button key={a} className={cx(s.action, action === a && s.actionOn)} aria-pressed={action === a} onClick={() => setAction(a)}>
                {ACTION_LABEL[a]}
              </button>
            ))}
          </div>
          {action && action !== 'discard' && (
            <>
              <div className={s.recheckHead}>
                Recheck temperature <span className={s.optional}>optional</span>
              </div>
              <div
                className={cx(
                  s.readout,
                  s.readoutSmall,
                  recheckF != null && recheckOk && (inRange(cell.target, recheckF) ? s.readoutOk : s.readoutOut),
                )}
              >
                {recheck || '–'}
                <small>°F</small>
              </div>
              <NumPad value={recheck} onChange={setRecheck} />
            </>
          )}
          <Button variant="primary" block size="lg" disabled={!action || !recheckOk} onClick={() => setStep('pin')} className={s.next}>
            Next
          </Button>
        </>
      )}
      {step === 'pin' && (
        <>
          <p className={cx(s.summary, inside ? s.summaryOk : s.summaryOut)}>
            {formatTemp(tempF)}
            {action && ` · ${ACTION_LABEL[action]}`}
            {recheckF != null && ` · recheck ${formatTemp(recheckF)}`}
          </p>
          <PinPad
            accept={(pin) => !!checkPin(pin)}
            onOk={(pin) => {
              const who = checkPin(pin);
              if (!who) return;
              recordTemp(
                venueId,
                iso,
                meal,
                dish.key,
                cell.check.id,
                { tempF, action: inside ? undefined : (action ?? undefined), recheckF: inside ? undefined : recheckF },
                who.id,
                who.name,
              );
              onClose();
              toast(`${dish.name}: ${formatTemp(tempF)} logged by ${who.name}`, { tone: inside ? 'success' : 'danger' });
            }}
          />
        </>
      )}
      <Button
        variant="ghost"
        block
        onClick={step === 'temp' ? onClose : () => setStep(step === 'pin' && !inside ? 'fix' : 'temp')}
        className={s.cancel}
      >
        {step === 'temp' ? 'Cancel' : 'Back'}
      </Button>
    </Modal>
  );
}

function AddDish({ onAdd, onClose }: { onAdd: (name: string, hold: Exclude<HoldType, 'none'>) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [hold, setHold] = useState<Exclude<HoldType, 'none'>>('hot');
  return (
    <Modal
      open
      onClose={onClose}
      width={400}
      className={k.dialog}
      title="Add a dish"
      subtitle="A dish on the line that isn’t on the menu, for this meal"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onAdd(name.trim(), hold);
        }}
      >
        <TextField autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Beef stew" aria-label="Dish" />
        <div className={s.actions} role="group" aria-label="Held">
          {(['hot', 'cold'] as const).map((h) => (
            <button type="button" key={h} className={cx(s.action, hold === h && s.actionOn)} aria-pressed={hold === h} onClick={() => setHold(h)}>
              {h === 'hot' ? `Hot · ≥ ${HOT_HOLD_F}°F` : `Cold · ≤ ${COLD_HOLD_F}°F`}
            </button>
          ))}
        </div>
        <Button type="submit" variant="primary" block size="lg" disabled={!name.trim()} className={s.next}>
          Add
        </Button>
      </form>
      <Button variant="ghost" block onClick={onClose} className={s.cancel}>
        Cancel
      </Button>
    </Modal>
  );
}
