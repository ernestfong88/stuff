import { useState } from 'react';
import { SearchX } from 'lucide-react';
import { residents } from '../../../../data';
import { EmptyState, SearchField } from '../../../../ui';
import { ResidentsGameBanner } from './game/ResidentsGameBanner';
import { ResidentCard } from './ResidentCard';
import { ResidentProfileSheet } from './ResidentProfileSheet';
import { searchResidents } from './residentInfo';
import s from './ResidentsView.module.css';

/** Residents page: search, profiles, and the "Do you know the Residents?" game. */
export function ResidentsView() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const shown = searchResidents(residents, query);
  return (
    <div className={s.page}>
      <ResidentsGameBanner />
      <SearchField large value={query} onChange={setQuery} placeholder="Search name or apartment" className={s.search} />
      <div className={s.scroll}>
        {shown.length ? (
          <div className={s.grid}>
            {shown.map((r) => (
              <ResidentCard key={r.id} resident={r} onOpen={() => setOpen(r.id)} />
            ))}
          </div>
        ) : (
          <EmptyState icon={<SearchX size={28} />} title="No resident matches that">
            Try part of their first or last name, or their apartment number.
          </EmptyState>
        )}
      </div>
      <ResidentProfileSheet residentId={open} onClose={() => setOpen(null)} />
    </div>
  );
}
