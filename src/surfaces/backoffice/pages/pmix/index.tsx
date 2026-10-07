import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Tabs, cx } from '../../../../ui';
import { BoIconButton, BoPage, BoSelect } from '../../kit';
import type { BoPageProps } from '../../nav';
import { PMIX_DAYS, PMIX_OLDEST, PMIX_PROTEINS, PMIX_RECIPES, PMIX_SIDES, PMIX_VENUES } from '../../seed/pmix';
import { daysBackOf, isoDaysBack, shortDate, weekdayOf } from './dates';
import { FullDetail } from './FullDetail';
import { MenuMixCard } from './MenuMixCard';
import { SHOW_OPTIONS, mixFor, visibleItems, type MealFilter, type ShowFilter } from './mix';
import { SpecialsMixCard } from './SpecialsMixCard';
import { TopTen } from './TopTen';
import s from './pmix.module.css';

type When = 'y' | '7' | '14' | '28' | 'day' | 'range';
const PRESETS: Record<'y' | '7' | '14' | '28', number> = { y: 1, '7': 7, '14': 14, '28': 28 };

const WHAT: Record<ShowFilter, string> = { All: 'Items', Entrees: 'Entrées', SpEnt: 'Special entrées', Starters: 'Soups and starters', Desserts: 'Desserts' };

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={s.group} role="group" aria-label={label}>
      <span className={s.groupLabel} aria-hidden>
        {label}
      </span>
      {children}
    </div>
  );
}

/** P-Mix: what sold, specials against the à la carte menu, by day or range, meal, category and venue. */
export default function PmixPage(_props: BoPageProps) {
  const [when, setWhen] = useState<When>('y');
  // Days back from today: `from` is the older end of the range.
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(1);
  const [meal, setMeal] = useState<MealFilter>('All');
  const [show, setShow] = useState<ShowFilter>('All');
  const [protein, setProtein] = useState('');
  const [venue, setVenue] = useState('All');
  const [more, setMore] = useState(false);

  const mix = useMemo(() => mixFor(PMIX_DAYS, PMIX_RECIPES, PMIX_SIDES, { fromBack: from, toBack: to, meal, venue }), [from, to, meal, venue]);
  const items = visibleItems(mix.items, show, protein);
  const proteinName = protein ? (PMIX_PROTEINS.find((p) => p[0] === protein)?.[2] ?? PMIX_PROTEINS.find((p) => p[0] === protein)?.[1] ?? protein) : '';
  const what = protein ? `${proteinName} ${show === 'All' || show === 'Entrees' ? 'entrées' : WHAT[show].toLowerCase()}` : WHAT[show];
  const range =
    (from === to ? `${weekdayOf(from, 'short')}, ${shortDate(from)}` : `${shortDate(from)} to ${shortDate(to)}`) +
    (meal !== 'All' ? ` · ${meal}` : '') +
    (venue !== 'All' ? ` · ${PMIX_VENUES.find((v) => v.id === venue)?.name ?? ''}` : '');

  const pickWhen = (w: When) => {
    setWhen(w);
    if (w in PRESETS) {
      setFrom(PRESETS[w as keyof typeof PRESETS]);
      setTo(1);
    } else if (w === 'day') setFrom(to); // the most recent day of the range shown, not its oldest
  };
  const minIso = isoDaysBack(PMIX_OLDEST);
  const maxIso = isoDaysBack(1);
  const clampBack = (b: number) => Math.min(PMIX_OLDEST, Math.max(1, b));

  return (
    <BoPage title="P-Mix">
      <div className={s.filters}>
        <Group label="When">
          <div className={s.when}>
            <Tabs
              variant="segmented"
              size="sm"
              aria-label="When"
              value={when}
              onChange={pickWhen}
              options={[
                { id: 'y', label: 'Yesterday' },
                { id: '7', label: '7 days' },
                { id: '14', label: '14 days' },
                { id: '28', label: '28 days' },
                { id: 'day', label: 'Day' },
                { id: 'range', label: 'Range' },
              ]}
            />
            {when === 'day' && (
              <span className={s.datePick}>
                <BoIconButton aria-label="Previous day" disabled={from >= PMIX_OLDEST} onClick={() => (setFrom(from + 1), setTo(from + 1))}>
                  <ChevronLeft size={15} />
                </BoIconButton>
                <input
                  type="date"
                  className={s.date}
                  aria-label="Day"
                  min={minIso}
                  max={maxIso}
                  value={isoDaysBack(from)}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const b = clampBack(daysBackOf(e.target.value));
                    setFrom(b);
                    setTo(b);
                  }}
                />
                <BoIconButton aria-label="Next day" disabled={from <= 1} onClick={() => (setFrom(from - 1), setTo(from - 1))}>
                  <ChevronRight size={15} />
                </BoIconButton>
                <span className={s.weekday}>{weekdayOf(from)}</span>
              </span>
            )}
            {when === 'range' && (
              <span className={s.datePick}>
                <input
                  type="date"
                  className={s.date}
                  aria-label="From"
                  min={minIso}
                  max={maxIso}
                  value={isoDaysBack(from)}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const b = clampBack(daysBackOf(e.target.value));
                    setFrom(b);
                    if (to > b) setTo(b);
                  }}
                />
                <span className={s.to}>to</span>
                <input
                  type="date"
                  className={s.date}
                  aria-label="To"
                  min={isoDaysBack(from)}
                  max={maxIso}
                  value={isoDaysBack(to)}
                  onChange={(e) => e.target.value && setTo(Math.min(from, clampBack(daysBackOf(e.target.value))))}
                />
              </span>
            )}
          </div>
        </Group>
        <Group label="Meal">
          <Tabs
            variant="segmented"
            size="sm"
            aria-label="Meal"
            value={meal}
            onChange={setMeal}
            options={(['All', 'Breakfast', 'Lunch', 'Dinner'] as MealFilter[]).map((m) => ({ id: m, label: m }))}
          />
        </Group>
        <Group label="Show">
          <BoSelect aria-label="Show" value={show} onChange={(e) => setShow(e.target.value as ShowFilter)}>
            {SHOW_OPTIONS.map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </BoSelect>
        </Group>
        <Group label="Protein">
          <BoSelect
            aria-label="Protein"
            value={protein}
            onChange={(e) => {
              setProtein(e.target.value);
              // A protein only applies to entrées.
              if (e.target.value && show !== 'Entrees' && show !== 'SpEnt') setShow('Entrees');
            }}
          >
            <option value="">Any protein</option>
            {PMIX_PROTEINS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </BoSelect>
        </Group>
        <Group label="Venue">
          <BoSelect aria-label="Venue" value={venue} onChange={(e) => setVenue(e.target.value)}>
            <option value="All">All venues</option>
            {PMIX_VENUES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </BoSelect>
        </Group>
      </div>

      {show === 'SpEnt' ? <SpecialsMixCard items={items} what={what} range={range} /> : <MenuMixCard items={items} what={what} range={range} />}
      <TopTen items={visibleItems(mix.items, 'All', protein)} />

      <button className={s.moreBtn} aria-expanded={more} onClick={() => setMore(!more)}>
        <ChevronDown size={15} className={cx(s.caret, more && s.caretFlip)} aria-hidden />
        {more ? 'Hide full detail' : 'Show full detail'} · every item, sides chosen, totals
      </button>
      {more && <FullDetail mix={mix} items={items} show={show} />}
    </BoPage>
  );
}
