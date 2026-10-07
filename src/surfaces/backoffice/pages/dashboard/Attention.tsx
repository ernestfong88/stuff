import { useMemo } from 'react';
import { AlertTriangle, BadgeCheck, CalendarClock, ChevronRight, Clock, Store, Ban, type LucideIcon } from 'lucide-react';
import { getItem, getResident } from '../../../../data';
import { courseSummaries } from '../../../../domain/courses';
import { sickConfig, sickWaiversThisMonth } from '../../../../domain/waivers';
import { MINUTE, now, startOfToday } from '../../../../lib/clock';
import { useConfig } from '../../../../store/config';
import { itemsOut, use86 } from '../../../../store/eightySix';
import { threshold, useSetting } from '../../../../store/serviceConfig';
import { useDining } from '../../../../store/dining';
import { cx } from '../../../../ui';
import { BoCaption, amountToReview, chargesToReview, useBilling, useCommunity } from '../../kit';
import { MENU_NAMES, VENUE_MENUS } from '../../seed/venues';
import { attentionItems, type AttentionKind } from './model/attention';
import s from './dashboard.module.css';

const ICONS: Record<AttentionKind, LucideIcon> = {
  eightySix: Ban,
  late: Clock,
  sick: AlertTriangle,
  charges: BadgeCheck,
  menuSoon: CalendarClock,
  noMenu: Store,
};

/** Cards for what needs acting on today; nothing shows when all is well. */
export function Attention({ goto }: { goto: (pageId: string) => void }) {
  const marks = use86();
  const cfg = useConfig();
  const community = useCommunity();
  const { orders, history } = useDining();
  const { charges } = useBilling();
  // Re-read when the late threshold changes in Alerts & Timing.
  useSetting('t.floorCook');
  const items = useMemo(() => {
    const t0 = startOfToday();
    const lateMin = threshold('floorCook');
    const late = Number.isFinite(lateMin)
      ? [...orders, ...history]
          .filter((o) => !o.queueType && o.openedAt >= t0)
          .reduce((n, o) => n + courseSummaries(o, cfg).filter((c) => c.kds && c.fired && c.ready && (c.ready - c.fired) / MINUTE >= lateMin).length, 0)
      : 0;
    const sick = sickConfig(community, cfg);
    const used = new Map<string, number>();
    if (sick.on) for (const w of sickWaiversThisMonth([...orders, ...history], cfg)) used.set(w.sickTray!.rid, (used.get(w.sickTray!.rid) ?? 0) + 1);
    return attentionItems({
      out: itemsOut(marks)
        .map((id) => getItem(id)?.name)
        .filter((n): n is string => !!n),
      lateTickets: late,
      lateMinutes: lateMin,
      waiversUsedUp: [...used.entries()].filter(([, k]) => k >= sick.allow).map(([rid, k]) => `${getResident(rid)?.name ?? 'A resident'} (${k} of ${sick.allow})`),
      chargesToReview: chargesToReview(charges).length,
      amountToReview: amountToReview(charges),
      venues: VENUE_MENUS,
      menus: MENU_NAMES,
      at: now(),
    });
  }, [marks, cfg, community, orders, history, charges]);

  if (!items.length) return null;
  return (
    <section aria-label="Needs your attention" className={s.attention}>
      <BoCaption>Needs your attention</BoCaption>
      <div className={s.attentionGrid}>
        {items.map((it) => {
          const Icon = ICONS[it.kind];
          const body = (
            <>
              <span className={s.attHead}>
                <span className={cx(s.attIcon, s[`att_${it.tone}`])}>
                  <Icon size={16} aria-hidden />
                </span>
                <span className={s.attN}>{it.n}</span>
                <span className={s.attTitle}>{it.title}</span>
              </span>
              <span className={s.attDetail}>{it.detail}</span>
              {it.goto ? (
                <span className={s.attLink}>
                  {it.goto.label} <ChevronRight size={13} aria-hidden />
                </span>
              ) : (
                <span className={s.attNote}>{it.note}</span>
              )}
            </>
          );
          return it.goto ? (
            <button key={it.kind} className={cx(s.attCard, s.attButton)} onClick={() => goto(it.goto!.page)}>
              {body}
            </button>
          ) : (
            <div key={it.kind} className={s.attCard}>
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}
