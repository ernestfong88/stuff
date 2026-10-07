import { useId, useState } from 'react';
import type { AssocMeal } from '../../../domain/types';
import { now } from '../../../lib/clock';
import { Button, TextField } from '../../../ui';
import {
  CUTOFF_MIN,
  PROGRAM_NAMES,
  assocMenu,
  STANDING_MENU,
  choicesComplete,
  countOf,
  isLive,
  mealOfWindow,
  menuItem,
  orderChoices,
  rangeLabel,
  windowOpen,
  type AssocWindow,
} from './assocProgram';
import s from './AssocOrderForm.module.css';

export interface AssocFormValue {
  associate: string;
  item: string;
  window: string;
  mods: Record<string, string>;
  /** Why a change past the cutoff is allowed. */
  reason: string;
}

interface Props {
  date: string;
  all: AssocMeal[];
  windows: AssocWindow[];
  /** The window the form was opened from. */
  window: string;
  /** The order being changed; absent when adding one. */
  editing?: AssocMeal;
  onSave: (v: AssocFormValue, overCutoff: boolean) => void;
  onCancelOrder?: (reason: string) => void;
  onBack: () => void;
}

/** Add or change an associate's meal, with the app's limits and a reason after the cutoff. */
export function AssocOrderForm({ date, all, windows, window: from, editing, onSave, onCancelOrder, onBack }: Props) {
  const listId = useId();
  const [v, setV] = useState<AssocFormValue>(() => ({
    associate: editing?.associate ?? '',
    item: editing?.item ?? '',
    window: editing?.window ?? from,
    mods: orderChoices(editing),
    reason: '',
  }));
  const at = now();
  const set = <K extends keyof AssocFormValue>(k: K, val: AssocFormValue[K]) => setV((x) => ({ ...x, [k]: val }));

  const menu = assocMenu(date) ?? STANDING_MENU;
  const item = menuItem(date, v.item);
  const overCutoff = !windowOpen(date, from, at) || !windowOpen(date, v.window, at);
  const name = v.associate.trim().toLowerCase();
  const dayOrders = all.filter((o) => o.date === date);
  const taken = !editing && !!name && dayOrders.some((o) => isLive(o) && o.associate.toLowerCase() === name && o.meal === mealOfWindow(v.window));
  const ok = (editing || (name && v.item && !taken)) && (!overCutoff || v.reason.trim()) && choicesComplete(item, v.mods);
  const canCancel = windowOpen(date, from, at) || !!v.reason.trim();
  const names = PROGRAM_NAMES.filter((n) => !dayOrders.some((o) => isLive(o) && o.associate === n && o.meal === mealOfWindow(v.window)));

  return (
    <div className={s.form}>
      {editing ? (
        <div className={s.who}>{editing.associate}</div>
      ) : (
        <>
          <TextField list={listId} autoFocus value={v.associate} onChange={(e) => set('associate', e.target.value)} placeholder="Associate name" aria-label="Associate name" />
          <datalist id={listId}>
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </>
      )}
      {taken && <div className={s.warn}>Already has {mealOfWindow(v.window).toLowerCase()} this day. Change that order instead.</div>}

      <select className={s.select} value={v.item} onChange={(e) => setV((x) => ({ ...x, item: e.target.value, mods: {} }))} aria-label="Meal">
        {!editing && <option value="">Meal (same choices as the app)</option>}
        {menu.map((m) => {
          const c = countOf(all, date, m.name, editing?.id);
          const soldOut = m.cap != null && c >= m.cap;
          return (
            <option key={m.id} value={m.name} disabled={soldOut}>
              {m.name}
              {m.cap != null ? ` (${c}/${m.cap}${soldOut ? ', sold out' : ''})` : ''}
            </option>
          );
        })}
      </select>

      {item?.mods.map((g) => (
        <select key={g.g} className={s.select} value={v.mods[g.g] ?? ''} onChange={(e) => set('mods', { ...v.mods, [g.g]: e.target.value })} aria-label={g.g}>
          <option value="">{g.g}, pick one</option>
          {g.opts.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ))}

      <select className={s.select} value={v.window} onChange={(e) => set('window', e.target.value)} aria-label="Pickup time">
        {windows.map((x) => (
          <option key={x.w} value={x.w}>
            {rangeLabel(x.w)} · {x.meal}
            {windowOpen(date, x.w, at) ? '' : ' · past cutoff'}
          </option>
        ))}
      </select>

      {overCutoff && (
        <div className={s.override}>
          <span className={s.overrideTitle}>Past the {CUTOFF_MIN} minute cutoff. Manager override, say why.</span>
          <TextField value={v.reason} onChange={(e) => set('reason', e.target.value)} placeholder="Reason, for example covering a shift" aria-label="Reason for the override" />
        </div>
      )}

      <div className={s.actions}>
        <Button variant="primary" className={s.grow} disabled={!ok} onClick={() => onSave(v, overCutoff)}>
          {editing ? 'Save change' : 'Place order'}
        </Button>
        {editing && onCancelOrder && (
          <Button variant="softDanger" disabled={!canCancel} onClick={() => onCancelOrder(v.reason)}>
            Cancel order
          </Button>
        )}
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
