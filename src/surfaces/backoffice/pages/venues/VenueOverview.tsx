import { AlertTriangle, ChevronRight, RotateCcw } from 'lucide-react';
import { Button, Chip, cx } from '../../../../ui';
import type { Venue, VenueAdminView } from '../../../../store/venueSettings';
import { venueIssues, type VenueTab } from './issues';
import { kitchenLine, servingLines, venueKind } from './summary';
import s from './venues.module.css';

/** "Cycle: VT Fall 2026 · week 2 of 4" with its label in bold. */
function Line({ text }: { text: string }) {
  const at = text.indexOf(': ');
  return (
    <span className={s.factLine}>
      {at > 0 ? (
        <>
          <span className={s.factKey}>{text.slice(0, at)}</span> {text.slice(at + 2)}
        </>
      ) : (
        text
      )}
    </span>
  );
}

/** One card per venue: what it is, what it serves now, its kitchen, and anything to fix. Click a card to open the venue. */
export function VenueOverview({
  settings,
  at,
  onOpen,
  onBringBack,
}: {
  settings: VenueAdminView;
  at: number;
  onOpen: (id: string, tab?: VenueTab) => void;
  onBringBack: (v: Venue) => void;
}) {
  const active = settings.venues.filter((v) => v.active);
  const retired = settings.venues.filter((v) => !v.active);
  return (
    <>
      <div className={s.grid}>
        {active.map((v) => {
          const lines = servingLines(v, settings.menus, at);
          const issues = venueIssues(settings, v);
          return (
            <article key={v.id} className={s.card}>
              <header className={s.cardHead}>
                <div className={s.cardTitles}>
                  <h2 className={s.cardName}>
                    <button className={s.cardOpen} onClick={() => onOpen(v.id)}>
                      {v.name}
                    </button>
                  </h2>
                  <span className={s.cardKind}>{venueKind(v)}</span>
                </div>
                <Chip tone="success">Open</Chip>
                <ChevronRight size={18} className={s.cardChevron} aria-hidden />
              </header>
              <dl className={s.facts}>
                <div className={s.fact}>
                  <dt>Serving now</dt>
                  <dd>{lines.length ? lines.map((l) => <Line key={l} text={l} />) : <span className={s.factNone}>No menu yet</span>}</dd>
                </div>
                <div className={s.fact}>
                  <dt>Kitchen</dt>
                  <dd>{kitchenLine(v, settings.venues)}</dd>
                </div>
              </dl>
              {issues.length > 0 && (
                <ul className={s.cardIssues} aria-label={`${v.name} needs attention`}>
                  {issues.map((i, n) => (
                    <li key={n}>
                      <button className={cx(s.cardIssue, i.tone === 'danger' && s.cardIssueDanger)} onClick={() => onOpen(v.id, i.tab)}>
                        <AlertTriangle size={14} aria-hidden />
                        <span className={s.cardIssueText}>{i.text}</span>
                        <span className={s.issueFix}>
                          Fix <ChevronRight size={14} aria-hidden />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>

      {retired.length > 0 && (
        <section className={s.retiredGroup} aria-label="Retired venues">
          <h2 className={s.groupTitle}>Retired ({retired.length})</h2>
          <div className={s.grid}>
            {retired.map((v) => (
              <article key={v.id} className={cx(s.card, s.cardRetired)}>
                <header className={s.cardHead}>
                  <div className={s.cardTitles}>
                    <h3 className={s.cardName}>{v.name}</h3>
                    <span className={s.cardKind}>{venueKind(v)}</span>
                  </div>
                  <Chip tone="neutral">Retired</Chip>
                </header>
                <p className={s.retiredNote}>Closed. Its prices, layouts and order history are kept.</p>
                <div>
                  <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={() => onBringBack(v)}>
                    Bring back
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
