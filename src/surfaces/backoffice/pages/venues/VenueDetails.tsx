import { Archive } from 'lucide-react';
import { useState } from 'react';
import { rooms } from '../../../../data';
import { patchVenue, type Venue, type VenueAdminView } from '../../../../store/venueSettings';
import { Button, TextField, toast, useConfirm } from '../../../../ui';
import { BoField, BoSection, BoSelect } from '../../kit';
import { venueNameProblem } from './venueName';
import s from './venues.module.css';

/** "Sequoia / Evergreen kitchen", or who else cooks there. */
export function kitchenName(room: string): string {
  return `${rooms[room]?.name ?? room} kitchen`;
}

/** A venue's name, the kitchen it cooks in, and retiring it. */
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
      <BoSection title="Name and kitchen">
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
      </BoSection>
      <BoSection title="Retire this venue" sub="For a dining room that has closed. Nothing is deleted.">
        <div className={s.retireRow}>
          <Button variant="softDanger" icon={<Archive size={15} />} onClick={retire}>
            Retire {venue.name}
          </Button>
        </div>
      </BoSection>
      {confirmDialog}
    </>
  );
}
