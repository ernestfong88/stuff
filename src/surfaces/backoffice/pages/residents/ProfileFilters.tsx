import { ChevronDown } from 'lucide-react';
import { Button, Popover, SearchField, Tabs, cx } from '../../../../ui';
import { BoSelect } from '../../kit';
import { careLevel } from '../../../server/features/residents/residentInfo';
import { tagLabel, type TagCategory } from './dietTags';
import { ALL, NOTHING_ON_FILE, anyOf, isFiltered, type ProfileFacets, type ProfileFilter } from './residentFilters';
import s from './ProfileFilters.module.css';

const GROUPS: Array<{ cat: TagCategory; title: string; any: string }> = [
  { cat: 'allergy', title: 'Allergies', any: 'Any allergy' },
  { cat: 'diet', title: 'Diets', any: 'Any diet' },
  { cat: 'texture', title: 'Textures & liquids', any: 'Any texture' },
];

function Check({
  on,
  onChange,
  label,
  n,
  tone,
  title,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
  n: number;
  tone?: TagCategory | 'strong';
  title?: string;
}) {
  return (
    <label className={cx(s.check, tone && s[tone], n === 0 && !on && s.zero)} title={title}>
      <input type="checkbox" checked={on} onChange={onChange} />
      <span className={s.checkLabel}>{label}</span>
      <span className={s.n}>{n}</span>
    </label>
  );
}

/** "Diets & allergies ▾": every tag on file with how many residents have it; anyone with any of the chosen shows. */
function TagPicker({ facets, value, onChange }: { facets: ProfileFacets; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (k: string) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  const nameOf = (k: string) =>
    k === NOTHING_ON_FILE
      ? 'Nothing on file'
      : (GROUPS.find((g) => anyOf(g.cat) === k)?.any ?? tagLabel(facets.tags.find((t) => t.key === k)?.text ?? k));
  const summary = value.length === 0 ? 'Diets & allergies' : value.length === 1 ? nameOf(value[0]) : `Diets & allergies · ${value.length}`;
  return (
    <Popover
      align="left"
      minWidth={260}
      className={s.panel}
      trigger={({ open, toggle: flip }) => (
        <button type="button" className={cx(s.trigger, value.length > 0 && s.triggerOn)} aria-expanded={open} aria-haspopup="true" onClick={flip}>
          <span className={s.triggerText}>{summary}</span>
          <ChevronDown size={14} strokeWidth={2.5} aria-hidden />
        </button>
      )}
    >
      <div role="group" aria-label="Diets & allergies">
        {GROUPS.filter((g) => facets.tags.some((t) => t.cat === g.cat)).map((g) => (
          <fieldset key={g.cat} className={s.group}>
            <legend className={s.groupTitle}>{g.title}</legend>
            <Check on={value.includes(anyOf(g.cat))} onChange={() => toggle(anyOf(g.cat))} label={g.any} n={facets.categories[g.cat]} tone="strong" />
            {facets.tags
              .filter((t) => t.cat === g.cat)
              .map((t) => (
                <Check
                  key={t.key}
                  on={value.includes(t.key)}
                  onChange={() => toggle(t.key)}
                  label={tagLabel(t.text)}
                  n={t.n}
                  tone={t.cat}
                  title={tagLabel(t.text) !== t.text ? `Prints as ${t.text} on the kitchen ticket` : undefined}
                />
              ))}
          </fieldset>
        ))}
        <div className={s.group}>
          <Check on={value.includes(NOTHING_ON_FILE)} onChange={() => toggle(NOTHING_ON_FILE)} label="Nothing on file" n={facets.none} />
        </div>
        {value.length > 0 && (
          <div className={s.panelFoot}>
            <Button size="sm" variant="ghost" onClick={() => onChange([])}>
              Clear
            </Button>
          </div>
        )}
      </div>
    </Popover>
  );
}

/** The bar over the resident list: search, care level, diets & allergies, meal plan, and how many show. */
export function ProfileFilters({
  filter,
  onChange,
  facets,
  shown,
  total,
}: {
  filter: ProfileFilter;
  onChange: (f: ProfileFilter) => void;
  facets: ProfileFacets;
  shown: number;
  total: number;
}) {
  const set = (patch: Partial<ProfileFilter>) => onChange({ ...filter, ...patch });
  const levelTotal = facets.levels.reduce((n, l) => n + l.n, 0);
  const planTotal = facets.plans.reduce((n, p) => n + p.n, 0);
  return (
    <div className={s.bar}>
      <SearchField value={filter.query} onChange={(query) => set({ query })} placeholder="Search name, apt or diet" className={s.search} />
      <Tabs
        variant="segmented"
        size="sm"
        aria-label="Care level"
        value={filter.level}
        onChange={(level) => set({ level })}
        options={[
          { id: ALL, label: 'All', count: levelTotal },
          ...facets.levels.map((l) => ({
            id: l.id,
            label: (
              <abbr className={s.abbr} title={careLevel(l.id)}>
                {l.label}
              </abbr>
            ),
            count: l.n,
          })),
        ]}
      />
      <TagPicker facets={facets} value={filter.tags} onChange={(tags) => set({ tags })} />
      <BoSelect
        className={cx(s.plan, filter.plan !== ALL && s.triggerOn)}
        aria-label="Meal plan"
        value={filter.plan}
        onChange={(e) => set({ plan: e.target.value })}
      >
        <option value={ALL}>All meal plans · {planTotal}</option>
        {facets.plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label} · {p.n}
          </option>
        ))}
      </BoSelect>
      {isFiltered(filter) && (
        <span className={s.count} role="status">
          Showing {shown} of {total} ·
          <button type="button" className={s.clear} onClick={() => onChange({ query: '', level: ALL, tags: [], plan: ALL })}>
            Clear filters
          </button>
        </span>
      )}
    </div>
  );
}
