import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { rooms } from '../../../data';
import { useConfig } from '../../../store/config';
import { Button, Tabs, toast } from '../../../ui';
import { resetRouting, routingEdited, RoutingEditor } from '../../kitchen/admin/RoutingEditor';
import { BoPage } from '../kit';
import type { BoPageProps } from '../nav';

/** Kitchen Routing: what skips the cook line in each venue. */
export default function Page(_props: BoPageProps) {
  const cfg = useConfig();
  const keys = Object.keys(rooms);
  const [room, setRoom] = useState(keys[0]);
  return (
    <BoPage
      title="Kitchen Routing"
      sub="What skips the cook line in each venue. Everything else goes to the cook. Drinks go to the server or the bar."
      actions={
        routingEdited(cfg) && (
          <Button
            variant="ghost"
            icon={<RotateCcw size={15} />}
            onClick={() => {
              resetRouting();
              toast("Routing is back to each recipe's default");
            }}
          >
            Reset to recipe defaults
          </Button>
        )
      }
    >
      <Tabs aria-label="Kitchen" value={room} onChange={setRoom} options={keys.map((k) => ({ id: k, label: rooms[k].name }))} />
      <RoutingEditor key={room} room={room} />
    </BoPage>
  );
}
