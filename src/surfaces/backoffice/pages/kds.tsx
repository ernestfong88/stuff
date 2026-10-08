/**
 * KDS Settings: each kitchen's cook screens and whether it runs an expo
 * station. Kept apart from Venue Settings because kitchens start on printed
 * tickets and move to screens later (Phase 2).
 */
import { useState } from 'react';
import { rooms } from '../../../data';
import { printerMode } from '../../../domain/config';
import { useConfig } from '../../../store/config';
import { useVenueSettings } from '../../../store/venueSettings';
import { Tabs } from '../../../ui';
import { KdsScreensEditor } from '../../kitchen/admin/KdsScreensEditor';
import { BoCallout, BoPage, BoSection } from '../kit';
import type { BoPageProps } from '../nav';
import { KitchenModeSetting } from './KitchenModeSetting';

export default function Page(_props: BoPageProps) {
  const settings = useVenueSettings();
  const printers = printerMode(useConfig());
  const keys = Object.keys(rooms);
  const [room, setRoom] = useState(keys[0]);
  const venues = settings.venues.filter((v) => v.active && v.room === room).map((v) => v.name);
  return (
    <BoPage title="KDS Settings">
      <KitchenModeSetting />
      <Tabs aria-label="Kitchen" value={room} onChange={setRoom} options={keys.map((k) => ({ id: k, label: `${rooms[k].name} kitchen` }))} />
      <BoSection title={`${rooms[room].name} kitchen`} sub={venues.length ? `Cooks for ${venues.join(' and ')}.` : 'No venue cooks here yet.'}>
        {printers && (
          <BoCallout tone="info" title="Not used with printers">
            Kept for when you switch to kitchen screens.
          </BoCallout>
        )}
        <KdsScreensEditor key={room} settings={settings} room={room} ownerName={null} />
      </BoSection>
    </BoPage>
  );
}
