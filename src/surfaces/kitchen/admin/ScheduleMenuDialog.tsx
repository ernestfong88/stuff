import { CalendarDays, Info } from 'lucide-react';
import { useId, useState } from 'react';
import { today } from '../../../lib/clock';
import { Button, Modal, TextField, toast } from '../../../ui';
import { menuById, scheduleMenu, type VenueAdminView } from '../../../store/venueSettings';
import { cycleDay } from './menuCycle';
import s from './ScheduleMenuDialog.module.css';

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromIso = (v: string) => new Date(v + 'T00:00:00').getTime();
const nextMonday = (d: Date) => {
  const n = new Date(d);
  n.setDate(n.getDate() + (((8 - n.getDay()) % 7) || 7));
  return n;
};

/**
 * Start a menu on a venue, now or from a later day. The menu and its start
 * date save together: changing one without the other silently shifts what
 * gets served.
 */
export function ScheduleMenuDialog({
  settings,
  venueId,
  onClose,
  fixedVenue,
  later,
}: {
  settings: VenueAdminView;
  venueId: string;
  onClose: () => void;
  /** Opened from one venue: don't offer to switch venue. */
  fixedVenue?: boolean;
  /** Line up the next menu: no menu picked yet, starting next Monday. */
  later?: boolean;
}) {
  const active = settings.venues.filter((v) => v.active);
  const [vid, setVid] = useState(venueId);
  const venue = settings.venues.find((v) => v.id === vid) ?? active[0];
  const [menuId, setMenuId] = useState(later ? '' : (venue?.menuId ?? ''));
  const [date, setDate] = useState(isoDay(later ? nextMonday(today()) : venue?.menuStartDt ? new Date(venue.menuStartDt) : today()));
  const menu = menuById(settings, menuId);
  const start = fromIso(date);
  const startsLater = start > today().getTime();
  const day = menu ? cycleDay(start, menu.cycleLen, today().getTime()) : null;
  const venueField = useId();
  const menuField = useId();

  const save = () => {
    if (!venue || !menu) return;
    scheduleMenu(venue.id, menu.id, start, startsLater);
    toast(
      startsLater
        ? `${menu.name} starts on ${venue.name} ${new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. It switches automatically.`
        : `${venue.name} now serves ${menu.name}`,
    );
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${later ? 'Schedule the next menu' : 'Choose a menu'} · ${venue?.name ?? ''}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!menu || !date} onClick={save} icon={<CalendarDays size={16} />}>
            {startsLater ? 'Schedule start' : 'Start now'}
          </Button>
        </>
      }
    >
      <div className={s.form}>
        {!fixedVenue && (
          <label className={s.field} htmlFor={venueField}>
            <span className={s.label}>Venue</span>
            <select id={venueField} className={s.select} value={vid} onChange={(e) => setVid(e.target.value)}>
              {active.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={s.field} htmlFor={menuField}>
          <span className={s.label}>Menu</span>
          <select id={menuField} className={s.select} value={menuId} onChange={(e) => setMenuId(e.target.value)}>
            <option value="">Choose a menu</option>
            {settings.menus
              .filter((m) => m.status !== 'archived')
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.season})
                </option>
              ))}
          </select>
        </label>
        <TextField
          type="date"
          label="Start date"
          hint={startsLater ? 'Day 1 of the menu. The venue switches to it on this day by itself.' : 'Day 1 of the menu. Today or earlier starts it now; a later day lines it up next.'}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        {menu && (
          <p className={s.note}>
            <Info size={15} className={s.noteIcon} />
            {menu.cycleLen > 0 && day != null ? (
              <span>
                With this start date, <b>today serves week {Math.ceil(day / 7)} of {Math.ceil(menu.cycleLen / 7)}</b>.
              </span>
            ) : (
              <span>This is a static menu: every day serves the same set, no start date needed.</span>
            )}
          </p>
        )}
      </div>
    </Modal>
  );
}
