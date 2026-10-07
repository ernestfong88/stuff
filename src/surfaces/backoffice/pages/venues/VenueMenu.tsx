import { today } from '../../../../lib/clock';
import { patchVenue, setVenueAlc, setVenueCycle, venueMenus, type MenuSummary, type Venue, type VenueAdminView } from '../../../../store/venueSettings';
import { toast } from '../../../../ui';
import { cycleWeekLabel } from '../../../kitchen/admin/menuCycle';
import { BoRow, BoSection } from '../../kit';
import { SettingSelect } from '../../kit/SettingControls';
import s from './venues.module.css';

const NONE = '__none';
const isoDay = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** The two menus a venue serves: its menu cycle and its à la carte menu. */
export function VenueMenu({ settings, venue, goto }: { settings: VenueAdminView; venue: Venue; goto: (pageId: string) => void }) {
  const { cycle, alc } = venueMenus(venue, settings.menus);
  // Archived menus aren't offered, unless the venue still serves one.
  const offer = (kind: 'cycle' | 'alc', current?: MenuSummary) =>
    settings.menus.filter((m) => (kind === 'alc' ? m.kind === 'alc' || m.cycleLen === 0 : m.kind !== 'alc' && m.cycleLen > 0) && (m.status !== 'archived' || m.id === current?.id));
  const options = (list: MenuSummary[], none: string) => [{ id: NONE, label: none }, ...list.map((m) => ({ id: m.id, label: `${m.name} · ${m.quarter}` }))];
  const week = cycle && cycleWeekLabel(venue.menuStartDt, cycle, today().getTime());

  return (
    <BoSection title="Menus">
      <BoRow label="Menu cycle" hint={cycle ? (week ? `${week} today` : 'Set the day week 1 started') : 'No cycle: only the à la carte menu is served'}>
        <SettingSelect
          label={`${venue.name} menu cycle`}
          value={cycle?.id ?? NONE}
          options={options(offer('cycle', cycle), 'No cycle menu')}
          onChange={(id) => {
            setVenueCycle(venue.id, id === NONE ? null : id, today().getTime(), settings.menus);
            toast(id === NONE ? `${venue.name} has no menu cycle now` : `${venue.name} serves ${settings.menus.find((m) => m.id === id)?.name}`, { tone: 'success' });
          }}
        />
      </BoRow>
      {cycle && (
        <BoRow label="Week 1 started" hint="The cycle day each date falls on counts from here.">
          <input
            type="date"
            className={s.dateInput}
            aria-label={`${venue.name} week 1 started`}
            value={venue.menuStartDt ? isoDay(venue.menuStartDt) : ''}
            onChange={(e) => {
              const [y, mo, d] = e.target.value.split('-').map(Number);
              if (y) patchVenue(venue.id, { menuStartDt: new Date(y, mo - 1, d).getTime() });
            }}
          />
        </BoRow>
      )}
      <BoRow label="À la carte menu" hint={alc ? 'Served every day alongside the cycle' : 'No à la carte menu'}>
        <SettingSelect
          label={`${venue.name} à la carte menu`}
          value={alc?.id ?? NONE}
          options={options(offer('alc', alc), 'No à la carte menu')}
          onChange={(id) => {
            setVenueAlc(venue.id, id === NONE ? null : id, settings.menus);
            toast(id === NONE ? `${venue.name} has no à la carte menu now` : `${venue.name} serves ${settings.menus.find((m) => m.id === id)?.name}`, { tone: 'success' });
          }}
        />
      </BoRow>
      {!cycle && !alc && <p className={s.missing}>No menu yet, so nothing can be ordered here.</p>}
      <p className={s.foot}>
        Menus are built in{' '}
        <button className={s.link} onClick={() => goto('menus')}>
          Menu Cycle &amp; À la Carte
        </button>
        .
      </p>
    </BoSection>
  );
}
