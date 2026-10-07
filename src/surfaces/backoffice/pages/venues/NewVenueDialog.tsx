import { Plus } from 'lucide-react';
import { useState } from 'react';
import { rooms } from '../../../../data';
import { uid } from '../../../../lib/id';
import { addVenue } from '../../../../store/venueSettings';
import { Button, Modal, TextField, toast } from '../../../../ui';
import { BoField, BoSelect } from '../../kit';
import { kitchenName } from './VenueDetails';
import s from './venues.module.css';

/** Add a venue: a name and its kitchen. The menu comes next, on its Menu tab. */
export function NewVenueDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [room, setRoom] = useState(Object.keys(rooms)[0] ?? '');
  const create = () => {
    const id = uid('v');
    addVenue({ id, name: name.trim(), room: room || null, menuId: null, menuStartDt: null, active: true, upcoming: [] });
    toast(`${name.trim()} added. Now choose its menu.`);
    onCreated(id);
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="New venue"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Plus size={16} />} disabled={!name.trim()} onClick={create}>
            Add venue
          </Button>
        </>
      }
    >
      <div className={s.form}>
        <TextField label="Venue name" placeholder="Garden Room, Pub, Catering ..." value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && name.trim() && create()} />
        <BoField label="Kitchen" hint="Where its orders are cooked.">
          {(id) => (
            <BoSelect id={id} value={room} onChange={(e) => setRoom(e.target.value)}>
              {Object.keys(rooms).map((r) => (
                <option key={r} value={r}>
                  {kitchenName(r)}
                </option>
              ))}
              <option value="">No kitchen (catering, events)</option>
            </BoSelect>
          )}
        </BoField>
      </div>
    </Modal>
  );
}
