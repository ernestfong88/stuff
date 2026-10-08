import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { isoDate } from '../../../domain/pickup';
import type { AssocMeal, Order } from '../../../domain/types';
import { MINUTE, now } from '../../../lib/clock';
import { firstName, formatTime, plural } from '../../../lib/format';
import { uid } from '../../../lib/id';
import { useMe } from '../../../shell/session';
import { useAssocOrders, useDiningActions, useDiningHistory, useDiningOrders } from '../../../store/dining';
import { useShared } from '../../../lib/sharedStore';
import { getSetting, serviceConfig } from '../../../store/serviceConfig';
import { itemsLeft, modsText, type AssocMealKind, type AssocMenuItem } from '../../../domain/assocMeals/menu';
import { serverRungCount } from '../../../domain/assocMeals/serverRung';
import { assocSections } from '../../server/order/menu/assocMenu';
import { assocItemByName, assocMenuFor, assocMenuForDay, useAssocMenuSettings } from '../../../store/assocMenu';
import { Button, Chip, EmptyState, Tabs, cx, useNow, type Tone } from '../../../ui';
import { AssocOrderForm, type AssocFormValue } from './AssocOrderForm';
import {
  assocVenueName,
  CUTOFF_MIN,
  assocTextsOn,
  assocTracksPickup,
  assocWindows,
  isNoc,
  mealNow,
  mealOfWindow,
  orderLog,
  orderStatus,
  pickupBoard,
  STATUS_LABEL,
  windowAt,
  windowCloseAt,
  windowOpen,
  type AssocLogEntry,
  type AssocOrderStatus,
} from './assocProgram';
import s from './AssociatesView.module.css';

type FormState = { mode: 'add'; window: string } | { mode: 'edit'; id: string; window: string };

const MEAL_LABEL: Record<AssocMealKind, string> = { Lunch: 'Lunch', Dinner: 'Dinner', NOC: 'Overnight' };
const STATUS_TONE: Record<AssocOrderStatus, Tone> = { planned: 'neutral', kitchen: 'gold', ready: 'info', picked: 'success', cancelled: 'danger' };

/** A pick up range ends 15 minutes after it starts. */
const endOf = (date: string) => (w: string) => windowAt(date, w) + 15 * MINUTE;

/** __KMgrAssoc: one meal's associate pick ups in time order; the manager can add, change, cancel or hand over. */
export function AssociatesView() {
  const { setAssocOrders } = useDiningActions();
  const all = useAssocOrders();
  const orders = useDiningOrders();
  const closedChecks = useDiningHistory();
  const me = useMe();
  useShared(serviceConfig);
  const t = useNow(30_000);
  const date = isoDate(0);
  const windows = assocWindows(all, date);
  const [meal, setMeal] = useState<AssocMealKind>(() => mealNow(windows, now(), endOf(date)));
  const [form, setForm] = useState<FormState | null>(null);
  const [history, setHistory] = useState<string | null>(null);
  const [showEarlier, setShowEarlier] = useState(false);

  const day = all.filter((o) => o.date === date);
  const menuSettings = useAssocMenuSettings();
  const textsOn = assocTextsOn();
  const tracksPickup = assocTracksPickup();
  const board = pickupBoard(day, meal, t, endOf(date), tracksPickup);
  const meals = (['Lunch', 'Dinner', 'NOC'] as const).filter((m) => windows.some((x) => x.meal === m));

  const stamp = (o: AssocMeal, text: string, texted = !isNoc(o.window)): AssocMeal => ({
    ...o,
    log: [...(o.log ?? []), { by: me.name, at: now(), text, texted } satisfies AssocLogEntry],
  });
  const why = (reason: string) => ` · after cutoff: ${reason.trim()}`;

  const save = (v: AssocFormValue, over: boolean) => {
    if (!form) return;
    const item = assocItemByName(date, mealOfWindow(v.window), v.item, menuSettings);
    const note = modsText(item, v.mods);
    if (form.mode === 'add') {
      const order: AssocMeal = {
        id: uid('am'),
        date,
        meal: mealOfWindow(v.window),
        window: v.window,
        associate: v.associate.trim(),
        item: v.item,
        recipeIds: item?.recipeIds,
        status: 'Planned',
        note,
        mods: v.mods,
        log: [],
      };
      setAssocOrders((list) => [...list, stamp(order, `Placed by ${me.name}${over ? why(v.reason) : ''}`)]);
      setMeal(mealOfWindow(v.window));
    } else {
      const o = all.find((x) => x.id === form.id);
      if (!o) return;
      const changes: string[] = [];
      if (v.item !== o.item) changes.push(`${o.item} to ${v.item}`);
      if (v.window !== o.window) changes.push(`pickup ${o.window} to ${v.window}`);
      if (note !== (o.note || '')) changes.push(note ? `choices ${note}` : 'choices cleared');
      if (changes.length) {
        setAssocOrders((list) =>
          list.map((x) =>
            x.id === o.id
              ? stamp(
                  { ...x, item: v.item, recipeIds: item?.recipeIds, window: v.window, meal: mealOfWindow(v.window), note, mods: v.mods },
                  `Changed by ${me.name}: ${changes.join(', ')}${over ? why(v.reason) : ''}`,
                )
              : x,
          ),
        );
      }
    }
    setForm(null);
  };

  const cancelOrder = (id: string, window: string, reason: string) => {
    const over = !windowOpen(date, window, now());
    setAssocOrders((list) =>
      list.map((x) => (x.id === id ? stamp({ ...x, status: 'Cancelled' }, `Cancelled by ${me.name}${over ? why(reason) : ''}`) : x)),
    );
    setForm(null);
  };

  // The same hand over Expo records; nothing to text.
  const pickedUp = (id: string) => {
    const patch = { status: 'Picked up', pickedAt: now() };
    setAssocOrders((list) => list.map((x) => (x.id === id ? stamp({ ...x, ...patch }, `Marked picked up by ${me.name}`, false) : x)));
  };

  // Adding offers the ranges still to come, as before; the first still open in this meal is the default.
  const ahead = windows.filter((x) => t < windowAt(date, x.w));
  const addFrom = ahead.find((x) => x.meal === meal && windowOpen(date, x.w, t)) ?? ahead.find((x) => x.meal === meal) ?? ahead[0];

  const renderForm = (w: string, editing?: AssocMeal) => (
    <AssocOrderForm
      date={date}
      all={all}
      windows={editing ? windows : ahead}
      window={w}
      editing={editing}
      onSave={save}
      onCancelOrder={editing ? (reason) => cancelOrder(editing.id, w, reason) : undefined}
      onBack={() => setForm(null)}
    />
  );

  const row = (o: AssocMeal, faded = false) => {
    if (form?.mode === 'edit' && form.id === o.id) {
      return (
        <li key={o.id} className={s.editRow}>
          {renderForm(o.window, o)}
        </li>
      );
    }
    const st = orderStatus(o);
    const log = orderLog(o);
    const last = log[log.length - 1];
    const openLog = history === o.id;
    const action =
      st === 'ready' && tracksPickup ? (
        <Button variant="primary" size="sm" onClick={() => pickedUp(o.id)}>
          Mark picked up
        </Button>
      ) : st === 'cancelled' || st === 'picked' ? null : (
        <Button
          variant="soft"
          size="sm"
          onClick={() => {
            setHistory(null);
            setForm({ mode: 'edit', id: o.id, window: o.window });
          }}
        >
          Change
        </Button>
      );
    return (
      <li key={o.id} className={cx(s.row, faded && s.faded)}>
        <span className={cx(s.who, st === 'cancelled' && s.strike)}>{o.associate}</span>
        <span className={s.what}>
          <span className={cx(s.item, st === 'cancelled' && s.strike)}>{o.item}</span>
          {o.note && <span className={s.note}> · {o.note}</span>}
          {faded && <span className={s.when}> · {o.window}</span>}
          {last && (
            <button className={s.logLine} onClick={() => setHistory(openLog ? null : o.id)} aria-expanded={openLog}>
              {last.text} · {formatTime(last.at)}
              {last.texted && textsOn ? ` · texted ${firstName(o.associate)}` : ''}
            </button>
          )}
          {openLog && (
            <ol className={s.history}>
              {log
                .slice()
                .reverse()
                .map((e, i) => (
                  <li key={i}>
                    {formatTime(e.at)} · {e.text}
                  </li>
                ))}
            </ol>
          )}
        </span>
        <Chip tone={STATUS_TONE[st]} className={s.status}>
          {STATUS_LABEL[st]}
        </Chip>
        <span className={s.action}>{action}</span>
      </li>
    );
  };

  return (
    <div className={s.scroll}>
      <div className={s.top}>
        {meals.length > 1 && (
          <Tabs
            variant="segmented"
            aria-label="Meal"
            value={meal}
            onChange={(m) => {
              setMeal(m);
              setForm(null);
              setShowEarlier(false);
            }}
            options={meals.map((m) => ({ id: m, label: MEAL_LABEL[m] }))}
          />
        )}
        <Button
          variant="primary"
          className={s.add}
          icon={<Plus size={16} strokeWidth={2.5} />}
          disabled={!addFrom}
          onClick={() => {
            setHistory(null);
            if (addFrom) setForm({ mode: 'add', window: addFrom.w });
          }}
        >
          Order for an associate
        </Button>
      </div>

      <MenuStrip date={date} meal={meal} all={all} checks={[...orders, ...closedChecks]} />

      {form?.mode === 'add' && (
        <div className={s.addPanel}>
          <div className={s.addTitle}>Order for an associate</div>
          {renderForm(form.window)}
        </div>
      )}

      {board.now.map((g) => {
        const open = windowOpen(date, g.w, t);
        return (
          <section key={g.w} className={s.group} aria-label={`${g.w} pick up`}>
            <header className={s.groupHead}>
              <span className={s.time}>{g.w}</span>
              <span className={s.groupCount}>{plural(g.orders.length, 'order')}</span>
              <span className={cx(s.cutoff, open ? s.open : s.closed)}>
                {open ? `Changes until ${formatTime(windowCloseAt(date, g.w))}` : isNoc(g.w) ? 'Closed · dinner line sets out' : 'Cutoff passed'}
              </span>
            </header>
            <ul className={s.rows}>{g.orders.map((o) => row(o))}</ul>
          </section>
        );
      })}

      {board.now.length === 0 && (
        <EmptyState
          compact
          title={
            board.earlier.length
              ? `No ${MEAL_LABEL[meal].toLowerCase()} pick ups still to come.`
              : `No ${MEAL_LABEL[meal].toLowerCase()} orders today.`
          }
        >
          {board.earlier.length ? null : 'Orders planned in the Associate App show here by pick up time.'}
        </EmptyState>
      )}

      {board.earlier.length > 0 && (
        <section className={s.earlier}>
          <button className={s.earlierToggle} onClick={() => setShowEarlier((x) => !x)} aria-expanded={showEarlier}>
            {showEarlier ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            Earlier and cancelled · {board.earlier.length}
          </button>
          {showEarlier && <ul className={s.rows}>{board.earlier.map((o) => row(o, true))}</ul>}
        </section>
      )}
    </div>
  );
}

/** One line: the meal's special with what's left, the special of the week, the soup, the cutoff and where to pick up. */
function MenuStrip({ date, meal, all, checks }: { date: string; meal: AssocMealKind; all: AssocMeal[]; checks: Order[] }) {
  const settings = useAssocMenuSettings();
  const menu = assocMenuFor(date, meal, date, settings, true) ?? [];
  // The day's specials carry the ids the server tablet rings them in under.
  const special = assocMenuForDay(date, settings).find((m) => m.cap != null && (m.capMeals ?? []).includes(meal));
  const week = menu.find((m) => m.weekly);
  const soup = menu.find((m) => m.soupOfDay);
  const cut = Number(getSetting('am.cut') ?? CUTOFF_MIN);
  const left = (m: AssocMenuItem) => {
    // App meals plus the ones servers rang in on a tablet.
    const period = m.capMeals?.includes('Lunch') ? 'Lunch' : 'Dinner';
    const ids = assocSections([m], period).flatMap((x) => x.items.map((i) => i.id));
    const taken = (m.cap ?? 0) - (itemsLeft(all, date, m) ?? 0) + serverRungCount(checks, date, ids, m.capMeals);
    return Math.max(0, (m.cap ?? 0) - taken);
  };
  const n = special ? left(special) : null;
  return (
    <div className={s.strip}>
      {special && (
        <span className={s.fact}>
          <span className={s.factKey}>Special</span>
          {special.name}
          <b className={cx(s.left, n === 0 ? s.red : s.green)}>{n === 0 ? 'sold out' : `${n} left`}</b>
        </span>
      )}
      {week && (
        <span className={s.fact}>
          <span className={s.factKey}>This week</span>
          {week.name}
        </span>
      )}
      {soup && (
        <span className={s.fact}>
          <span className={s.factKey}>Soup</span>
          {soup.name}
        </span>
      )}
      <span className={s.fact}>
        <span className={s.factKey}>Cutoff</span>
        {Number.isFinite(cut) ? cut : CUTOFF_MIN} min before pick up
      </span>
      <span className={cx(s.fact, s.where)}>Pick up at {assocVenueName()}</span>
    </div>
  );
}
