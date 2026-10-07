import { useState } from 'react';
import { Copy } from 'lucide-react';
import { dayTitle, type CycleAnchor } from '../../../../domain/menuCycle';
import { Button, Modal, cx, toast } from '../../../../ui';
import { useBo } from '../data';
import { copyDay } from '../menuActions';
import { sameWeekday } from '../model/dayGroup';
import s from './CopyDayDialog.module.css';

/**
 * Copy one day of the cycle onto others: tick the days, week by week. What
 * is already on those days stays; the copied dishes are added.
 */
export function CopyDayDialog({
  menuId,
  from,
  len,
  anchor,
  onClose,
}: {
  menuId: string;
  from: number;
  len: number;
  anchor: CycleAnchor | null;
  onClose: () => void;
}) {
  const bo = useBo();
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const weeks = Math.ceil(len / 7);
  const count = (d: number) => bo.grid.filter((g) => g.menuId === menuId && g.day === d).length;
  const fromCount = count(from);
  const toggle = (d: number) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(d)) n.delete(d);
      else n.add(d);
      return n;
    });
  const weekday = dayTitle(anchor, from).split(' ')[0];
  const copy = () => {
    const to = [...picked].sort((a, b) => a - b);
    copyDay(menuId, from, to);
    toast(`Copied ${dayTitle(anchor, from)} to ${to.length} day${to.length === 1 ? '' : 's'}`, { tone: 'success' });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Copy ${dayTitle(anchor, from)}`}
      width={620}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Copy size={15} />} disabled={!picked.size || !fromCount} onClick={copy}>
            {picked.size ? `Copy to ${picked.size} day${picked.size === 1 ? '' : 's'}` : 'Pick days to copy to'}
          </Button>
        </>
      }
    >
      <p className={s.lead}>
        {fromCount
          ? `All ${fromCount} dishes from ${dayTitle(anchor, from)} are added to the days you tick. Dishes already on those days stay.`
          : `${dayTitle(anchor, from)} has nothing on it yet, so there is nothing to copy.`}
      </p>
      <div className={s.quick}>
        {weeks > 1 && anchor && (
          <Button size="sm" onClick={() => setPicked(new Set(sameWeekday(from, len)))}>
            Every {weekday} in the cycle
          </Button>
        )}
        {weeks > 1 && !anchor && (
          <Button size="sm" onClick={() => setPicked(new Set(sameWeekday(from, len)))}>
            Same day in every week
          </Button>
        )}
        {picked.size > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>
            Clear
          </Button>
        )}
      </div>
      <div className={s.weeks}>
        {Array.from({ length: weeks }, (_, w) => (
          <div key={w} className={s.week}>
            <span className={s.weekLabel}>Week {w + 1}</span>
            <div className={s.days}>
              {Array.from({ length: 7 }, (_, i) => w * 7 + i + 1)
                .filter((d) => d <= len)
                .map((d) => {
                  const on = picked.has(d);
                  const self = d === from;
                  const has = count(d);
                  return (
                    <button
                      key={d}
                      className={cx(s.day, on && s.dayOn, self && s.daySelf)}
                      disabled={self}
                      aria-pressed={on}
                      title={self ? 'The day you are copying' : has ? `${has} dishes there already` : 'Nothing there yet'}
                      onClick={() => toggle(d)}
                    >
                      <span className={s.dayName}>{dayTitle(anchor, d)}</span>
                      <span className={s.dayNote}>{self ? 'Copying' : has ? `${has} dishes` : 'Empty'}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
