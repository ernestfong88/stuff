import { useState } from 'react';
import { ChevronLeft, SearchX } from 'lucide-react';
import type { BoPageProps } from '../nav';
import { BoPage } from '../kit';
import { getResident, residents } from '../../../data';
import { isOnHospice } from '../../../domain/waivers';
import type { Resident } from '../../../domain/types';
import { navigate, useRoute } from '../../../shell/router';
import { useConfig } from '../../../store/config';
import { Button, Chip, EmptyState, SearchField } from '../../../ui';
import { HospiceCard } from './residents/HospiceCard';
import { ResidentCard } from '../../server/features/residents/ResidentCard';
import { ResidentProfile } from '../../server/features/residents/ResidentProfile';
import { searchResidents } from '../../server/features/residents/residentInfo';
import { storyPick } from '../../server/features/residents/storyPick';
import s from './resProfiles.module.css';

function HospiceTag({ resident }: { resident: Resident }) {
  const cfg = useConfig();
  return isOnHospice(resident.id, cfg) ? (
    <Chip tone="plum" size="xs">
      ON HOSPICE
    </Chip>
  ) : null;
}

/** Resident Profiles: the resident list and profiles exactly as servers see them on the tablet. */
/**
 * A resident opens at #/backoffice/resProfiles/<id>, so the browser's back
 * button returns to the list and a profile can be linked to.
 */
export default function Page({ goto }: BoPageProps) {
  const route = useRoute();
  const [query, setQuery] = useState('');
  const resident = route.path[0] === 'resProfiles' ? getResident(route.path[1]) : undefined;
  const open = (id: string | null) => navigate('backoffice', id ? ['resProfiles', id] : ['resProfiles']);
  const editStory = (id: string | null) => {
    storyPick.set(id);
    goto('svcRes');
  };

  if (resident) {
    const first = resident.name.split(' ')[0];
    return (
      <BoPage
        title={resident.name}
        sub={`What a server sees when they open ${first} on the tablet.`}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate('backoffice', ['residents', resident.id])}>
              Meal plan & kitchen notes
            </Button>
            <Button onClick={() => editStory(resident.id)}>Edit {first}&apos;s story</Button>
          </>
        }
      >
        <div>
          <Button variant="ghost" icon={<ChevronLeft size={16} />} onClick={() => open(null)}>
            All residents
          </Button>
        </div>
        <div className={s.hospice}>
          <HospiceCard rid={resident.id} name={resident.name} />
        </div>
        <div className={s.preview}>
          <ResidentProfile key={resident.id} resident={resident} />
        </div>
      </BoPage>
    );
  }

  const shown = searchResidents(residents, query);
  return (
    <BoPage
      title="Resident Profiles"
      sub="Residents as servers see them on the tablet. Open one to see the profile, mark them on hospice, or go to their meal plan or story."
      actions={
        <>
          <Button variant="ghost" onClick={() => goto('resDiets')}>
            Allergies & diets
          </Button>
          <Button variant="ghost" onClick={() => goto('residents')}>
            Meal plans & kitchen notes
          </Button>
          <Button onClick={() => editStory(null)}>Edit stories</Button>
        </>
      }
    >
      <SearchField value={query} onChange={setQuery} placeholder="Search name or apartment" className={s.search} />
      {shown.length ? (
        <div className={s.grid}>
          {shown.map((r) => (
            <ResidentCard key={r.id} resident={r} onOpen={() => open(r.id)} tag={<HospiceTag resident={r} />} />
          ))}
        </div>
      ) : (
        <EmptyState icon={<SearchX size={28} />} title="No resident matches that" />
      )}
    </BoPage>
  );
}
