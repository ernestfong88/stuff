import { CalendarClock, CalendarDays, X } from 'lucide-react';
import { useState } from 'react';
import { today } from '../../../../lib/clock';
import { Button, toast } from '../../../../ui';
import { menuById, removeUpcoming, type Venue, type VenueAdminView } from '../../../../store/venueSettings';
import { cycleWeekLabel, isStaticMenu, menuQuarter } from '../../../kitchen/admin/menuCycle';
import { QuarterBadge } from '../../../kitchen/admin/QuarterBadge';
import { ScheduleMenuDialog } from '../../../kitchen/admin/ScheduleMenuDialog';
import { BoSection } from '../../kit';
import s from './venues.module.css';

const longDate = (ts: number) => new Date(ts).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/** What a venue serves today, and the menus lined up after it. */
export function VenueMenu({ settings, venue, goto }: { settings: VenueAdminView; venue: Venue; goto: (pageId: string) => void }) {
  const [dialog, setDialog] = useState<'now' | 'later' | null>(null);
  const menu = menuById(settings, venue.menuId);
  const week = cycleWeekLabel(venue.menuStartDt, menu, today().getTime());
  const upcoming = [...venue.upcoming].sort((a, b) => a.startDt - b.startDt);

  return (
    <>
      <BoSection
        title="Serving now"
        actions={
          <Button size="sm" variant={menu ? 'secondary' : 'primary'} icon={<CalendarDays size={14} />} onClick={() => setDialog('now')}>
            {menu ? 'Change menu' : 'Choose a menu'}
          </Button>
        }
      >
        {menu ? (
          <div className={s.now}>
            <div className={s.nowName}>
              {menu.name}
              <QuarterBadge quarter={menuQuarter(menu)} />
            </div>
            <div className={s.nowMeta}>
              {isStaticMenu(menu)
                ? 'À la carte: the same menu every day'
                : week
                  ? `${week} today · started ${longDate(venue.menuStartDt!)}`
                  : 'No start date yet. Change menu and pick the day it started.'}
            </div>
          </div>
        ) : (
          <p className={s.missing}>No menu yet, so nothing can be ordered here. Choose the menu this venue serves.</p>
        )}
      </BoSection>

      <BoSection
        title="Up next"
        sub="A menu lined up here takes over by itself on its start date."
        actions={
          <Button size="sm" icon={<CalendarClock size={14} />} onClick={() => setDialog('later')}>
            Schedule the next menu
          </Button>
        }
      >
        {upcoming.length ? (
          <ul className={s.upList}>
            {upcoming.map((u) => {
              const m = menuById(settings, u.menuId);
              return (
                <li key={u.startDt} className={s.upRow}>
                  <span className={s.upDate}>{longDate(u.startDt)}</span>
                  <span className={s.upName}>{m?.name ?? 'A menu that no longer exists'}</span>
                  {m && <QuarterBadge quarter={menuQuarter(m)} />}
                  <Button
                    size="sm"
                    variant="ghost"
                    iconOnly
                    icon={<X size={15} />}
                    aria-label={`Cancel ${m?.name ?? 'menu'} on ${venue.name}`}
                    title="Cancel this change"
                    className={s.upRemove}
                    onClick={() => {
                      removeUpcoming(venue.id, u.startDt);
                      toast(`${m?.name ?? 'The menu'} won't start on ${venue.name}`);
                    }}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={s.quiet}>Nothing lined up. {menu ? `${venue.name} keeps serving ${menu.name}.` : ''}</p>
        )}
        <p className={s.foot}>
          Menus are built in{' '}
          <button className={s.link} onClick={() => goto('menus')}>
            Menu Cycle &amp; À la Carte
          </button>
          .
        </p>
      </BoSection>

      {dialog && <ScheduleMenuDialog settings={settings} venueId={venue.id} fixedVenue later={dialog === 'later'} onClose={() => setDialog(null)} />}
    </>
  );
}
