import { isoDate } from '../../../domain/pickup';
import { now } from '../../../lib/clock';
import { formatTime } from '../../../lib/format';
import { useDining } from '../../../store/dining';
import { nocGroups, setOutMeal, type NocMeal } from '../queue/noc';
import { useServiceSettings, windowSettings } from '../service/settings';
import { minuteLabel, nocMadeBy, rangeOf } from '../service/windows';
import s from './NocMeals.module.css';

/** "NOC 11:00 to 11:15 PM" */
export function NocTag({ window }: { window: string }) {
  return (
    <span className={s.tag} title={`NOC · ${rangeOf(window)}`}>
      <span className={s.noc}>NOC</span>
      {rangeOf(window)}
    </span>
  );
}

/** Tonight's NOC associate meals: the dinner line makes them, PU sets each one out. */
export function NocMeals() {
  const { assocOrders, setAssocOrders } = useDining();
  const cfg = useServiceSettings();
  const groups = nocGroups(assocOrders as NocMeal[], isoDate(0));
  if (!groups.length) return null;
  const madeBy = minuteLabel(nocMadeBy(windowSettings(cfg)));
  const setOut = (id: string, on: boolean) =>
    setAssocOrders((all) => all.map((a) => (a.id === id ? setOutMeal(a, on, now()) : a)));
  return (
    <section className={s.wrap} aria-labelledby="pud-noc-title">
      <header className={s.head}>
        <h2 id="pud-noc-title" className={s.title}>
          NOC associate meals tonight
        </h2>
        <span className={s.sub}>The dinner line makes them before the {madeBy} close. Set each one out; no texts go out.</span>
      </header>
      {groups.map((g) => (
        <div key={g.window} className={s.card}>
          <div className={s.cardHead}>
            <NocTag window={g.window} />
            <span className={s.count}>
              {g.meals.length} {g.meals.length === 1 ? 'meal' : 'meals'}
            </span>
          </div>
          {g.meals.map((m) => (
            <div key={m.id} className={s.meal}>
              <div className={s.mealText}>
                <div className={s.who}>{m.associate}</div>
                <div className={s.item}>{m.item + (m.note ? ` (${m.note})` : '')}</div>
              </div>
              {m.readyAt ? (
                <span className={s.done}>
                  Set out {formatTime(m.readyAt)}
                  <button className={s.undo} onClick={() => setOut(m.id, false)}>
                    Undo
                  </button>
                </span>
              ) : (
                <button className={s.setOut} onClick={() => setOut(m.id, true)}>
                  Set out
                </button>
              )}
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
