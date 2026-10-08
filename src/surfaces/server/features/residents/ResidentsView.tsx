import { Fragment, useMemo, useState } from 'react';
import { SearchX, Utensils, X } from 'lucide-react';
import { residents } from '../../../../data';
import { cx, EmptyState, SearchField } from '../../../../ui';
import { tagLabel } from '../../../backoffice/pages/residents/dietTags';
import { ResidentsGameBanner } from './game/ResidentsGameBanner';
import { ResidentCard } from './ResidentCard';
import { ResidentProfileSheet } from './ResidentProfileSheet';
import { searchResidents } from './residentInfo';
import {
  ANY_ALLERGY,
  dietIndex,
  dietSummary,
  isFiltering,
  matchesDiet,
  NO_DIET_FILTER,
  toggleDietKey,
  toggleSpecial,
  type DietFilter,
  type DietSummary,
} from './dietFilter';
import s from './ResidentsView.module.css';

/** Residents page: search, special diets at a glance, profiles, and the "Do you know the Residents?" game. */
export function ResidentsView() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [diet, setDiet] = useState<DietFilter>(NO_DIET_FILTER);
  const index = useMemo(() => dietIndex(residents), []);
  const summary = useMemo(() => dietSummary(index), [index]);
  const shown = searchResidents(residents, query).filter((r) => matchesDiet(index.get(r.id), diet));
  const filtering = isFiltering(diet);
  return (
    <div className={s.page}>
      <ResidentsGameBanner />
      <SearchField large value={query} onChange={setQuery} placeholder="Search name or apartment" className={s.search} />
      <DietBar summary={summary} filter={diet} onChange={setDiet} shown={shown.length} />
      <div className={s.scroll}>
        {shown.length ? (
          <div className={s.grid}>
            {shown.map((r) => (
              <ResidentCard key={r.id} resident={r} onOpen={() => setOpen(r.id)} />
            ))}
          </div>
        ) : filtering ? (
          <EmptyState icon={<SearchX size={28} />} title="No resident matches that">
            Nobody {query ? 'with that name or apartment ' : ''}has the diets picked. Tap Clear to see everyone.
          </EmptyState>
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

/**
 * Special diets at a glance: how many residents carry each allergy, diet and
 * texture, which doubles as the filter. "Special diets" shows everyone with
 * any of them; a tag shows the residents carrying it (several tags, any of them).
 */
function DietBar({ summary, filter, onChange, shown }: { summary: DietSummary; filter: DietFilter; onChange: (f: DietFilter) => void; shown: number }) {
  if (summary.special === 0) return null;
  const on = (key: string) => filter.keys.includes(key);
  const filtering = isFiltering(filter);
  return (
    <div className={cx(s.diets, 'scroll-hidden')} role="group" aria-label="Special diets">
      <button className={cx(s.diet, s.special, filter.special && s.on)} aria-pressed={filter.special} onClick={() => onChange(toggleSpecial(filter))}>
        <Utensils size={15} strokeWidth={2.25} aria-hidden />
        Special diets <span className={s.n}>{summary.special}</span>
      </button>
      {summary.allergies > 0 && (
        <button
          className={cx(s.diet, s.allergy, on(ANY_ALLERGY) && s.on)}
          aria-pressed={on(ANY_ALLERGY)}
          title="Residents with any allergy"
          onClick={() => onChange(toggleDietKey(filter, ANY_ALLERGY))}
        >
          Any allergy <span className={s.n}>{summary.allergies}</span>
        </button>
      )}
      {summary.tags.map((t, i) => (
        <Fragment key={t.key}>
          {/* A hairline where allergies give way to diets, and diets to textures. */}
          {i > 0 && summary.tags[i - 1].cat !== t.cat && <span className={s.sep} aria-hidden />}
          <button
            className={cx(s.diet, t.cat === 'allergy' ? s.allergy : s.plain, on(t.key) && s.on)}
            aria-pressed={on(t.key)}
            title={tagLabel(t.text) !== t.text ? `On the ticket: ${t.text}` : undefined}
            onClick={() => onChange(toggleDietKey(filter, t.key))}
          >
            {tagLabel(t.text)} <span className={s.n}>{t.n}</span>
          </button>
        </Fragment>
      ))}
      {filtering && (
        <button className={cx(s.diet, s.clear)} onClick={() => onChange(NO_DIET_FILTER)} aria-label={`Clear the diet filter, showing ${shown}`}>
          <X size={15} strokeWidth={2.5} aria-hidden />
          Clear · {shown} shown
        </button>
      )}
    </div>
  );
}
