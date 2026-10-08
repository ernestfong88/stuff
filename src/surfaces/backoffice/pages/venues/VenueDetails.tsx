import { Archive } from 'lucide-react';
import { useState } from 'react';
import { rooms } from '../../../../data';
import { patchVenue, type Venue, type VenueAdminView } from '../../../../store/venueSettings';
import { Button, Chip, TextField, toast, useConfirm } from '../../../../ui';
import { BoField, BoRow, BoSection, BoSelect } from '../../kit';
import { kitchenName } from './summary';
import { venueNameProblem } from './venueName';
import s from './venues.module.css';

/** A venue's name, the kitchen it cooks in, and whether it is open (retiring it). */
export function VenueDetails({ settings, venue, onRetired }: { settings: VenueAdminView; venue: Venue; onRetired: () => void }) {
  const [ask, confirmDialog] = useConfirm();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const nameProblem = nameDraft == null ? null : venueNameProblem(nameDraft, settings.venues, venue.id);
  const sharing = venue.room ? settings.venues.filter((v) => v.active && v.id !== venue.id && v.room === venue.room) : [];

  const retire = async () => {
    const ok = await ask({
      title: `Retire ${venue.name}?`,
      message: 'It leaves the floor and the kitchen screens. Its layouts, prices and order history are kept, and you can bring it back any time.',
      confirmLabel: 'Retire venue',
      tone: 'danger',
    });
    if (!ok) return;
    patchVenue(venue.id, { active: false });
    toast(`${venue.name} retired`);
    onRetired();
  };

  return (
    <>
      <BoSection title="Details" sub="Its name, the kitchen that cooks its orders, and whether it is open.">
        <div className={s.form}>
          <TextField
            label="Venue name"
            hint="What servers, residents and the menus call it."
            value={nameDraft ?? venue.name}
            error={nameProblem}
            onChange={(e) => {
              const v = e.target.value;
              setNameDraft(v);
              // Saves as you type while the name is fine; a blank or taken name isn't saved.
              if (!venueNameProblem(v, settings.venues, venue.id)) patchVenue(venue.id, { name: v.trim() });
            }}
            onBlur={() => setNameDraft(null)}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
          <BoField
            label="Kitchen"
            hint={
              venue.room
                ? sharing.length
                  ? `Shares this kitchen with ${sharing.map((v) => v.name).join(', ')}.`
                  : 'Orders from this venue go to this kitchen’s screens.'
                : 'No kitchen: orders here print only, with no cook screen. Fine for catering and events.'
            }
          >
            {(id) => (
              <BoSelect id={id} value={venue.room ?? ''} onChange={(e) => patchVenue(venue.id, { room: e.target.value || null })}>
                {Object.keys(rooms).map((r) => (
                  <option key={r} value={r}>
                    {kitchenName(r)}
                  </option>
                ))}
                <option value="">No kitchen</option>
              </BoSelect>
            )}
          </BoField>
        </div>
        <BoRow label="Status" hint="Retire a venue that has closed. Its prices, layouts and order history are kept, and you can bring it back.">
          <div className={s.statusControl}>
            <Chip tone="success">Open</Chip>
            <Button size="sm" variant="softDanger" icon={<Archive size={14} />} aria-label={`Retire ${venue.name}`} onClick={retire}>
              Retire
            </Button>
          </div>
        </BoRow>
      </BoSection>
      {confirmDialog}
    </>
  );
}
