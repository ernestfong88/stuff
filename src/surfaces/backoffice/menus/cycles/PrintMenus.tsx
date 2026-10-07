import { useState } from 'react';
import { Printer } from 'lucide-react';
import { now } from '../../../../lib/clock';
import { useSetting } from '../../../../store/serviceConfig';
import type { BoMenu } from '../../../../store/menuEdits';
import { Button, Popover, cx } from '../../../../ui';
import { placementSides, useBo } from '../data';
import { monthDay, type CycleAnchor } from '../model/cycle';
import { menuHtml, printContext, printWeek, weekDays, type PrintKind } from '../model/menuPrint';
import { printHtml } from '../ui/printFrame';
import s from './PrintMenus.module.css';

/** "Print menus" in the builder: the day, the week, à la carte and the order form, dated as the builder shows. */
export function PrintMenus({ menu, week, anchor }: { menu: BoMenu; week: number; anchor: CycleAnchor | null }) {
  const bo = useBo();
  const winGrid = useSetting<unknown>('win.grid');
  const [day, setDay] = useState<number | null>(null);
  const C = printContext(bo, { menuId: menu.id, anchor, winGrid, diet: true, at: now() }, (m, d, r) => placementSides(bo, m, d, r).sides);
  const w = printWeek(C, week);
  const days = C.len > 0 ? weekDays(C, w) : [];
  const dd = day && days.includes(day) ? day : days.includes(C.today) ? C.today : days[0];
  const go = (kind: PrintKind, close: () => void) => {
    printHtml(menuHtml(kind, C, { week: w, day: dd }));
    close();
  };
  const option = (kind: PrintKind, title: string, sub: string, close: () => void, extra?: React.ReactNode) => (
    <div className={s.opt}>
      <div className={s.optRow}>
        <div className={s.optText}>
          <div className={s.optTitle}>{title}</div>
          <div className={s.optSub}>{sub}</div>
        </div>
        <Button size="sm" variant="primary" onClick={() => go(kind, close)}>
          Print
        </Button>
      </div>
      {extra}
    </div>
  );
  return (
    <Popover
      align="right"
      minWidth={360}
      trigger={({ toggle }) => (
        <Button icon={<Printer size={15} />} onClick={toggle}>
          Print menus
        </Button>
      )}
    >
      {({ close }) => (
        <div className={s.panel}>
          <div className={s.head}>Letter size · {C.venueName}</div>
          {days.length > 0 &&
            option(
              'daily',
              'Daily menu',
              'For residents, by meal · ' + (dd ? C.dateOf(dd).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''),
              close,
              <div className={s.days}>
                {days.map((x) => (
                  <button key={x} className={cx(s.day, x === dd && s.dayOn)} aria-pressed={x === dd} onClick={() => setDay(x)}>
                    {C.dateOf(x).toLocaleDateString('en-US', { weekday: 'short' })} {monthDay(C.dateOf(x))}
                  </button>
                ))}
              </div>,
            )}
          {days.length > 0 &&
            option('week', 'Week at a glance', `Week ${w + 1} · ${monthDay(C.dateOf(days[0]))} to ${monthDay(C.dateOf(days[days.length - 1]))}`, close)}
          {option('alacarte', 'À la carte menu', 'Any Day items, by meal', close)}
          {days.length > 0 && option('order', 'Weekly order form', 'For pick up, with checkboxes, name, apartment and pick up range', close)}
        </div>
      )}
    </Popover>
  );
}
