import { useMemo, useState } from 'react';
import { ChevronLeft, SearchX } from 'lucide-react';
import type { BoPageProps } from '../nav';
import { BoPage, BoTabbedPage, useBilling, useResidentRecords } from '../kit';
import { getResident, residents } from '../../../data';
import { navigate, useRoute } from '../../../shell/router';
import { useHubTab } from './pageTab';
import TriviaPage from './trivia';
import { Button, EmptyState } from '../../../ui';
import { HospiceCard } from './residents/HospiceCard';
import { ProfileFilters } from './residents/ProfileFilters';
import { ResidentTable } from './residents/ResidentTable';
import {
  ALL,
  NO_FILTER,
  filterProfiles,
  planBucket,
  profileFacets,
  profileRows,
  type ProfileFilter,
  type ProfileRow,
} from './residents/residentFilters';
import { ResidentProfile } from '../../server/features/residents/ResidentProfile';
import { storyPick } from '../../server/features/residents/storyPick';
import { safeStorage } from '../../../lib/storage';
import s from './resProfiles.module.css';

/** The filters (not the search) are remembered on this device. */
const FILTER_KEY = 'kisco_bo_resident_filters_v1';

/** The saved filters, less any plan or tag nobody has any more. */
function savedFilter(rows: ProfileRow[]): ProfileFilter {
  const saved = safeStorage.getJSON<Partial<ProfileFilter>>(FILTER_KEY);
  if (!saved || typeof saved !== 'object') return NO_FILTER;
  const tagKeys = new Set(rows.flatMap((x) => x.tags.map((t) => `${t.cat}|${t.text}`)));
  return {
    query: '',
    level: rows.some((x) => x.r.level === saved.level) ? String(saved.level) : ALL,
    tags: (Array.isArray(saved.tags) ? saved.tags : []).filter(
      (k): k is string => typeof k === 'string' && (tagKeys.has(k) || /^(any\||none$)/.test(k)),
    ),
    plan: rows.some((x) => x.plan.id === saved.plan) ? String(saved.plan) : ALL,
  };
}

function saveFilter({ level, tags, plan }: ProfileFilter) {
  safeStorage.setJSON(FILTER_KEY, { level, tags, plan });
}

/**
 * Resident Dining Profiles: everyone with their meal plan, hospice switch and
 * allergies and diets, filtered by care level, diet or allergy and meal
 * plan, and each profile exactly as servers see it on the tablet. A
 * resident opens at #/backoffice/resProfiles/<id>, so the browser's back
 * button returns to the list and a profile can be linked to.
 */
function ResidentProfiles({ goto }: BoPageProps) {
  const route = useRoute();
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

  return <ResidentList goto={goto} editStory={editStory} open={open} />;
}

function ResidentList({
  goto,
  editStory,
  open,
}: {
  goto: (page: string) => void;
  editStory: (id: string | null) => void;
  open: (id: string) => void;
}) {
  const records = useResidentRecords();
  const { plans } = useBilling();
  const rows = useMemo(
    () => profileRows(residents, (r) => planBucket(records.find((x) => x.id === r.id && x.name === r.name)?.planId, plans)),
    [records, plans],
  );
  const [filter, setFilterState] = useState(() => savedFilter(rows));
  const setFilter = (f: ProfileFilter) => {
    setFilterState(f);
    saveFilter(f);
  };
  const shown = filterProfiles(rows, filter);
  return (
    <BoPage
      title="Resident Dining Profiles"
      actions={
        <>
          <Button variant="ghost" onClick={() => goto('residents')}>
            Meal plans & kitchen notes
          </Button>
          <Button onClick={() => editStory(null)}>Edit stories</Button>
        </>
      }
    >
      <ProfileFilters filter={filter} onChange={setFilter} facets={profileFacets(rows, filter)} shown={shown.length} total={rows.length} />
      {shown.length ? (
        <ResidentTable list={shown.map((x) => x.r)} onOpen={open} />
      ) : (
        <EmptyState
          icon={<SearchX size={28} />}
          title="No resident matches these filters"
          action={
            <Button variant="ghost" onClick={() => setFilter(NO_FILTER)}>
              Clear filters
            </Button>
          }
        />
      )}
    </BoPage>
  );
}

const HUB_TABS = ['profiles', 'trivia'] as const;

/**
 * Resident Dining Profiles: everyone as servers see them, with their
 * allergies and diets, and the trivia scoreboard. An open profile shows on
 * its own, without the tabs. The old Allergies & diets tab
 * (#/backoffice/resProfiles/diets) is now the list's filters, and its
 * address opens the list.
 */
export default function Page(props: BoPageProps) {
  const route = useRoute();
  const [tab, go] = useHubTab('resProfiles', HUB_TABS);
  if (route.path[0] === 'resProfiles' && getResident(route.path[1])) return <ResidentProfiles {...props} />;
  return (
    <BoTabbedPage
      page="resProfiles"
      title="Resident Dining Profiles"
      current={tab}
      onTab={go}
      tabs={[
        { id: 'profiles', label: 'Profiles', render: () => <ResidentProfiles {...props} /> },
        { id: 'trivia', label: 'Trivia scoreboard', render: () => <TriviaPage {...props} /> },
      ]}
    />
  );
}
