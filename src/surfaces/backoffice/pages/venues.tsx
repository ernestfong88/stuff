/**
 * Venue Settings opens on an overview: one card per venue saying what kind
 * of place it is, what it serves now, which kitchen it uses and anything to
 * fix. A card opens that venue: its menus and details first, then tabs for
 * prices, floor plan, kitchen routing, and printers and terminals.
 *
 * #/backoffice/venues is the overview; #/backoffice/venues/<venueId>/<tab>
 * opens a venue on a tab ("first" for the first open venue).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ChevronRight, Plus } from 'lucide-react';
import { navigate, useRoute } from '../../../shell/router';
import { today } from '../../../lib/clock';
import { Button, Chip, Tabs, cx, toast } from '../../../ui';
import { VenueDevices } from '../../kitchen/admin/VenueDevices';
import { resetRouting, routingEdited, RoutingEditor } from '../../kitchen/admin/RoutingEditor';
import { FloorPlanEditor } from '../../manager/floor/FloorPlanEditor';
import { useConfig } from '../../../store/config';
import { PricingPage } from '../menus/pricing/PricingPage';
import { ConfirmReset } from './ConfirmReset';
import { everyDayId, patchVenue, useVenueSettings, venueSettingsStore, type Venue, type VenueAdminView } from '../../../store/venueSettings';
import { cycleLenOf, refreshLiveMenu, useBo } from '../menus/data';
import { approvalOf } from '../menus/model/approval';
import { BoEmbedded, BoPage, BoSection } from '../kit';
import type { BoPageProps } from '../nav';
import { NewVenueDialog } from './venues/NewVenueDialog';
import { VenueDetails } from './venues/VenueDetails';
import { VenueMenu } from './venues/VenueMenu';
import { VenueOverview } from './venues/VenueOverview';
import { allVenueIssues, kitchenOf, venueIssues, type VenueTab } from './venues/issues';
import { kitchenLine, venueKind } from './venues/summary';
import s from './venues/venues.module.css';

const TABS: VenueTab[] = ['menu', 'prices', 'floor', 'kitchen', 'devices', 'details'];

export default function Page({ goto }: BoPageProps) {
  const stored = useVenueSettings();
  const bo = useBo();
  // The menus come from Menu Cycle & À la Carte, so a menu built there can be scheduled here.
  const settings = useMemo<VenueAdminView>(
    () => ({
      ...stored,
      menus: bo.menus.flatMap((m) => {
        const own = {
          id: m.id,
          name: m.name,
          season: m.quarter,
          quarter: m.quarter,
          kind: m.kind,
          status: m.status,
          cycleLen: cycleLenOf(bo, m.id),
          approval: approvalOf(m).step,
        };
        // A cycle's every-day items can be a venue's à la carte menu too.
        return m.kind === 'cycle' ? [own, { ...own, id: everyDayId(m.id), name: `${m.name} · Every-day items`, kind: 'alc', cycleLen: 0 }] : [own];
      }),
    }),
    [stored, bo],
  );
  // Starting a menu moves the cycle day, so the floor's specials follow.
  useEffect(() => venueSettingsStore.subscribe(refreshLiveMenu), []);

  const [adding, setAdding] = useState(false);
  const route = useRoute();
  const active = settings.venues.filter((v) => v.active);
  const asked = route.path[1];
  const venue = asked === 'first' ? active[0] : active.find((v) => v.id === asked);
  const tab: VenueTab = TABS.includes(route.path[2] as VenueTab) ? (route.path[2] as VenueTab) : 'menu';
  /** Open a venue (a new history entry, so Back returns to the overview), or switch its tab in place. */
  const open = (id: string, t: VenueTab = 'menu') => navigate('backoffice', ['venues', id, t], { replace: id === venue?.id });
  const overview = () => navigate('backoffice', ['venues']);
  // An old link (#/backoffice/pricing) arrives as venues/first/prices: show the real venue in the address.
  // A retired or unknown venue goes back to the overview.
  useEffect(() => {
    if (!asked) return;
    if (!venue) navigate('backoffice', ['venues'], { replace: true });
    else if (asked !== venue.id) navigate('backoffice', ['venues', venue.id, tab], { replace: true });
  }, [asked, venue, tab]);
  const issues = allVenueIssues(settings);
  const at = today().getTime();

  const newVenue = (
    <NewVenueDialog
      onClose={() => setAdding(false)}
      onCreated={(id) => {
        setAdding(false);
        open(id, 'menu');
      }}
    />
  );

  if (venue)
    return (
      <>
        <VenueDetail
          settings={settings}
          venue={venue}
          tab={tab}
          onTab={(t) => open(venue.id, t)}
          onBack={overview}
          goto={goto}
          onRetired={overview}
        />
        {adding && newVenue}
      </>
    );

  return (
    <BoPage
      title="Venue Settings"
      sub={
        active.length
          ? `${active.length} open venue${active.length === 1 ? '' : 's'}${issues.length ? ` · ${issues.length} thing${issues.length === 1 ? ' needs' : 's need'} attention` : ''}. Open one to change its menus, prices, floor plan, kitchen or printers.`
          : undefined
      }
      actions={
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>
          New venue
        </Button>
      }
    >
      {active.length === 0 && (
        <BoSection title="No open venues">
          <p className={s.quiet}>Add a venue to start: a dining room, bistro or catering.</p>
        </BoSection>
      )}
      <VenueOverview
        settings={settings}
        at={at}
        onOpen={open}
        onBringBack={(v) => {
          patchVenue(v.id, { active: true });
          toast(`${v.name} is back`);
        }}
      />
      {adding && newVenue}
    </BoPage>
  );
}

/** One line under the tab bar, for the tabs whose editor doesn't say what it is for. */
const TAB_LINE: Partial<Record<VenueTab, string>> = {
  floor: 'Tables and seating, as servers see them on the floor.',
};

function VenueDetail({
  settings,
  venue,
  tab,
  onTab,
  onBack,
  goto,
  onRetired,
}: {
  settings: VenueAdminView;
  venue: Venue;
  tab: VenueTab;
  onTab: (t: VenueTab) => void;
  onBack: () => void;
  goto: (pageId: string) => void;
  onRetired: () => void;
}) {
  const issues = venueIssues(settings, venue);
  const count = (t: VenueTab) => issues.filter((i) => i.tab === t).length || undefined;
  const kitchen = kitchenOf(settings, venue);
  const cfg = useConfig();
  const sharing = venue.room ? settings.venues.filter((v) => v.active && v.id !== venue.id && v.room === venue.room) : [];
  // Menus and details share the first tab; a link to Details scrolls to them.
  const shown: VenueTab = tab === 'details' ? 'menu' : tab;
  const detailsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tab === 'details') detailsRef.current?.scrollIntoView?.({ block: 'start' });
  }, [tab, venue.id]);
  return (
    <BoPage
      title={venue.name}
      sub={
        <span className={s.headSub}>
          <Chip tone="success">Open</Chip>
          <span>
            {venueKind(venue)} · {kitchenLine(venue, settings.venues)}
          </span>
        </span>
      }
      actions={
        <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={onBack}>
          All venues
        </Button>
      }
    >
      {issues.length > 0 && (
        <ul className={s.headIssues} aria-label="Needs attention">
          {issues.map((i, n) => (
            <li key={n}>
              <button className={cx(s.cardIssue, i.tone === 'danger' && s.cardIssueDanger)} onClick={() => onTab(i.tab)}>
                <AlertTriangle size={14} aria-hidden />
                <span className={s.cardIssueText}>{i.text}</span>
                <span className={s.issueFix}>
                  Fix <ChevronRight size={14} aria-hidden />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Tabs
        variant="underline"
        aria-label={`${venue.name} settings`}
        value={shown}
        onChange={onTab}
        className={s.tabs}
        options={[
          {
            id: 'menu',
            label: 'Menus & details',
            count: count('menu'),
            countTone: issues.some((i) => i.tab === 'menu' && i.tone === 'danger') ? 'danger' : undefined,
          },
          { id: 'prices', label: 'Prices' },
          { id: 'floor', label: 'Floor plan' },
          { id: 'kitchen', label: 'Kitchen routing' },
          { id: 'devices', label: 'Printers & terminals', count: count('devices') },
        ]}
      />
      <div className={s.tabBody}>
        {TAB_LINE[shown] && <p className={s.tabLine}>{TAB_LINE[shown]}</p>}
        {shown === 'menu' && (
          <>
            <VenueMenu settings={settings} venue={venue} goto={goto} />
            <div ref={detailsRef} className={s.anchor}>
              <VenueDetails settings={settings} venue={venue} onRetired={onRetired} />
            </div>
          </>
        )}
        {shown === 'devices' && <VenueDevices settings={settings} venue={venue} />}
        {shown === 'prices' && (
          <BoEmbedded>
            <PricingPage venueId={venue.id} />
          </BoEmbedded>
        )}
        {shown === 'floor' &&
          (venue.room ? (
            <>
              {sharing.length > 0 && (
                <p className={s.tabLine}>
                  {sharing.map((v) => v.name).join(' and ')} {sharing.length === 1 ? 'shares' : 'share'} this room, so a change here shows for both.
                </p>
              )}
              <FloorPlanEditor key={venue.room} room={venue.room} />
            </>
          ) : (
            <NoKitchen venue={venue} what="a floor plan" onTab={onTab} />
          ))}
        {shown === 'kitchen' &&
          (kitchen ? (
            <>
              <BoSection
                title="What goes to the kitchen"
                sub="Drinks, soups and anything else servers make themselves never go to a cook screen. Change an item's button to send it one way or the other."
                actions={
                  routingEdited(cfg) && (
                    <ConfirmReset
                      label="Reset routing"
                      onReset={resetRouting}
                      title="Put routing back to each recipe's default, in every kitchen?"
                      message="Every routing change goes back, in every kitchen, and default sides show on the cook line again. Entree groups stay as they are."
                      done="Routing is back to each recipe's default"
                    />
                  )
                }
              >
                <RoutingEditor key={kitchen.room} room={kitchen.room} />
              </BoSection>
            </>
          ) : (
            <NoKitchen venue={venue} what="kitchen routing" onTab={onTab} />
          ))}
      </div>
    </BoPage>
  );
}

function NoKitchen({ venue, what, onTab }: { venue: Venue; what: string; onTab: (t: VenueTab) => void }) {
  return (
    <BoSection>
      <p className={s.quiet}>
        {venue.name} has no dining room or kitchen of its own, so there is no {what} to set.{' '}
        <button className={s.link} onClick={() => onTab('details')}>
          Choose its kitchen
        </button>
        .
      </p>
    </BoSection>
  );
}
