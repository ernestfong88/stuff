import { useState } from 'react';
import { ChevronLeft, SearchX } from 'lucide-react';
import type { BoPageProps } from '../nav';
import { BoPage, BoRow, BoSection } from '../kit';
import { getResident, residents } from '../../../data';
import { flag } from '../../../domain/config';
import { hospiceStatus, isOnHospice } from '../../../domain/waivers';
import type { Resident } from '../../../domain/types';
import { formatDayShort } from '../../../lib/format';
import { useMe } from '../../../shell/session';
import { setHospice, useConfig } from '../../../store/config';
import { Button, Chip, EmptyState, SearchField, TextArea, Toggle, toast } from '../../../ui';
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

/** Hospice on the resident record: delivery fees waived automatically while it is on. */
function HospiceSection({ resident }: { resident: Resident }) {
  const cfg = useConfig();
  const me = useMe();
  const h = hospiceStatus(resident.id, cfg) ?? { on: false, since: '', note: '', log: [] };
  const first = resident.name.split(' ')[0];
  const set = (patch: Parameters<typeof setHospice>[1], msg?: string) => {
    setHospice(resident.id, patch, me.name);
    if (msg) toast(msg);
  };
  return (
    <BoSection
      title="Hospice"
      sub={`While ${first} is on hospice, delivery fees are waived automatically with no manager PIN. It doesn't use a sick waiver. Staff can switch it off for a single order.`}
      actions={h.on ? <HospiceTag resident={resident} /> : undefined}
    >
      <BoRow label="On hospice" hint={h.on ? `Since ${h.since ? formatDayShort(new Date(h.since + 'T12:00:00')) : 'today'}` : 'Off: delivery fees apply as usual'}>
        <Toggle
          checked={h.on}
          onChange={(on) => set({ on }, on ? `${first} is on hospice. Delivery fees are waived from now on` : `${first} is no longer on hospice`)}
        />
      </BoRow>
      {h.on && (
        <>
          <BoRow label="Start date">
            <input type="date" className={s.date} aria-label="Hospice start date" value={h.since} onChange={(e) => set({ since: e.target.value })} />
          </BoRow>
          <div className={s.note}>
            <TextArea
              label="Note (optional)"
              hint={`Staff see this on ${first}'s deliveries`}
              rows={2}
              value={h.note}
              onChange={(e) => set({ note: e.target.value })}
            />
          </div>
        </>
      )}
      {!flag(cfg, 'freeDeliveryComp') && (
        <p className={s.warn}>The automatic hospice fee waiver is off in Settings, so a manager comps the fee with their PIN.</p>
      )}
      {h.log.length > 0 && (
        <div className={s.log}>
          {h.log.slice(0, 4).map((e, i) => (
            <div key={i}>
              {e.on ? 'Turned on' : 'Turned off'} by {e.by} · {formatDayShort(e.at)}
            </div>
          ))}
        </div>
      )}
    </BoSection>
  );
}

/** Resident Profiles: the resident list and profiles exactly as servers see them on the tablet. */
export default function Page({ goto }: BoPageProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const resident = getResident(selected);
  const editStory = (id: string | null) => {
    storyPick.set(id);
    goto('svcRes');
  };
  const actions = (
    <>
      <Button variant="ghost" onClick={() => goto('resDiets')}>
        Allergies & diets
      </Button>
      <Button onClick={() => editStory(resident?.id ?? null)}>{resident ? 'Edit story & notes' : 'Edit stories & notes'}</Button>
    </>
  );

  if (resident) {
    return (
      <BoPage title="Resident Profiles" sub={`What a server sees when they open ${resident.name.split(' ')[0]} on the tablet.`} actions={actions}>
        <div>
          <Button variant="ghost" icon={<ChevronLeft size={16} />} onClick={() => setSelected(null)}>
            All residents
          </Button>
        </div>
        <div className={s.hospice}>
          <HospiceSection resident={resident} />
        </div>
        <div className={s.preview}>
          <ResidentProfile key={resident.id} resident={resident} />
        </div>
      </BoPage>
    );
  }

  const shown = searchResidents(residents, query);
  return (
    <BoPage title="Resident Profiles" sub="The resident list and profiles exactly as servers see them on the tablet." actions={actions}>
      <SearchField value={query} onChange={setQuery} placeholder="Search name or apartment" className={s.search} />
      {shown.length ? (
        <div className={s.grid}>
          {shown.map((r) => (
            <ResidentCard key={r.id} resident={r} onOpen={() => setSelected(r.id)} tag={<HospiceTag resident={r} />} />
          ))}
        </div>
      ) : (
        <EmptyState icon={<SearchX size={28} />} title="No resident matches that" />
      )}
    </BoPage>
  );
}
