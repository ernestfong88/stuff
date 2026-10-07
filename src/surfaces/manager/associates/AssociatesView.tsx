import { useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { isoDate } from '../../../domain/pickup';
import type { AssocMeal } from '../../../domain/types';
import { now } from '../../../lib/clock';
import { firstName, formatTime, plural } from '../../../lib/format';
import { uid } from '../../../lib/id';
import { useMe } from '../../../shell/session';
import { useDining } from '../../../store/dining';
import { useShared } from '../../../lib/sharedStore';
import { serviceConfig } from '../../../store/serviceConfig';
import { itemsLeft, modsText } from '../../../domain/assocMeals/menu';
import { assocItemByName, assocMenuForDay, useAssocMenuSettings } from '../../../store/assocMenu';
import { Button, EmptyState, cx, useNow } from '../../../ui';
import { AssocOrderForm, type AssocFormValue } from './AssocOrderForm';
import {
  assocVenueName,
  CUTOFF_MIN,
  assocTextsOn,
  assocWindows,
  compareOrders,
  isLive,
  isNoc,
  mealOfWindow,
  orderLog,
  rangeLabel,
  readyAtOf,
  windowAt,
  windowCloseAt,
  windowOpen,
  type AssocLogEntry,
  type AssocWindow,
} from './assocProgram';
import s from './AssociatesView.module.css';

type FormState = { mode: 'add'; window: string } | { mode: 'edit'; id: string; window: string };

/** __KMgrAssoc: today's associate meals by pickup window; the manager can add, change or cancel. */
export function AssociatesView() {
  const { assocOrders: all, setAssocOrders } = useDining();
  const me = useMe();
  useShared(serviceConfig);
  const t = useNow(30_000);
  const [form, setForm] = useState<FormState | null>(null);
  const [addWindow, setAddWindow] = useState('');
  const [history, setHistory] = useState<string | null>(null);

  const date = isoDate(0);
  const day = all.filter((o) => o.date === date);
  const live = day.filter(isLive);
  const windows = assocWindows(all, date);
  const menuSettings = useAssocMenuSettings();
  const menu = assocMenuForDay(date, menuSettings);
  const textsOn = assocTextsOn();

  const stamp = (o: AssocMeal, text: string): AssocMeal => ({
    ...o,
    log: [...(o.log ?? []), { by: me.name, at: now(), text, texted: !isNoc(o.window) } satisfies AssocLogEntry],
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
              ? stamp({ ...x, item: v.item, recipeIds: item?.recipeIds, window: v.window, meal: mealOfWindow(v.window), note, mods: v.mods }, `Changed by ${me.name}: ${changes.join(', ')}${over ? why(v.reason) : ''}`)
              : x,
          ),
        );
      }
    }
    setForm(null);
  };

  const cancelOrder = (id: string, window: string, reason: string) => {
    const over = !windowOpen(date, window, now());
    setAssocOrders((list) => list.map((x) => (x.id === id ? stamp({ ...x, status: 'Cancelled' }, `Cancelled by ${me.name}${over ? why(reason) : ''}`) : x)));
    setForm(null);
  };

  const shown = windows.filter((x) => day.some((o) => o.window === x.w) || form?.window === x.w);
  const specials = menu.filter((m) => m.cap != null);

  return (
    <div className={s.scroll}>
      <div className={s.head}>
        <h2 className={s.title}>Associate meals today</h2>
        <span className={s.meta}>
          {plural(live.length, 'meal')} · {live.filter((o) => o.status === 'Picked up').length} picked up · pickup at {assocVenueName()}
        </span>
        <span className={s.caps}>
          {specials.map((m) => {
            const c = (m.cap ?? 0) - (itemsLeft(all, date, m) ?? 0);
            return (
              <span key={m.id}>
                {m.id === 'am_special_lunch' ? 'Lunch' : 'Dinner'}: {m.name} <b className={cx(c >= (m.cap ?? 0) ? s.red : s.green)}>{`${c}/${m.cap}`}</b>
              </span>
            );
          })}
        </span>
      </div>
      <p className={s.intro}>
        Same menu, special limits and {CUTOFF_MIN} minute cutoff as the Associate App. Every change is logged with your name
        {textsOn ? ' and texted to the associate.' : '. Texts to associates are off in the Back Office.'}
      </p>

      <div className={s.addRow}>
        <label className={s.addLabel} htmlFor="assoc-add-window">
          Add an order for
        </label>
        <select id="assoc-add-window" className={s.select} value={addWindow} onChange={(e) => setAddWindow(e.target.value)}>
          <option value="">Choose a pickup time</option>
          {windows
            .filter((x) => t < windowAt(date, x.w))
            .map((x) => (
              <option key={x.w} value={x.w}>
                {x.meal === 'NOC' ? 'Overnight' : x.meal} · {rangeLabel(x.w)}
              </option>
            ))}
        </select>
        <Button
          variant="primary"
          icon={<Plus size={16} strokeWidth={2.5} />}
          disabled={!addWindow}
          onClick={() => {
            setHistory(null);
            setForm({ mode: 'add', window: addWindow });
          }}
        >
          Add
        </Button>
      </div>

      {shown.length ? (
        <div className={s.grid}>
          {shown.map((x) => (
            <WindowCard
              key={x.w}
              win={x}
              date={date}
              at={t}
              orders={day.filter((o) => o.window === x.w)}
              sort={compareOrders(menu)}
              textsOn={textsOn}
              history={history}
              setHistory={setHistory}
              form={form}
              renderForm={(editing) => (
                <AssocOrderForm
                  date={date}
                  all={all}
                  windows={windows}
                  window={x.w}
                  editing={editing}
                  onSave={save}
                  onCancelOrder={editing ? (reason) => cancelOrder(editing.id, x.w, reason) : undefined}
                  onBack={() => setForm(null)}
                />
              )}
              onEdit={(o) => {
                setHistory(null);
                setForm({ mode: 'edit', id: o.id, window: x.w });
              }}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="No associate meals ordered today.">Orders planned in the Associate App show here by pickup time.</EmptyState>
      )}
    </div>
  );
}

interface WindowCardProps {
  win: AssocWindow;
  date: string;
  at: number;
  orders: AssocMeal[];
  sort: (a: AssocMeal, b: AssocMeal) => number;
  textsOn: boolean;
  history: string | null;
  setHistory: (id: string | null) => void;
  form: FormState | null;
  renderForm: (editing?: AssocMeal) => ReactNode;
  onEdit: (o: AssocMeal) => void;
}

function WindowCard({ win, date, at, orders, sort, textsOn, history, setHistory, form, renderForm, onEdit }: WindowCardProps) {
  const open = windowOpen(date, win.w, at);
  const gone = at > windowAt(date, win.w);
  const noc = win.meal === 'NOC';
  const live = orders.filter(isLive).sort(sort);
  const dead = orders.filter((o) => !isLive(o));
  const tone = open
    ? { cls: s.open, text: `Open until ${formatTime(windowCloseAt(date, win.w))}` }
    : gone
      ? { cls: s.done, text: 'Pickup time passed' }
      : { cls: s.closed, text: noc ? 'Closed · dinner line makes and sets out' : 'Cutoff passed · cooking to count' };
  const counts = new Map<string, number>();
  for (const o of live) counts.set(o.item, (counts.get(o.item) ?? 0) + 1);

  return (
    <section className={s.card} aria-label={`${noc ? 'NOC ' : ''}${rangeLabel(win.w)}`}>
      <div className={s.cardHead}>
        {noc ? (
          <span className={s.range}>
            <span className={s.noc}>NOC</span>
            {rangeLabel(win.w)}
          </span>
        ) : (
          <span className={s.range}>{rangeLabel(win.w)}</span>
        )}
        <span className={s.kind}>
          {noc ? 'Overnight, no text' : `${win.meal} pickup`} · {plural(live.length, 'order')}
        </span>
        <span className={cx(s.state, tone.cls)}>{tone.text}</span>
      </div>
      {live.length > 0 ? (
        <div className={s.counts}>
          {[...counts].map(([item, n]) => (
            <span key={item} className={s.count}>
              {n} × {item}
            </span>
          ))}
        </div>
      ) : (
        <div className={s.none}>No orders yet.</div>
      )}

      {live.map((o) => {
        if (form?.mode === 'edit' && form.id === o.id) {
          return (
            <div key={o.id} className={s.row}>
              {renderForm(o)}
            </div>
          );
        }
        const log = orderLog(o);
        const last = log[log.length - 1];
        const openLog = history === o.id;
        const status = o.status === 'Picked up' ? { cls: s.picked, text: 'Picked up' } : readyAtOf(o) ? { cls: s.ready, text: 'Ready' } : null;
        return (
          <div key={o.id} className={s.row}>
            <div className={s.rowMain}>
              <div className={s.rowText}>
                <div className={s.who}>
                  {o.associate}
                  <span className={s.item}> · {o.item}</span>
                </div>
                {o.note && <div className={s.note}>“{o.note}”</div>}
                {log.length > 1 ? (
                  <button className={s.logLine} onClick={() => setHistory(openLog ? null : o.id)} aria-expanded={openLog}>
                    {last.text} · {formatTime(last.at)}
                    {last.texted && textsOn ? ` · texted ${firstName(o.associate)}` : ''}
                    {openLog ? ' · hide history' : ` · ${log.length} entries`}
                  </button>
                ) : (
                  <div className={s.logText}>
                    {last ? `${last.text} · ${formatTime(last.at)}${last.texted && textsOn ? ` · texted ${firstName(o.associate)}` : ''}` : 'Planned in the Associate App'}
                  </div>
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
              </div>
              {status && <span className={cx(s.status, status.cls)}>{status.text}</span>}
              {o.status !== 'Picked up' && (
                <Button variant="soft" onClick={() => onEdit(o)}>
                  Change
                </Button>
              )}
            </div>
          </div>
        );
      })}

      {dead.map((o) => {
        const log = orderLog(o);
        const last = log[log.length - 1];
        return (
          <div key={o.id} className={s.dead}>
            <del className={s.strike}>
              {o.associate} · {o.item}
            </del>
            <span className={s.deadWhy}> · {last ? last.text : o.status}</span>
          </div>
        );
      })}

      {form?.mode === 'add' && form.window === win.w && renderForm()}
    </section>
  );
}
