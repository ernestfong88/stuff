import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { getItem } from '../../../data';
import { serverItemName } from '../../../domain/menu';
import { availableCount } from '../../../domain/orders';
import type { MealName, MenuItem } from '../../../domain/types';
import { now } from '../../../lib/clock';
import { mealAt } from '../../../domain/mealPeriods';
import { useConfig } from '../../../store/config';
import { useDiningHistory, useDiningOrders } from '../../../store/dining';
import { is86, itemsMarked, limitLeft, ordersToday, restore86, set86, setLeft, use86 } from '../../../store/eightySix';
import { Button, Chip, EmptyState, Eyebrow, PageTitle, SearchField, Stepper, Tabs, cx, toast } from '../../../ui';
import { MEALS } from '../../../domain/metrics/stepsOfService';
import { markedIn, menuForToday, searchToday, specialsOf } from './menuToday';
import s from './EightySixView.module.css';

type Status = 'on' | 'count' | 'out';
/** A count starts here when the menu has no limit of its own. */
const FIRST_COUNT = 5;

/**
 * __KMgr86: what the kitchen is out of or low on, first; below it, search or
 * open a category to 86 something. Marks come back on their own at midnight.
 */
export function EightySixView() {
  const marks = use86();
  const cfg = useConfig();
  const orders = useDiningOrders();
  const history = useDiningHistory();
  const todays = ordersToday(orders, history);
  const [meal, setMeal] = useState<MealName>(() => mealAt(now()));
  const [q, setQ] = useState('');
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const short = (it: MenuItem) => serverItemName(it.name, cfg);
  const left = (id: string) => limitLeft(marks, id, todays);
  const status = (id: string): Status => (is86(marks, id) ? 'out' : left(id) != null ? 'count' : 'on');

  const marked = itemsMarked(marks)
    .map((id) => getItem(id))
    .filter((it): it is NonNullable<typeof it> => !!it);
  const cats = menuForToday(meal, '');
  const specials = specialsOf(cats);
  const hits = searchToday(meal, q, short);

  /** Every tablet sees the change at once, so each change says what it did and can be undone. */
  const choose = (it: MenuItem, next: Status) => {
    const before = marks[it.id];
    const name = short(it);
    const first = availableCount(it.id, orders) ?? FIRST_COUNT;
    if (next === 'count') setLeft(it.id, first, todays);
    else set86(it.id, next === 'out');
    const msg = next === 'out' ? `${name} is 86 on every tablet` : next === 'on' ? `${name} is back on` : `${name}: ${first} left`;
    toast(msg, { tone: next === 'on' ? 'success' : undefined, action: { label: 'Undo', onClick: () => restore86(it.id, before) } });
  };
  /** A stepper tap changes the count quietly; the number on screen is the feedback. */
  const recount = (it: MenuItem, n: number) => setLeft(it.id, n, todays);

  const tag = (id: string) => {
    const st = status(id);
    if (st === 'out') return <Chip tone="danger">Out</Chip>;
    if (st === 'count') return <Chip tone={left(id) ? 'warning' : 'danger'}>{left(id) ? `${left(id)} left` : 'Sold out'}</Chip>;
    return null;
  };

  /** A menu item to pick: tap it for one On / Count / Out control. */
  const row = (it: MenuItem) => {
    const open = picked === it.id;
    const st = status(it.id);
    return (
      <div key={it.id} className={cx(s.item, open && s.itemOpen, st === 'out' && s.itemOut)}>
        <button className={s.itemHead} onClick={() => setPicked(open ? null : it.id)} aria-expanded={open}>
          <span className={s.itemName}>{short(it)}</span>
          {tag(it.id)}
        </button>
        {open && (
          <div className={s.itemControl}>
            <Tabs<Status>
              variant="segmented"
              size="sm"
              aria-label={`${short(it)} on the menu`}
              value={st}
              onChange={(v) => v !== st && choose(it, v)}
              options={[
                { id: 'on', label: 'On' },
                { id: 'count', label: 'Count' },
                { id: 'out', label: 'Out' },
              ]}
            />
            {st === 'count' && <Stepper size="sm" value={left(it.id) ?? 0} max={199} onChange={(n) => recount(it, n)} />}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={s.scroll}>
      <PageTitle sub="Everything comes back on at midnight.">86 list</PageTitle>

      <section className={s.now} aria-live="polite" aria-label="Out or low now">
        {marked.length ? (
          <>
            <Eyebrow className={s.nowTitle}>Out or low · {marked.length}</Eyebrow>
            {marked.map((it) => (
              <div key={it.id} className={s.nowRow}>
                <span className={s.nowName}>{short(it)}</span>
                {tag(it.id)}
                <span className={s.grow} />
                {status(it.id) === 'count' && <Stepper size="sm" value={left(it.id) ?? 0} max={199} onChange={(n) => recount(it, n)} />}
                <Button size="sm" variant="soft" onClick={() => choose(it, 'on')} aria-label={`Put ${short(it)} back on`}>
                  Back on
                </Button>
              </div>
            ))}
          </>
        ) : (
          <div className={s.nothing}>Nothing is 86&rsquo;d</div>
        )}
      </section>

      <div className={s.addBar}>
        <SearchField value={q} onChange={setQ} placeholder="86 an item…" className={s.search} large />
        <Tabs<MealName>
          variant="segmented"
          size="md"
          value={meal}
          onChange={setMeal}
          aria-label="Meal"
          options={MEALS.map((m) => ({ id: m, label: m }))}
        />
      </div>

      {q.trim() ? (
        hits.length ? (
          <div className={s.list}>{hits.map(row)}</div>
        ) : (
          <EmptyState compact title={`Nothing on the ${meal.toLowerCase()} menu matches.`} />
        )
      ) : (
        <>
          {specials.length > 0 && (
            <section className={s.block}>
              <Eyebrow className={s.blockTitle}>Today&rsquo;s specials</Eyebrow>
              <div className={s.list}>{specials.map(row)}</div>
            </section>
          )}
          <div className={s.cats}>
            {cats.map(([cat, items]) => {
              const open = openCat === cat;
              const n = markedIn(items, (id) => status(id) !== 'on');
              return (
                <section key={cat} className={s.cat}>
                  <button className={s.catHead} onClick={() => setOpenCat(open ? null : cat)} aria-expanded={open}>
                    <span className={s.catName}>{cat}</span>
                    <span className={s.catCount}>{items.length}</span>
                    {n > 0 && <Chip tone="danger">{n} out or low</Chip>}
                    <span className={s.grow} />
                    <ChevronDown size={18} className={cx(s.chev, open && s.chevOpen)} aria-hidden />
                  </button>
                  {open && <div className={cx(s.list, s.catList)}>{items.map(row)}</div>}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
