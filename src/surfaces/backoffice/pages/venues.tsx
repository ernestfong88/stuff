import { useEffect, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { uid } from '../../../lib/id';
import { Button, toast } from '../../../ui';
import { PaymentsCard } from '../../kitchen/admin/PaymentsCard';
import { ServingNow } from '../../kitchen/admin/ServingNow';
import { VenueCard } from '../../kitchen/admin/VenueCard';
import { addVenue, useVenueSettings, venueSettingsStore, type VenueAdminView } from '../../../store/venueSettings';
import { cycleLenOf, refreshLiveMenu, useBo } from '../menus/data';
import { BoPage } from '../kit';
import type { BoPageProps } from '../nav';

/** Venue Settings: menus, printers, KDS screens and payment terminals per venue. */
export default function Page(_props: BoPageProps) {
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
  return (
    <BoPage
      title="Venue Settings"
      sub="Each venue binds to one menu and a cycle start date"
      actions={
        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={() => {
            addVenue({ id: uid('v'), name: 'New Venue', room: null, menuId: null, menuStartDt: null, active: true, upcoming: [] });
            toast('Venue created. Assign a menu so it serves something.');
          }}
        >
          New venue
        </Button>
      }
    >
      <ServingNow settings={settings} />
      <PaymentsCard settings={settings} />
      {settings.venues
        .filter((v) => v.active)
        .map((v) => (
          <VenueCard key={v.id} settings={settings} venue={v} />
        ))}
    </BoPage>
  );
}
