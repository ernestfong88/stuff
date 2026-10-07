import { useMemo, useState } from 'react';
import { residents } from '../../../../data';
import { Avatar, Button, SearchField, Tabs, cx } from '../../../../ui';
import { BoPage, BoStatRow, BoStatTile, BoTable, type BoColumn, type BoSort } from '../../kit';
import type { BoPageProps } from '../../nav';
import { dietRows, filterDietRows, tagCounts, tagKey, type DietRow, type DietSortKey, type Tag, type TagCategory } from './diets';
import s from './resDiets.module.css';

const LEVELS: Record<string, string> = { IL: 'Independent living', AL: 'Assisted living', MC: 'Memory care' };
const CATEGORY_TABS: Array<{ id: TagCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'allergy', label: 'Allergies' },
  { id: 'diet', label: 'Diets' },
  { id: 'texture', label: 'Texture' },
];

function TagChip({ tag, active, onClick }: { tag: Tag; active: boolean; onClick: () => void }) {
  return (
    <button className={cx(s.tag, s[tag.cat], active && s.tagOn)} aria-pressed={active} title={`Show everyone with ${tag.text}`} onClick={onClick}>
      {tag.text}
    </button>
  );
}

/** Allergies & Diets: who has each allergy, diet or texture, as the kitchen ticket shows it. */
export default function AllergiesDietsPage(_props: BoPageProps) {
  const rows = useMemo(() => dietRows(residents), []);
  const counts = useMemo(() => tagCounts(rows), [rows]);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<TagCategory | 'all'>('all');
  const [tag, setTag] = useState<string | null>(null);
  const [includeNone, setIncludeNone] = useState(false);
  const [sort, setSort] = useState<BoSort>({ key: 'name', dir: 1 });
  const shown = filterDietRows(rows, { query, cat, tag, includeNone, sort: { key: sort.key as DietSortKey, dir: sort.dir } });
  const per = (k: TagCategory) => rows.filter((x) => x.tags.some((t) => t.cat === k)).length;
  const pickCat = (k: TagCategory | 'all') => {
    setCat(k);
    setTag(null);
  };
  const toggleTag = (k: string) => setTag(tag === k ? null : k);
  const filtered = query !== '' || cat !== 'all' || tag != null;
  const tagName = tag ? counts.find((c) => c.key === tag)?.text : null;

  const columns: Array<BoColumn<DietRow>> = [
    {
      key: 'name',
      header: 'Resident',
      sortable: true,
      render: (x) => (
        <span className={s.person}>
          <Avatar person={x.r} size={30} />
          <span className={s.name}>{x.r.name}</span>
        </span>
      ),
    },
    { key: 'apt', header: 'Apt', sortable: true, width: 80, render: (x) => x.r.apt },
    { key: 'level', header: 'Level', sortable: true, width: 80, render: (x) => <abbr className={s.level} title={LEVELS[x.r.level] ?? x.r.level}>{x.r.level}</abbr> },
    {
      key: 'tags',
      header: 'Kitchen ticket shows',
      sortable: true,
      render: (x) =>
        x.tags.length ? (
          <span className={s.tags}>
            {x.tags.map((t) => (
              <TagChip key={tagKey(t)} tag={t} active={tag === tagKey(t)} onClick={() => toggleTag(tagKey(t))} />
            ))}
          </span>
        ) : (
          <span className={s.none}>Nothing</span>
        ),
    },
    { key: 'onFile', header: 'On file', render: (x) => <span className={s.onFile}>{x.onFile.join('; ') || '—'}</span> },
  ];

  return (
    <BoPage title="Allergies & Diets" sub="Every resident with an allergy, diet or texture on file, tagged the way the kitchen ticket shows it.">
      <BoStatRow>
        <BoStatTile value={rows.filter((x) => x.tags.length).length} label="residents with something on file" active={cat === 'all'} onClick={() => pickCat('all')} />
        <BoStatTile value={per('allergy')} label="with an allergy" tone="danger" active={cat === 'allergy'} onClick={() => pickCat(cat === 'allergy' ? 'all' : 'allergy')} />
        <BoStatTile value={per('diet')} label="on a diet" tone="ocean" active={cat === 'diet'} onClick={() => pickCat(cat === 'diet' ? 'all' : 'diet')} />
        <BoStatTile value={per('texture')} label="on a texture or thickened liquids" tone="clay" active={cat === 'texture'} onClick={() => pickCat(cat === 'texture' ? 'all' : 'texture')} />
      </BoStatRow>

      <div className={s.filters}>
        <div className={s.filterRow}>
          <SearchField value={query} onChange={setQuery} placeholder="Search name, apartment or tag" aria-label="Search residents" className={s.search} />
          <Tabs variant="segmented" size="sm" aria-label="Category" value={cat} onChange={pickCat} options={CATEGORY_TABS} />
          <label className={s.checkLabel}>
            <input type="checkbox" checked={includeNone} onChange={(e) => setIncludeNone(e.target.checked)} />
            Include residents with nothing on file
          </label>
        </div>
        {counts.some((c) => cat === 'all' || c.cat === cat) && (
          <div className={s.chipRow}>
            <span className={s.chipLabel}>Ticket tags</span>
            {counts
              .filter((c) => cat === 'all' || c.cat === cat)
              .map((c) => (
                <span key={c.key} className={s.chipCount}>
                  <TagChip tag={c} active={tag === c.key} onClick={() => toggleTag(c.key)} />
                  <span className={s.n}>{c.n}</span>
                </span>
              ))}
          </div>
        )}
      </div>

      <div className={s.countRow}>
        <span>
          {shown.length} {shown.length === 1 ? 'resident' : 'residents'}
          {tagName ? ` tagged ${tagName}` : ''}
        </span>
        {filtered && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setQuery('');
              pickCat('all');
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <BoTable caption="Residents with allergies and diets" columns={columns} rows={shown} rowKey={(x) => x.r.id} sort={sort} onSort={setSort} empty="No resident matches these filters." />
      <p className={s.foot}>Tags are shortened exactly as they print on the kitchen ticket. On file is the wording from the care assessment.</p>
    </BoPage>
  );
}
