import { CalendarDays, X } from 'lucide-react';
import { useState } from 'react';
import { today } from '../../../lib/clock';
import { Button } from '../../../ui';
import { BoSection, BoTable } from '../../backoffice/kit';
import { menuById, removeUpcoming, type Venue, type VenueSettings } from '../venueSettings';
import { cycleWeekLabel, isStaticMenu, menuQuarter } from './menuCycle';
import { QuarterBadge } from './QuarterBadge';
import { ScheduleMenuDialog } from './ScheduleMenuDialog';
import s from './ServingNow.module.css';

const shortDate = (ts: number) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** Serving now: each dining room's menu, where it is in its cycle, and what starts next. */
export function ServingNow({ settings }: { settings: VenueSettings }) {
  const [scheduling, setScheduling] = useState<string | null>(null);
  const at = today().getTime();
  const venues = settings.venues.filter((v) => v.active);
  return (
    <BoSection title="Serving now" flush>
      <BoTable<Venue>
        rowKey={(v) => v.id}
        rows={venues}
        empty="No venues yet."
        columns={[
          { key: 'room', header: 'Dining room', render: (v) => <span className={s.venue}>{v.name}</span> },
          {
            key: 'menu',
            header: 'Menu',
            render: (v) => {
              const m = menuById(settings, v.menuId);
              return m ? <span className={s.menu}>{m.name}</span> : <span className={s.nothing}>Nothing scheduled</span>;
            },
          },
          {
            key: 'quarter',
            header: 'Quarter',
            render: (v) => {
              const m = menuById(settings, v.menuId);
              return m ? <QuarterBadge quarter={menuQuarter(m)} /> : null;
            },
          },
          {
            key: 'today',
            header: 'Today',
            render: (v) => {
              const m = menuById(settings, v.menuId);
              if (!m) return null;
              return <span className={s.today}>{isStaticMenu(m) ? 'À la carte, every day' : (cycleWeekLabel(v.menuStartDt, m, at) ?? '')}</span>;
            },
          },
          {
            key: 'next',
            header: 'Up next',
            render: (v) =>
              v.upcoming.length ? (
                <span className={s.nextList}>
                  {[...v.upcoming]
                    .sort((a, b) => a.startDt - b.startDt)
                    .map((u) => {
                      const m = menuById(settings, u.menuId);
                      return (
                        <span key={u.startDt} className={s.next}>
                          {m?.name}
                          {m && <QuarterBadge quarter={menuQuarter(m)} />}
                          <span className={s.from}>from {shortDate(u.startDt)}</span>
                          <button className={s.remove} onClick={() => removeUpcoming(v.id, u.startDt)} aria-label={`Remove ${m?.name ?? 'menu'} from ${v.name}`}>
                            <X size={14} />
                          </button>
                        </span>
                      );
                    })}
                </span>
              ) : (
                <span className={s.nothingNext}>None</span>
              ),
          },
          {
            key: 'act',
            header: '',
            align: 'right',
            render: (v) => (
              <Button size="sm" variant="secondary" icon={<CalendarDays size={14} />} onClick={() => setScheduling(v.id)}>
                Schedule
              </Button>
            ),
          },
        ]}
      />
      {scheduling && <ScheduleMenuDialog settings={settings} venueId={scheduling} onClose={() => setScheduling(null)} />}
    </BoSection>
  );
}
