import { parseQuarter, quarterIndexOf, quarterRange, weekStart } from '../../../../domain/menuCycle';
import { today } from '../../../../lib/clock';
import { roomVenue } from '../../../../store/venueMenu';
import {
  patchVenue,
  setVenueAlc,
  setVenueCycle,
  venueMenus,
  type MenuSummary,
  type Venue,
  type VenueAdminView,
} from '../../../../store/venueSettings';
import { toast, useConfirm } from '../../../../ui';
import { cycleWeekLabel } from '../../../kitchen/admin/menuCycle';
import { BoCallout, BoRow, BoSection } from '../../kit';
import { SettingSelect } from '../../kit/SettingControls';
import { thisWeek } from './summary';
import { isoOf } from '../../../../lib/dates';
import s from './venues.module.css';

const NONE = '__none';

/** "Q1 2027 (Jan 1 to Mar 31, 2027)" when a menu is for another quarter than today's, else null. */
function otherQuarter(m: MenuSummary, at: number): string | null {
  const q = parseQuarter(m.quarter);
  if (!q || q.index === quarterIndexOf(at)) return null;
  return `${m.quarter} (${quarterRange(m.quarter)})`;
}

/** Why going live with a menu today needs a second look, or null when it doesn't. */
function liveWarning(m: MenuSummary, at: number): string | null {
  const q = otherQuarter(m, at);
  return q ? `it is for ${q}` : null;
}

/** The two menus a venue serves: its menu cycle and its à la carte menu. */
export function VenueMenu({ settings, venue, goto }: { settings: VenueAdminView; venue: Venue; goto: (pageId: string) => void }) {
  const [ask, confirmDialog] = useConfirm();
  const { cycle, alc } = venueMenus(venue, settings.menus);
  // Archived menus aren't offered, unless the venue still serves one.
  const offer = (kind: 'cycle' | 'alc', current?: MenuSummary) =>
    settings.menus.filter(
      (m) =>
        (kind === 'alc' ? m.kind === 'alc' || m.cycleLen === 0 : m.kind !== 'alc' && m.cycleLen > 0) &&
        (m.status !== 'archived' || m.id === current?.id),
    );
  const options = (list: MenuSummary[], none: string) => [
    { id: NONE, label: none },
    ...list.map((m) => ({ id: m.id, label: `${m.name} · ${m.quarter}` })),
  ];
  const at = today().getTime();
  const nameOf = (id: string) => settings.menus.find((m) => m.id === id)?.name ?? 'the menu';
  // A kitchen's tablets order from its first active venue; another venue in it sets only its own printed menus and Production.
  const tabletVenue = venue.room ? roomVenue(venue.room, settings.venues) : null;
  const drives = tabletVenue?.id === venue.id;
  const who = drives ? 'The tablets' : `${venue.name}'s printed menus and Production`;

  /** What the tablets serve changes today: say what happened and offer to put it back. */
  const changed = (message: string) => {
    const before = { menuId: venue.menuId, menuStartDt: venue.menuStartDt, alcMenuId: venue.alcMenuId ?? null };
    return () =>
      toast(message, {
        tone: 'success',
        action: { label: 'Undo', onClick: () => patchVenue(venue.id, before) },
      });
  };

  const pickCycle = async (id: string) => {
    const next = id === NONE ? undefined : settings.menus.find((m) => m.id === id);
    if (next?.id === cycle?.id) return;
    const warn = next ? liveWarning(next, at) : null;
    const ok = await ask(
      next
        ? {
            title: `Serve ${next.name} at ${venue.name} today?`,
            message: `${warn ? `Check first: ${warn}. ` : ''}${who} switch to it now, with week 1 starting ${weekStart(at).toLocaleDateString('en-US', { weekday: 'long', month: 'numeric', day: 'numeric' })} (change it with Week 1 started), so today's specials change.`,
            confirmLabel: `Serve ${next.name}`,
            tone: warn ? 'danger' : 'primary',
          }
        : {
            title: `Stop serving a menu cycle at ${venue.name}?`,
            message: `${who} drop today's specials${alc ? ` and serve only ${alc.name}` : ', and with no à la carte menu nothing can be ordered there'}.`,
            confirmLabel: 'No cycle menu',
            tone: 'danger',
          },
    );
    if (!ok) return;
    const done = changed(next ? `${venue.name} serves ${next.name} from today` : `${venue.name} has no menu cycle now`);
    setVenueCycle(venue.id, next ? next.id : null, at, settings.menus);
    done();
  };

  const pickAlc = async (id: string) => {
    const next = id === NONE ? undefined : settings.menus.find((m) => m.id === id);
    if (next?.id === alc?.id) return;
    const warn = next ? liveWarning(next, at) : null;
    if (warn || !next) {
      const ok = await ask(
        next
          ? {
              title: `Serve ${next.name} at ${venue.name} today?`,
              message: `Check first: ${warn}. ${who} list it every day from now.`,
              confirmLabel: `Serve ${next.name}`,
              tone: 'danger',
            }
          : {
              title: `Stop serving an à la carte menu at ${venue.name}?`,
              message: `${who} drop every every-day dish${cycle ? ` and serve only ${cycle.name}'s specials` : ', and with no menu cycle nothing can be ordered there'}.`,
              confirmLabel: 'No à la carte menu',
              tone: 'danger',
            },
      );
      if (!ok) return;
    }
    const done = changed(next ? `${venue.name} serves ${nameOf(next.id)}` : `${venue.name} has no à la carte menu now`);
    setVenueAlc(venue.id, next ? next.id : null, settings.menus);
    done();
  };

  const pickStart = (value: string) => {
    const [y, mo, d] = value.split('-').map(Number);
    if (!y || !cycle) return;
    const sunday = weekStart(new Date(y, mo - 1, d));
    if (venue.menuStartDt != null && weekStart(venue.menuStartDt).getTime() === sunday.getTime()) return;
    patchVenue(venue.id, { menuStartDt: sunday.getTime() });
    const now = cycleWeekLabel(sunday.getTime(), cycle, at);
    const snapped = sunday.getDate() !== d || sunday.getMonth() !== mo - 1 ? ` (the Sunday of that week: weeks run Sunday to Saturday)` : '';
    toast(
      `Week 1 started ${sunday.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })}${snapped}. Today is ${now?.toLowerCase() ?? 'not on the cycle'}, so today's specials changed.`,
      {
        tone: 'success',
        action: { label: 'Undo', onClick: () => patchVenue(venue.id, { menuStartDt: venue.menuStartDt }) },
      },
    );
  };

  const weekNow = thisWeek(venue, cycle, at);
  return (
    <BoSection title="Menus" sub="What servers can order here: daily specials from a menu cycle, and an à la carte menu every day.">
      {confirmDialog}
      {tabletVenue && !drives && (
        <BoCallout tone="info">
          {venue.name} shares {tabletVenue.name}&apos;s tablets, so servers here order from {tabletVenue.name}&apos;s menus. The menus below set only{' '}
          {venue.name}&apos;s printed menus and Production.
        </BoCallout>
      )}
      <BoRow label="Menu cycle" hint={cycle ? 'Daily specials that rotate week by week' : 'None: no daily specials, only the à la carte menu'}>
        <SettingSelect
          label={`${venue.name} menu cycle`}
          value={cycle?.id ?? NONE}
          options={options(offer('cycle', cycle), 'No menu cycle')}
          onChange={(id) => void pickCycle(id)}
        />
      </BoRow>
      {cycle && liveWarning(cycle, at) && <p className={s.missing}>Served today, but {liveWarning(cycle, at)}.</p>}
      {cycle && (
        <BoRow
          label="Week 1 started"
          hint={
            <>
              <span className={weekNow ? s.weekNow : s.weekMissing}>
                {weekNow ? `${weekNow}.` : 'Not set yet, so today’s specials can’t be picked.'}
              </span>{' '}
              Always a Sunday; changing it changes today&apos;s specials.
            </>
          }
        >
          <input
            type="date"
            className={s.dateInput}
            aria-label={`${venue.name} week 1 started`}
            value={venue.menuStartDt ? isoOf(weekStart(venue.menuStartDt).getTime()) : ''}
            onChange={(e) => pickStart(e.target.value)}
          />
        </BoRow>
      )}
      <BoRow
        label="À la carte"
        hint={alc ? (cycle ? 'Served every day, alongside the cycle' : 'Served every day') : 'None: only the menu cycle’s specials'}
      >
        <SettingSelect
          label={`${venue.name} à la carte menu`}
          value={alc?.id ?? NONE}
          options={options(offer('alc', alc), 'No à la carte menu')}
          onChange={(id) => void pickAlc(id)}
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
