import { Plus } from 'lucide-react';
import { COMMUNITY_NAME } from '../../../data';
import { formatTime } from '../../../lib/format';
import { Button, Chip, cx, toast } from '../../../ui';
import { BoSection } from '../../backoffice/kit';
import type { VenueSettings } from '../venueSettings';
import s from './PaymentsCard.module.css';

/** Payments · Square Terminal: the card terminals and whether each is online. */
export function PaymentsCard({ settings }: { settings: VenueSettings }) {
  return (
    <BoSection
      title={
        <span className={s.title}>
          Payments · Square Terminal
          <Chip tone="success">Connected · {COMMUNITY_NAME} (Square location)</Chip>
        </span>
      }
      sub="Guests who pay by card tap on the terminal. KiscoConnect keeps the check; Square only ever sees the amount and our order number. No card data touches our systems."
      actions={
        <Button size="sm" icon={<Plus size={14} />} onClick={() => toast('Pairing code shown on the terminal: enter it here to link the device')}>
          Pair a terminal
        </Button>
      }
    >
      <ul className={s.list}>
        {settings.terminals.map((t) => (
          <li key={t.id} className={s.row}>
            <span className={cx(s.dot, t.online && s.dotOn)} aria-hidden="true" />
            <span className={s.name}>{t.name}</span>
            <span className={s.venue}>{settings.venues.find((v) => v.id === t.venueId)?.name}</span>
            <span className={cx(s.status, t.online && s.online)}>
              {t.online ? 'online' : 'offline' + (t.lastSeen ? ' · last seen ' + formatTime(t.lastSeen) : '')}
            </span>
          </li>
        ))}
      </ul>
    </BoSection>
  );
}
