/**
 * Venue Settings: pick a venue on the left, set it up on the right. Each
 * venue has a menu, printers and card terminals, its kitchen's cook screens,
 * and a name and kitchen. Problems across venues are listed at the top,
 * each a click from the tab that fixes it.
 *
 * #/backoffice/venues/<venueId>/<tab> opens a venue on a tab.
 */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight, Plus, RotateCcw } from 'lucide-react';
import { navigate, useRoute } from '../../../shell/router';
import { today } from '../../../lib/clock';
import { Button, Tabs, cx, toast } from '../../../ui';
import { KdsScreensEditor } from '../../kitchen/admin/KdsScreensEditor';
import { cycleWeekLabel, isStaticMenu } from '../../kitchen/admin/menuCycle';
import { VenueDevices } from '../../kitchen/admin/VenueDevices';
import { menuById, patchVenue, useVenueSettings, venueSettingsStore, type Venue, type VenueAdminView } from '../../../store/venueSettings';
import { cycleLenOf, refreshLiveMenu, useBo } from '../menus/data';
import { BoPage, BoSection } from '../kit';
import type { BoPageProps } from '../nav';
import { NewVenueDialog } from './venues/NewVenueDialog';
import { VenueDetails, kitchenName } from './venues/VenueDetails';
import { VenueMenu } from './venues/VenueMenu';
import { allVenueIssues, kitchenOf, venueIssues, type VenueTab } from './venues/issues';
import s from './venues/venues.module.css';

const TABS: VenueTab[] = ['menu', 'devices', 'kitchen', 'details'];

/** One line under a venue's name in the list: its menu and where it is in the cycle. */
function menuLine(settings: VenueAdminView, v: Venue): string {
  const m = menuById(settings, v.menuId);
  if (!m) return 'No menu';
  if (isStaticMenu(m)) return `${m.name} · every day`;
  const week = cycleWeekLabel(v.menuStartDt, m, today().getTime());
  return week ? `${m.name} · ${week.toLowerCase()}` : `${m.name} · no start date`;
}

export default function Page({ goto }: BoPageProps) {
  const stored = useVenueSettings();
  const bo = useBo();
  // The menus come from Menu Cycle & À la Carte, so a menu built there can be scheduled here.
  const settings = useMemo<VenueAdminView>(
    () => ({
      ...stored,
      menus: bo.menus.map((m) => ({
        id: m.id,
        name: m.name,
        season: m.quarter,
        quarter: m.quarter,
        kind: m.kind,
        status: m.status,
        cycleLen: cycleLenOf(bo, m.id),
      })),
    }),
    [stored, bo],
  );
  // Starting a menu moves the cycle day, so the floor's specials follow.
  useEffect(() => venueSettingsStore.subscribe(refreshLiveMenu), []);

  const [adding, setAdding] = useState(false);
  const [showRetired, setShowRetired] = useState(false);
  const route = useRoute();
  const active = settings.venues.filter((v) => v.active);
  const retired = settings.venues.filter((v) => !v.active);
  const venue = active.find((v) => v.id === route.path[1]) ?? active[0];
  const tab: VenueTab = TABS.includes(route.path[2] as VenueTab) ? (route.path[2] as VenueTab) : 'menu';
  const open = (id: string, t: VenueTab = 'menu') => navigate('backoffice', ['venues', id, t], { replace: true });
  const issues = allVenueIssues(settings);

  return (
    <BoPage
      title="Venue Settings"
      sub="Choose a venue to set what it serves, its printers and card terminals, and its kitchen screens."
      actions={
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>
          New venue
        </Button>
      }
    >
      {issues.length > 0 && (
        <section className={s.attention} aria-label="Needs attention">
          <div className={s.attentionHead}>
            <AlertTriangle size={16} aria-hidden />
            {issues.length === 1 ? 'One thing needs attention' : `${issues.length} things need attention`}
          </div>
          <ul className={s.attentionList}>
            {issues.map((i, n) => (
              <li key={n}>
                <button className={s.issue} onClick={() => open(i.venueId, i.tab)}>
                  <span className={cx(s.issueDot, i.tone === 'danger' ? s.dotDanger : s.dotWarning)} aria-hidden />
                  <span className={s.issueVenue}>{settings.venues.find((v) => v.id === i.venueId)?.name}</span>
                  <span className={s.issueText}>{i.text}</span>
                  <span className={s.issueFix}>
                    Fix <ChevronRight size={14} aria-hidden />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={s.layout}>
        <nav className={s.list} aria-label="Venues">
          {active.map((v) => {
            const vi = venueIssues(settings, v);
            const worst = vi.some((i) => i.tone === 'danger') ? 'danger' : vi.length ? 'warning' : null;
            const on = v.id === venue?.id;
            return (
              <button key={v.id} className={cx(s.venueBtn, on && s.venueOn)} aria-current={on ? 'true' : undefined} onClick={() => open(v.id, tab)}>
                <span className={s.venueText}>
                  <span className={s.venueName}>{v.name}</span>
                  <span className={s.venueMenu}>{menuLine(settings, v)}</span>
                  <span className={s.venueKitchen}>{v.room ? kitchenName(v.room) : 'No kitchen'}</span>
                </span>
                {worst && (
                  <span className={cx(s.badge, worst === 'danger' ? s.badgeDanger : s.badgeWarning)} aria-label={`${vi.length} to fix`}>
                    {vi.length}
                  </span>
                )}
              </button>
            );
          })}
          {retired.length > 0 && (
            <div className={s.retired}>
              <button className={s.retiredToggle} aria-expanded={showRetired} onClick={() => setShowRetired((x) => !x)}>
                Retired venues ({retired.length})
              </button>
              {showRetired &&
                retired.map((v) => (
                  <div key={v.id} className={s.retiredRow}>
                    <span className={s.retiredName}>{v.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<RotateCcw size={14} />}
                      onClick={() => {
                        patchVenue(v.id, { active: true });
                        open(v.id);
                        toast(`${v.name} is back`);
                      }}
                    >
                      Bring back
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </nav>

        <div className={s.detail}>
          {venue ? (
            <VenueDetail settings={settings} venue={venue} tab={tab} onTab={(t) => open(venue.id, t)} goto={goto} onRetired={() => open(active.find((v) => v.id !== venue.id)?.id ?? '')} />
          ) : (
            <BoSection title="No venues">
              <p className={s.quiet}>Add a venue to start: a dining room, bistro or catering.</p>
            </BoSection>
          )}
        </div>
      </div>

      {adding && (
        <NewVenueDialog
          onClose={() => setAdding(false)}
          onCreated={(id) => {
            setAdding(false);
            open(id, 'menu');
          }}
        />
      )}
    </BoPage>
  );
}

function VenueDetail({
  settings,
  venue,
  tab,
  onTab,
  goto,
  onRetired,
}: {
  settings: VenueAdminView;
  venue: Venue;
  tab: VenueTab;
  onTab: (t: VenueTab) => void;
  goto: (pageId: string) => void;
  onRetired: () => void;
}) {
  const issues = venueIssues(settings, venue);
  const count = (t: VenueTab) => issues.filter((i) => i.tab === t).length || undefined;
  const kitchen = kitchenOf(settings, venue);
  return (
    <>
      <header className={s.detailHead}>
        <h2 className={s.detailName}>{venue.name}</h2>
        <span className={s.detailSub}>{venue.room ? kitchenName(venue.room) : 'No kitchen'}</span>
      </header>
      <Tabs
        variant="underline"
        aria-label={`${venue.name} settings`}
        value={tab}
        onChange={onTab}
        className={s.tabs}
        options={[
          { id: 'menu', label: 'Menu', count: count('menu'), countTone: 'danger' },
          { id: 'devices', label: 'Printers & terminals', count: count('devices') },
          { id: 'kitchen', label: 'Kitchen screens' },
          { id: 'details', label: 'Name & kitchen' },
        ]}
      />
      <div className={s.tabBody}>
        {tab === 'menu' && <VenueMenu settings={settings} venue={venue} goto={goto} />}
        {tab === 'devices' && <VenueDevices settings={settings} venue={venue} />}
        {tab === 'kitchen' &&
          (kitchen ? (
            <BoSection>
              <KdsScreensEditor settings={settings} room={kitchen.room} ownerName={kitchen.owner.id !== venue.id ? kitchen.owner.name : null} />
            </BoSection>
          ) : (
            <BoSection title="Kitchen screens">
              <p className={s.quiet}>
                {venue.name} has no kitchen, so there are no cook screens to set.{' '}
                <button className={s.link} onClick={() => onTab('details')}>
                  Choose its kitchen
                </button>
                .
              </p>
            </BoSection>
          ))}
        {tab === 'details' && <VenueDetails settings={settings} venue={venue} onRetired={onRetired} />}
      </div>
    </>
  );
}
