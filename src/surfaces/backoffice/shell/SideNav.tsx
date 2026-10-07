import { useEffect, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cx } from '../../../ui';
import { BO_SECTIONS, navPageId, type BoSectionDef } from '../nav';
import { AccountCard } from './AccountCard';
import { CommunitySwitcher } from './CommunitySwitcher';
import { KiscoMark } from './KiscoMark';
import { shortcutLabel } from './shortcut';
import s from './SideNav.module.css';

interface Props {
  pageId: string;
  section: BoSectionDef;
  goto: (pageId: string) => void;
  onSearch: () => void;
  /** Drawer mode (narrow windows): show a close button. */
  onClose?: () => void;
}

/**
 * Seven sections instead of one long list. Only the section you are in is
 * open; opening another section goes to its first page. Search jumps anywhere.
 */
export function SideNav({ pageId, section, goto, onSearch, onClose }: Props) {
  const [open, setOpen] = useState<string | null>(section.id);
  useEffect(() => setOpen(section.id), [section.id]);
  const current = navPageId(pageId);

  return (
    <div className={s.side}>
      <div className={s.brand}>
        <span className={s.mark}>
          <KiscoMark height={22} />
        </span>
        <span className={s.brandText}>
          <span className={s.brandName}>KiscoConnect</span>
          <span className={s.brandModule}>Culinary</span>
        </span>
        {onClose && (
          <button className={s.close} onClick={onClose} aria-label="Close the page menu">
            <X size={18} />
          </button>
        )}
      </div>

      <div className={s.searchWrap}>
        <button className={s.search} onClick={onSearch}>
          <Search size={14} aria-hidden />
          <span className={s.searchText}>Search pages</span>
          <kbd className={s.kbd}>{shortcutLabel()}</kbd>
        </button>
      </div>

      <nav className={s.nav} aria-label="Back office pages">
        <ul className={s.sections}>
          {BO_SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const single = sec.pages.length === 1;
            const isCurrent = sec.id === section.id;
            const isOpen = !single && open === sec.id;
            const listId = `bo-sec-${sec.id}`;
            return (
              <li key={sec.id}>
                <button
                  className={cx(s.sectionBtn, isCurrent && s.sectionCurrent, single && isCurrent && s.sectionOn)}
                  aria-expanded={single ? undefined : isOpen}
                  aria-controls={single ? undefined : listId}
                  aria-current={single && isCurrent ? 'page' : undefined}
                  onClick={() => {
                    if (single) goto(sec.pages[0].id);
                    else if (isOpen) setOpen(null);
                    else {
                      setOpen(sec.id);
                      if (!isCurrent) goto(sec.pages[0].id);
                    }
                  }}
                >
                  <Icon size={17} strokeWidth={1.9} className={s.sectionIcon} aria-hidden />
                  <span className={s.sectionLabel}>{sec.label}</span>
                  {!single && <ChevronDown size={14} className={cx(s.chev, isOpen && s.chevOpen)} aria-hidden />}
                </button>
                {isOpen && (
                  <ul className={s.pages} id={listId}>
                    {sec.pages.map((p) => {
                      const on = p.id === current;
                      return (
                        <li key={p.id}>
                          <a
                            href={`#/backoffice/${p.id}`}
                            className={cx(s.pageLink, on && s.pageOn)}
                            aria-current={on ? 'page' : undefined}
                            onClick={(e) => {
                              e.preventDefault();
                              goto(p.id);
                            }}
                          >
                            {p.label}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={s.footer}>
        <CommunitySwitcher />
        <AccountCard />
      </div>
    </div>
  );
}
