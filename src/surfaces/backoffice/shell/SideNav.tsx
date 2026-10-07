import { useEffect, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { Tabs, cx } from '../../../ui';
import { navPageId, type BoSectionDef } from '../nav';
import { orderedSections, phaseOf, sectionPhase, setPhaseView, usePhasePlan, usePhaseView, visiblePages, type Phase } from '../phases';
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

/** "Phase 2" or "Phase 3" beside a page that ships later. */
function PhaseTag({ phase }: { phase: Phase }) {
  return <span className={cx(s.phaseTag, s[`tag${phase}`])}>Phase {phase}</span>;
}

/** Text colour for an item in a later phase. */
const phaseClass = (phase: Phase) => (phase === 3 ? s.later3 : phase === 2 ? s.later : undefined);

/**
 * A few sections instead of one long list. Only the section you are in is
 * open; opening another section goes to its first page. Search jumps anywhere.
 */
export function SideNav({ pageId, section, goto, onSearch, onClose }: Props) {
  const [open, setOpen] = useState<string | null>(section.id);
  useEffect(() => setOpen(section.id), [section.id]);
  const current = navPageId(pageId);
  const plan = usePhasePlan();
  const view = usePhaseView();

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
          {orderedSections(plan).map((sec, si, all) => {
            const pages = visiblePages(sec, view, plan, current);
            if (!pages.length) return null;
            const secPhase = sectionPhase(sec, plan);
            const laterSection = secPhase > 1;
            // The first section of each later phase starts with that phase's heading.
            const firstLaterSection = laterSection && (si === 0 || sectionPhase(all[si - 1], plan) !== secPhase);
            const Icon = sec.icon;
            const single = pages.length === 1;
            const isCurrent = sec.id === section.id;
            const isOpen = !single && open === sec.id;
            const listId = `bo-sec-${sec.id}`;
            return (
              <li key={sec.id} className={cx(firstLaterSection && s.laterStart)}>
                {firstLaterSection && <div className={cx(s.laterHead, secPhase === 3 && s.later3)}>Phase {secPhase}</div>}
                <button
                  className={cx(s.sectionBtn, phaseClass(secPhase), isCurrent && s.sectionCurrent, single && isCurrent && s.sectionOn)}
                  aria-expanded={single ? undefined : isOpen}
                  aria-controls={single ? undefined : listId}
                  aria-current={single && isCurrent ? 'page' : undefined}
                  onClick={() => {
                    if (single) goto(pages[0].id);
                    else if (isOpen) setOpen(null);
                    else {
                      setOpen(sec.id);
                      if (!isCurrent) goto(pages[0].id);
                    }
                  }}
                >
                  <Icon size={17} strokeWidth={1.9} className={s.sectionIcon} aria-hidden />
                  <span className={s.sectionLabel}>{sec.label}</span>
                  {single && view === 'all' && phaseOf(pages[0].id, plan) > secPhase && <PhaseTag phase={phaseOf(pages[0].id, plan)} />}
                  {!single && <ChevronDown size={14} className={cx(s.chev, isOpen && s.chevOpen)} aria-hidden />}
                </button>
                {isOpen && (
                  <ul className={s.pages} id={listId}>
                    {pages.map((p) => {
                      const on = p.id === current;
                      return (
                        <li key={p.id}>
                          <a
                            href={`#/backoffice/${p.id}`}
                            className={cx(s.pageLink, phaseClass(phaseOf(p.id, plan)), on && s.pageOn)}
                            aria-current={on ? 'page' : undefined}
                            onClick={(e) => {
                              e.preventDefault();
                              goto(p.id);
                            }}
                          >
                            <span className={s.pageLabel}>{p.label}</span>
                            {view === 'all' && phaseOf(p.id, plan) > secPhase && <PhaseTag phase={phaseOf(p.id, plan)} />}
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
        <Tabs
          variant="segmented"
          size="sm"
          className={s.phaseSwitch}
          aria-label="Pages to show"
          value={view}
          onChange={(v) => setPhaseView(v)}
          options={[
            { id: 'all', label: 'All pages' },
            { id: 'p1', label: 'Phase 1 only' },
          ]}
        />
        <CommunitySwitcher />
        <AccountCard />
      </div>
    </div>
  );
}
