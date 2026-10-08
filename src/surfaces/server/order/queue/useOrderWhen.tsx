import { useState, type ReactNode } from 'react';
import { isoDate } from '../../../../domain/pickup';
import type { MealName, Order } from '../../../../domain/types';
import { useDiningActions } from '../../../../store/dining';
import { Button, Modal, toast } from '../../../../ui';
import { menuWords, offMenuLines, type OffMenuLine } from './orderWhen';

/** Where a pick up or delivery is moving to. readyAt null leaves it with no time booked. */
export interface WhenTarget {
  date: string;
  meal: MealName;
  readyAt: string | null;
}

interface Pending {
  target: WhenTarget;
  lines: OffMenuLine[];
}

const listNames = (lines: OffMenuLine[]) => {
  const names = lines.map((l) => l.name);
  return names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

/**
 * Move a pick up or delivery to another day, meal or time. When lines on it
 * aren't on the new day's or meal's menu, it asks first: keep them, remove
 * them, or stay as it was. Nothing is ever dropped without asking.
 */
export function useOrderWhen(o: Order): { change: (target: WhenTarget) => void; dialog: ReactNode } {
  const dining = useDiningActions();
  const [pending, setPending] = useState<Pending | null>(null);

  const apply = (t: WhenTarget, remove: OffMenuLine[]) => {
    for (const r of remove) {
      // Its sides go with it.
      const sides = o.diners.find((d) => d.id === r.dinerId)?.items.filter((i) => i.parentId === r.line.id && !i.sent) ?? [];
      for (const x of sides) dining.removeItem(o.id, r.dinerId, x.id);
      dining.removeItem(o.id, r.dinerId, r.line.id);
    }
    const forDate = t.date > isoDate(0) ? t.date : undefined;
    if (forDate !== o.forDate) dining.patchOrder(o.id, { forDate });
    if (t.meal !== o.meal) dining.setOrderMeal(o.id, t.meal);
    if ((t.readyAt ?? undefined) !== o.readyAt) {
      if (t.readyAt) dining.setOrderSchedule(o.id, t.readyAt);
      else dining.patchOrder(o.id, { readyAt: undefined });
    }
    if (remove.length) toast(`Removed ${listNames(remove)}.`);
  };

  const change = (t: WhenTarget) => {
    const sameMenu =
      t.meal === o.meal && (t.date > isoDate(0) ? t.date : undefined) === (o.forDate && o.forDate > isoDate(0) ? o.forDate : undefined);
    const lines = sameMenu ? [] : offMenuLines(o, t.meal, t.date);
    if (lines.length) setPending({ target: t, lines });
    else apply(t, []);
  };

  const n = pending?.lines.length ?? 0;
  const dialog = pending && (
    <Modal
      open
      onClose={() => setPending(null)}
      width={480}
      title={`${n === 1 ? '1 item isn’t' : `${n} items aren’t`} on ${menuWords(pending.target.date, pending.target.meal)}`}
      footer={
        <>
          <Button variant="ghost" onClick={() => setPending(null)}>
            Cancel
          </Button>
          <Button
            variant="softDanger"
            onClick={() => {
              apply(pending.target, pending.lines);
              setPending(null);
            }}
          >
            Remove {n === 1 ? 'it' : 'them'}
          </Button>
          <Button
            variant="primary"
            data-autofocus
            onClick={() => {
              apply(pending.target, []);
              setPending(null);
            }}
          >
            Keep {n === 1 ? 'it' : 'them'}
          </Button>
        </>
      }
    >
      <div style={{ color: 'var(--s500)', fontSize: 14, lineHeight: 1.5 }}>
        <b style={{ color: 'var(--s700)' }}>{listNames(pending.lines)}</b> {n === 1 ? 'is' : 'are'} on the order now. Keep {n === 1 ? 'it' : 'them'}{' '}
        if the kitchen can still make {n === 1 ? 'it' : 'them'}, or remove {n === 1 ? 'it' : 'them'} and pick from the new menu.
      </div>
    </Modal>
  );
  return { change, dialog };
}
