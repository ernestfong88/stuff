import { useState } from 'react';
import { Pin, Plus } from 'lucide-react';
import type { BoModGroup } from '../../../../store/menuEdits';
import { Button, SearchField, cx } from '../../../../ui';
import s from './GroupList.module.css';

/** Modifier groups, most used first, with search and a quick add. */
export function GroupList({
  groups,
  selectedId,
  onSelect,
  onAdd,
  onRestore,
}: {
  groups: BoModGroup[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (name: string) => void;
  onRestore: (g: BoModGroup) => void;
}) {
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const [showRetired, setShowRetired] = useState(false);
  const active = groups.filter((g) => g.active).sort((a, b) => b.usage90 - a.usage90);
  const retired = groups.filter((g) => !g.active);
  const max = Math.max(1, ...active.map((g) => g.usage90));
  const query = q.trim().toLowerCase();
  const list = active.filter((g) => !query || g.name.toLowerCase().includes(query) || g.mods.some((m) => m.n.toLowerCase().includes(query)));
  const add = () => {
    if (!name.trim()) return;
    onAdd(name.trim());
    setName('');
  };

  return (
    <section className={s.card} aria-label="Modifier groups">
      <header className={s.head}>
        <h2 className={s.title}>Groups</h2>
        <span className={s.sub}>{active.length} · most used in 90 days first</span>
      </header>
      <SearchField value={q} onChange={setQ} placeholder="Find a group or modifier" />
      <div className={s.list}>
        {list.map((g) => (
          <button key={g.id} className={cx(s.row, g.id === selectedId && s.on)} onClick={() => onSelect(g.id)} aria-current={g.id === selectedId || undefined}>
            <span className={s.rowTop}>
              <span className={s.name}>{g.name}</span>
              <span className={s.meta}>{g.mods.length} choices</span>
              {g.pinned.length > 0 && (
                <span className={s.pins} title={`Pinned to ${g.pinned.length} recipes`}>
                  <Pin size={11} aria-hidden /> {g.pinned.length}
                </span>
              )}
            </span>
            <span className={s.rowBottom}>
              <span className={s.bar}>
                <span className={s.fill} style={{ width: `${(g.usage90 / max) * 100}%` }} />
              </span>
              <span className={s.uses}>{g.usage90} uses</span>
            </span>
          </button>
        ))}
        {!list.length && <div className={s.none}>No group matches.</div>}
        {retired.length > 0 && (
          <div className={s.retired}>
            <button className={s.retiredToggle} onClick={() => setShowRetired((x) => !x)} aria-expanded={showRetired}>
              {showRetired ? 'Hide' : 'Show'} retired groups ({retired.length})
            </button>
            {showRetired &&
              retired.map((g) => (
                <div key={g.id} className={s.retiredRow}>
                  <span>{g.name}</span>
                  <Button size="sm" variant="ghost" onClick={() => onRestore(g)}>
                    Restore
                  </Button>
                </div>
              ))}
          </div>
        )}
      </div>
      <div className={s.add}>
        <input
          className={s.addInput}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="New group name"
          aria-label="New group name"
        />
        <Button size="sm" variant="primary" icon={<Plus size={14} />} disabled={!name.trim()} onClick={add}>
          Add
        </Button>
      </div>
    </section>
  );
}
