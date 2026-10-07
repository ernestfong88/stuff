import { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, Check, Search } from 'lucide-react';
import { cx } from '../../../ui';
import { filterCommunityGroups, setCommunity, useCommunity } from '../kit/community';
import { COMMUNITY_COLUMNS } from '../seed/shell';
import { useDismiss } from './useDismiss';
import s from './SideFooter.module.css';

/** "Community · Valencia Terrace · Change": pick which community the back office shows. */
export function CommunitySwitcher() {
  const current = useCommunity();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, root, trigger);
  useEffect(() => {
    if (open) {
      setQuery('');
      input.current?.focus();
    }
  }, [open]);

  const columns = filterCommunityGroups(COMMUNITY_COLUMNS, query);
  const pick = (name: string) => {
    setCommunity(name);
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div className={s.anchor} ref={root}>
      <button ref={trigger} className={cx(s.community, open && s.pressed)} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className={s.communityIcon}>
          <Building2 size={15} aria-hidden />
        </span>
        <span className={s.communityText}>
          <span className={s.eyebrow}>Community</span>
          <span className={s.communityName}>{current}</span>
        </span>
        <span className={s.change}>Change</span>
      </button>
      {open && (
        <div className={cx(s.panel, s.communityPanel)} role="dialog" aria-label="Switch community">
          <div className={s.panelHead}>
            <div className={s.panelTitle}>Switch community</div>
            <label className={s.search}>
              <Search size={14} aria-hidden />
              <input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search communities" aria-label="Search communities" />
            </label>
          </div>
          <div className={s.panelBody}>
            {columns.length === 0 ? (
              <div className={s.none}>No community matches that search.</div>
            ) : (
              <div className={s.columns}>
                {columns.map((col, i) => (
                  <div key={i}>
                    {col.map(([group, list]) => (
                      <div key={group} className={s.group}>
                        <div className={s.groupName}>{group}</div>
                        {list.map((name) => (
                          <button key={name} className={cx(s.option, name === current && s.optionOn)} aria-current={name === current ? 'true' : undefined} onClick={() => pick(name)}>
                            <span>{name}</span>
                            {name === current && <Check size={14} aria-hidden />}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
