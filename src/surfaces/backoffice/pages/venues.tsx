import { Plus } from 'lucide-react';
import { uid } from '../../../lib/id';
import { Button, toast } from '../../../ui';
import { PaymentsCard } from '../../kitchen/admin/PaymentsCard';
import { ServingNow } from '../../kitchen/admin/ServingNow';
import { VenueCard } from '../../kitchen/admin/VenueCard';
import { addVenue, useVenueSettings } from '../../kitchen/venueSettings';
import { BoPage } from '../kit';
import type { BoPageProps } from '../nav';

/** Venue Settings: menus, printers, KDS screens and payment terminals per venue. */
export default function Page(_props: BoPageProps) {
  const settings = useVenueSettings();
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
