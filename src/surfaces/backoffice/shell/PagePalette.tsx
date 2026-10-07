import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Search } from 'lucide-react';
import { cx } from '../../../ui';
import { BO_ALIASES, BO_MORE_PAGES, BO_SECTIONS, findPage, type BoSectionDef } from '../nav';
import { phaseOf, usePhasePlan } from '../phases';
import { searchPages, type SearchablePage } from './search';
import s from './PagePalette.module.css';

interface Entry extends SearchablePage {
  sectionDef: BoSectionDef;
}

const ENTRIES: Entry[] = [
  ...BO_SECTIONS.flatMap((sec) => sec.pages.map((p) => ({ ...p, section: sec.label, sectionDef: sec }))),
  ...BO_MORE_PAGES.flatMap((p) => {
    const home = findPage(p.id);
    return home ? [{ ...p, section: home.section.label, sectionDef: home.section }] : [];
  }),
  ...BO_ALIASES.flatMap((a) => {
    const home = findPage(a.to[0]);
    return home ? [{ ...a, section: home.page.label, sectionDef: home.section }] : [];
  }),
];

/** Ctrl K: type where you want to go. Arrow keys move, Enter opens, Escape closes. */
export function PagePalette({ onClose, goto }: { onClose: () => void; goto: (pageId: string) => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();
  const results = useMemo(() => searchPages(ENTRIES, query), [query]);
  const plan = usePhasePlan();

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => before?.focus?.();
  }, []);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const open = (e: Entry | undefined) => {
    if (e) goto(e.id);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      open(results[active]);
    }
  };

  return (
    <div className={s.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={s.panel} role="dialog" aria-modal="true" aria-label="Search pages">
        <div className={s.head}>
          <Search size={17} className={s.headIcon} aria-hidden />
          <input
            ref={input}
            className={s.input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Where to? Try “prices” or “red tables”"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${results[active].id}` : undefined}
            aria-label="Search pages"
          />
          <kbd className={s.kbd}>Esc</kbd>
        </div>
        <div className={s.list} ref={list} id={listId} role="listbox" aria-label="Pages">
          {results.map((r, i) => {
            const Icon = r.sectionDef.icon;
            const on = i === active;
            return (
              <div
                key={r.id}
                id={`${listId}-${r.id}`}
                data-index={i}
                role="option"
                aria-selected={on}
                className={cx(s.item, on && s.itemOn)}
                onMouseEnter={() => setActive(i)}
                onClick={() => open(r)}
              >
                <span className={s.itemIcon}>
                  <Icon size={15} aria-hidden />
                </span>
                <span className={s.itemText}>
                  <span className={s.itemLabel}>{r.label}</span>
                  <span className={s.itemBlurb}>{r.blurb}</span>
                </span>
                <span className={s.itemSection}>
                  {r.section}
                  {phaseOf(r.id, plan) === 2 && ' · Phase 2'}
                </span>
              </div>
            );
          })}
          {results.length === 0 && <div className={s.none}>No page matches that. Try another word.</div>}
        </div>
      </div>
    </div>
  );
}
