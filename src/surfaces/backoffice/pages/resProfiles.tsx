import { useState } from 'react';
import { ChevronLeft, SearchX } from 'lucide-react';
import type { BoPageProps } from '../nav';
import { BoPage, BoTabbedPage } from '../kit';
import { getResident, residents } from '../../../data';
import { isOnHospice } from '../../../domain/waivers';
import type { Resident } from '../../../domain/types';
import { navigate, useRoute } from '../../../shell/router';
import { useHubTab } from './pageTab';
import AllergiesDietsPage from './resDiets';
import TriviaPage from './trivia';
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
function ResidentProfiles({ goto }: BoPageProps) {
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

const HUB_TABS = ['profiles', 'diets', 'trivia'] as const;

/**
 * Residents: everyone as servers see them, their allergies and diets, and
 * the trivia scoreboard. An open profile shows on its own, without the tabs.
 */
export default function Page(props: BoPageProps) {
  const route = useRoute();
  const [tab, go] = useHubTab('resProfiles', HUB_TABS);
  if (route.path[0] === 'resProfiles' && getResident(route.path[1])) return <ResidentProfiles {...props} />;
  return (
    <BoTabbedPage
      page="resProfiles"
      title="Residents"
      current={tab}
      onTab={go}
      tabs={[
        { id: 'profiles', label: 'Profiles', render: () => <ResidentProfiles {...props} /> },
        { id: 'diets', label: 'Allergies & diets', render: () => <AllergiesDietsPage {...props} /> },
        { id: 'trivia', label: 'Trivia scoreboard', render: () => <TriviaPage {...props} /> },
      ]}
    />
  );
}
