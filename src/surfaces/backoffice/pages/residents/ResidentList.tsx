import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { isOnHospice } from '../../../../domain/waivers';
import { useConfig } from '../../../../store/config';
import { Avatar, Chip, EmptyState, SearchField } from '../../../../ui';
import { BoPage, useBilling, useResidentRecords } from '../../kit';
import { diningResident, type BoResident } from '../../seed/residents';
import s from './residents.module.css';

/** Residents whose name or apartment matches. */
export function searchResidents(list: BoResident[], query: string): BoResident[] {
  const q = query.trim().toLowerCase();
  return q ? list.filter((r) => r.name.toLowerCase().includes(q) || r.apt.toLowerCase().includes(q)) : list;
}

export function ResidentList({ onOpen }: { onOpen: (id: string) => void }) {
  const records = useResidentRecords();
  const { plans } = useBilling();
  const cfg = useConfig();
  const [query, setQuery] = useState('');
  const shown = searchResidents(records, query);
  return (
    <BoPage title="Dining Plans & Notes" sub="Each resident's meal plan, dining preferences and notes for the kitchen. Open a resident to change them.">
      <SearchField value={query} onChange={setQuery} placeholder="Search name or apartment" aria-label="Search residents" className={s.search} />
      {shown.length === 0 ? (
        <EmptyState title="No resident matches">Try part of the name or the apartment number.</EmptyState>
      ) : (
        <ul className={s.list}>
          {shown.map((r) => {
            const plan = plans.find((p) => p.id === r.planId);
            const dining = diningResident(r);
            return (
              <li key={r.id}>
                <button className={s.row} onClick={() => onOpen(r.id)}>
                  <Avatar person={{ id: dining?.id, name: r.name, photo: dining?.photo }} size={34} />
                  <span className={s.rowText}>
                    <span className={s.rowName}>{r.name}</span>
                    <span className={s.rowSub}>
                      Apt {r.apt} · {dining?.level ?? r.level} · {plan?.text ?? 'No plan'}
                    </span>
                  </span>
                  {dining && isOnHospice(r.id, cfg) && (
                    <Chip tone="plum" size="xs">
                      On hospice
                    </Chip>
                  )}
                  {(dining?.allergies ?? r.allergies).map((a) => (
                    <Chip key={a} tone="danger" size="xs">
                      {a}
                    </Chip>
                  ))}
                  <ChevronRight size={16} className={s.chev} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </BoPage>
  );
}
