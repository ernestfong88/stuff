import { useState } from 'react';
import { safeStorage } from '../../lib/storage';
import { PRODUCTION_VENUES } from '../../store/production';

/** Each prep tablet remembers which venue's kitchen it serves. */
const KEY = 'kisco_prep_venue';

function load(): string {
  const saved = safeStorage.get(KEY);
  return PRODUCTION_VENUES.some((v) => v.id === saved) && saved ? saved : PRODUCTION_VENUES[0].id;
}

export function usePrepVenue(): [string, (id: string) => void] {
  const [venueId, setVenueId] = useState(load);
  const set = (id: string) => {
    setVenueId(id);
    safeStorage.set(KEY, id);
  };
  return [venueId, set];
}
