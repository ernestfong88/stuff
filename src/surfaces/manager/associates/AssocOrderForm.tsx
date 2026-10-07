import { useEffect, useId, useRef, useState } from 'react';
import type { AssocMeal } from '../../../domain/types';
import { now } from '../../../lib/clock';
import { Button, TextField, useConfirm } from '../../../ui';
import { itemsLeft, missingChoice } from '../../../domain/assocMeals/menu';
import { assocMenuFor, useAssocMenuSettings } from '../../../store/assocMenu';
import { CUTOFF_MIN, PROGRAM_NAMES, isLive, mealOfWindow, orderChoices, orderFormReady, orderFormTodo, rangeLabel, windowOpen, type AssocWindow } from './assocProgram';
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
  const box = useRef<HTMLDivElement>(null);
  const [ask, confirmDialog] = useConfirm();
  // The form opens inside its pickup card, which can be far down the page.
  useEffect(() => box.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), []);
  const [v, setV] = useState<AssocFormValue>(() => ({
    associate: editing?.associate ?? '',
    item: editing?.item ?? '',
    window: editing?.window ?? from,
    mods: orderChoices(editing),
    reason: '',
  }));
  const at = now();
  const set = <K extends keyof AssocFormValue>(k: K, val: AssocFormValue[K]) => setV((x) => ({ ...x, [k]: val }));

  const settings = useAssocMenuSettings();
  // Lunch and dinner have different specials; the pickup time decides the meal.
  const menu = assocMenuFor(date, mealOfWindow(v.window), date, settings, true) ?? [];
  const item = menu.find((m) => m.name === v.item) ?? null;
  const overCutoff = !windowOpen(date, from, at) || !windowOpen(date, v.window, at);
  const name = v.associate.trim().toLowerCase();
  const dayOrders = all.filter((o) => o.date === date);
  const taken = !editing && !!name && dayOrders.some((o) => isLive(o) && o.associate.toLowerCase() === name && o.meal === mealOfWindow(v.window));
  const form = {
    editing: !!editing,
    name,
    item: v.item,
    taken,
    missingGroup: item ? missingChoice(item, v.mods)?.group : null,
    overCutoff,
    reason: v.reason,
  };
  // A change that moves lunch to dinner clears the meal, so an edit needs one picked too.
  const ok = orderFormReady(form);
  // Say what still stops the save, so a grey button is never a mystery.
  const todo = orderFormTodo(form);
  const cancelOrder = async () => {
    if (!editing || !onCancelOrder) return;
    const yes = await ask({
      title: `Cancel ${editing.associate}’s ${editing.item}?`,
      message: 'The order comes off the pickup list and the change is logged with your name.',
      confirmLabel: 'Cancel order',
      cancelLabel: 'Keep it',
      tone: 'danger',
    });
    if (yes) onCancelOrder(v.reason);
  };
  const canCancel = windowOpen(date, from, at) || !!v.reason.trim();
  const names = PROGRAM_NAMES.filter((n) => !dayOrders.some((o) => isLive(o) && o.associate === n && o.meal === mealOfWindow(v.window)));

  return (
    <div className={s.form} ref={box}>
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
          const left = itemsLeft(all, date, m, editing?.id);
          const soldOut = left === 0;
          return (
            <option key={m.id} value={m.name} disabled={soldOut}>
              {m.special ? `Chef's special: ${m.name}` : m.name}
              {m.cap != null ? ` (${m.cap - (left ?? 0)}/${m.cap}${soldOut ? ', sold out' : ''})` : ''}
            </option>
          );
        })}
      </select>

      {item?.mods.map((g) => (
        <select key={g.group} className={s.select} value={v.mods[g.group] ?? ''} onChange={(e) => set('mods', { ...v.mods, [g.group]: e.target.value })} aria-label={g.group}>
          <option value="">{g.group}, pick one</option>
          {g.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ))}

      <select
        className={s.select}
        value={v.window}
        onChange={(e) => {
          const w = e.target.value;
          // A special doesn't carry over between lunch and dinner.
          const keeps = (assocMenuFor(date, mealOfWindow(w), date, settings, true) ?? []).some((m) => m.name === v.item);
          setV((x) => ({ ...x, window: w, ...(keeps ? {} : { item: '', mods: {} }) }));
        }}
        aria-label="Pickup time"
      >
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

      {todo && <div className={s.todo}>{todo}</div>}
      <div className={s.actions}>
        <Button variant="primary" className={s.grow} disabled={!ok} onClick={() => onSave(v, overCutoff)}>
          {editing ? 'Save change' : 'Place order'}
        </Button>
        {editing && onCancelOrder && (
          <Button variant="softDanger" disabled={!canCancel} onClick={cancelOrder} title={canCancel ? undefined : 'Add a reason for the override first'}>
            Cancel order
          </Button>
        )}
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
      {confirmDialog}
    </div>
  );
}
