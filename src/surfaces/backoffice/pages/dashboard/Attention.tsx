import { useMemo } from 'react';
import { AlertTriangle, BadgeCheck, CalendarClock, ChefHat, ChevronDown, ChevronRight, Clock, Store, Ban, type LucideIcon } from 'lucide-react';
import { getItem, getResident } from '../../../../data';
import { courseSummaries } from '../../../../domain/courses';
import { sickConfig, sickWaiversThisMonth } from '../../../../domain/waivers';
import { MINUTE, now, startOfToday } from '../../../../lib/clock';
import { useConfig } from '../../../../store/config';
import { itemsOut, use86 } from '../../../../store/eightySix';
import { threshold, useSetting } from '../../../../store/serviceConfig';
import { useDiningHistory, useDiningOrders } from '../../../../store/dining';
import { navigate } from '../../../../shell/router';
import { isHomeOffice, useBoRole } from '../../../../store/boRole';
import { canSee } from '../../nav';
import { cx } from '../../../../ui';
import { BoCaption, amountToReview, chargesToReview, useBilling, useCommunity } from '../../kit';
import { useVenueSettings } from '../../../../store/venueSettings';
import { useSubmissions } from '../../menus/approvals';
import { useBo } from '../../menus/data';
import { queueCounts } from '../../menus/model/recipeApproval';
import { attentionItems, type AttentionKind } from './model/attention';
import { useRemembered } from './parts';
import s from './dashboard.module.css';

const ICONS: Record<AttentionKind, LucideIcon> = {
  eightySix: Ban,
  late: Clock,
  sick: AlertTriangle,
  charges: BadgeCheck,
  recipes: ChefHat,
  menuSoon: CalendarClock,
  noMenu: Store,
};

/** One line per thing to act on today, each linking to where it is done; nothing shows when all is well. */
export function Attention({ goto }: { goto: (pageId: string) => void }) {
  const marks = use86();
  const cfg = useConfig();
  const community = useCommunity();
  const orders = useDiningOrders();
  const history = useDiningHistory();
  const { charges } = useBilling();
  const venueSettings = useVenueSettings();
  const bo = useBo();
  const recipesWaiting = queueCounts(useSubmissions()).waiting;
  const role = useBoRole();
  const [open, setOpen] = useRemembered('attention', true);
  // Re-read when the late threshold changes in Alerts & Timing.
  useSetting('t.floorCook');
  const items = useMemo(() => {
    const t0 = startOfToday();
    const lateMin = threshold('floorCook');
    const late = Number.isFinite(lateMin)
      ? [...orders, ...history]
          .filter((o) => !o.queueType && o.openedAt >= t0)
          .reduce(
            (n, o) => n + courseSummaries(o, cfg).filter((c) => c.kds && c.fired && c.ready && (c.ready - c.fired) / MINUTE >= lateMin).length,
            0,
          )
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
      waiversUsedUp: [...used.entries()]
        .filter(([, k]) => k >= sick.allow)
        .map(([rid, k]) => `${getResident(rid)?.name ?? 'A resident'} (${k} of ${sick.allow})`),
      chargesToReview: chargesToReview(charges).length,
      amountToReview: amountToReview(charges),
      recipesWaiting,
      homeOffice: isHomeOffice(role),
      venues: venueSettings.venues,
      menus: bo.menus,
      at: now(),
    });
  }, [marks, cfg, community, orders, history, charges, recipesWaiting, role, venueSettings, bo]);

  if (!items.length) return null;
  return (
    <section aria-label="Needs your attention" className={s.attention}>
      <button type="button" className={s.attToggle} aria-expanded={open} aria-controls="dash-attention" onClick={() => setOpen(!open)}>
        <BoCaption>Needs your attention · {items.length}</BoCaption>
        <ChevronDown size={14} aria-hidden className={cx(s.chev, open && s.chevOpen)} />
      </button>
      {open && (
        <ul id="dash-attention" className={s.attList}>
          {items.map((it) => {
            const Icon = ICONS[it.kind];
            // Never a link into a page this user can't open (HO Settings for a community user).
            const go = it.goto && canSee(it.goto.page, role) ? it.goto : undefined;
            return (
              <li key={it.kind} className={s.attRow}>
                <span className={cx(s.attIcon, s[`att_${it.tone}`])}>
                  <Icon size={14} aria-hidden />
                </span>
                <span className={s.attAction}>{it.action}</span>
                {go ? (
                  <button
                    type="button"
                    className={s.attLink}
                    onClick={() => (go.path ? navigate('backoffice', [go.page, ...go.path]) : goto(go.page))}
                  >
                    {go.label} <ChevronRight size={13} aria-hidden />
                  </button>
                ) : (
                  <span className={s.attNote}>{it.note}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
