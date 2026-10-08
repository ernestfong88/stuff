import { now } from '../../../../lib/clock';
import { createSharedStore, useShared } from '../../../../lib/sharedStore';
import { Tabs } from '../../../../ui';
import { BoPage, useCommunity } from '../../kit';
import type { BoPageProps } from '../../nav';
import { Attention } from './Attention';
import type { RangeDays } from './model/periods';
import { useDashboardData } from './model/useDashboardData';
import { RevenueCard } from './RevenueCard';
import { SentimentCard } from './SentimentCard';
import { ServiceCard } from './ServiceCard';
import { TodayPanel } from './TodayPanel';
import s from './dashboard.module.css';

/** The chosen range stays while the back office is open, so coming back keeps it. */
const rangeStore = createSharedStore<RangeDays>(7);

/** Culinary Dashboard: what needs attention, then sentiment, service and revenue over 7, 14 or 28 days. */
export default function CulinaryDashboard({ goto }: BoPageProps) {
  const community = useCommunity();
  const n = useShared(rangeStore);
  const data = useDashboardData(n);
  return (
    <BoPage title="Culinary Dashboard" sub={`${community} · ${new Date(now()).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}>
      <Attention goto={goto} />
      <div className={s.range}>
        <span className={s.rangeLabel} aria-hidden>
          Last
        </span>
        <Tabs
          variant="segmented"
          size="sm"
          aria-label="Last 7, 14 or 28 days"
          value={String(n)}
          onChange={(v) => rangeStore.set(Number(v) as RangeDays)}
          options={[7, 14, 28].map((k) => ({ id: String(k), label: `${k} days` }))}
        />
      </div>
      <div className={s.cards}>
        <SentimentCard data={data} />
        <ServiceCard data={data} goto={goto} />
        <RevenueCard data={data} goto={goto} />
      </div>
      <TodayPanel data={data} goto={goto} />
    </BoPage>
  );
}
