import { useState } from 'react';
import { rooms } from '../../../data';
import { useConfig } from '../../../store/config';
import { Tabs } from '../../../ui';
import { resetRouting, routingEdited, RoutingEditor } from '../../kitchen/admin/RoutingEditor';
import { BoPage } from '../kit';
import type { BoPageProps } from '../nav';
import { ConfirmReset } from './ConfirmReset';

/** Kitchen Routing: what skips the cook line in each venue. */
export default function Page(_props: BoPageProps) {
  const cfg = useConfig();
  const keys = Object.keys(rooms);
  const [room, setRoom] = useState(keys[0]);
  return (
    <BoPage
      title="Kitchen Routing"
      sub="What skips the cook line in each kitchen. Pick a kitchen, then change an item's button."
      actions={
        routingEdited(cfg) && (
          <ConfirmReset
            label="Reset to recipe defaults"
            onReset={resetRouting}
            title="Put routing back to each recipe's default, in every kitchen?"
            message="Every change on this page goes back, in every kitchen, and default sides show on the cook line again. Entree groups stay as they are."
            done="Routing is back to each recipe's default"
          />
        )
      }
    >
      <Tabs aria-label="Kitchen" value={room} onChange={setRoom} options={keys.map((k) => ({ id: k, label: rooms[k].name }))} />
      <RoutingEditor key={room} room={room} />
    </BoPage>
  );
}
