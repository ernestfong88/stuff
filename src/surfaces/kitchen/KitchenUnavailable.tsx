import { Printer as PrinterIcon } from 'lucide-react';
import { COMMUNITY_NAME } from '../../data';
import { CornerControls } from '../../shell/controls';
import { cx } from '../../ui';
import { formatTime } from '../../lib/format';
import { useKitchenPrintLog } from '../../store/kitchenPrint';
import s from './KitchenUnavailable.module.css';
import type { Printer } from '../../store/venueSettings';

/**
 * What a kitchen display shows where the community does not run one:
 * tickets print by station instead ("printers"), or the cook line runs
 * without an expo station ("cook only", on the expo screen).
 */
export function KitchenUnavailable({ surface, cookOnly, printers }: { surface: string; cookOnly?: boolean; printers: Printer[] }) {
  return (
    <div className={s.wrap}>
      <CornerControls dark />
      <span className={s.icon}>
        <PrinterIcon size={30} strokeWidth={1.5} />
      </span>
      <h1 className={s.title}>{cookOnly ? 'No expo display at this community' : `No ${surface} display at this community`}</h1>
      <p className={s.body}>
        {cookOnly
          ? `${COMMUNITY_NAME} runs a cook display without an expo station. The cook line owns both bumps: Ready, then Clear.`
          : `${COMMUNITY_NAME} routes kitchen tickets to printers. Orders sent from any device (server tablets, the kiosk, scheduled pick ups when they fire) print by station. Displays can be turned on later in the back office without changing how servers work.`}
      </p>
      {!cookOnly && printers.length > 0 && (
        <ul className={s.printers} aria-label="Kitchen printers">
          {printers.map((p) => (
            <li key={p.id} className={s.printer}>
              <PrinterIcon size={14} />
              {p.name}
              <span className={cx(s.dot, p.reachable ? s.ok : s.down)} />
              <span className="sr-only">{p.reachable ? 'online' : 'not reachable'}</span>
            </li>
          ))}
        </ul>
      )}
      {!cookOnly && <RecentPrints />}
    </div>
  );
}

/** The last tickets the printers got, so the kitchen can check one that didn't come out. */
function RecentPrints() {
  const log = useKitchenPrintLog().slice(0, 6);
  if (!log.length) return null;
  return (
    <section className={s.log} aria-label="Last tickets printed">
      <h2 className={s.logTitle}>Last tickets printed</h2>
      <ul className={s.logList}>
        {log.map((p) => (
          <li key={p.id} className={cx(s.logRow, (p.down.length > 0 || p.unprinted.length > 0) && s.logWarn)}>
            <span className={s.logTime}>{formatTime(p.at)}</span>
            <span className={s.logLabel}>{p.label}</span>
            <span className={s.logWhere}>
              {p.printers.length ? p.printers.join(', ') : 'Nothing printed'}
              {p.down.length > 0 && ` · ${p.down.join(', ')} can't be reached`}
              {p.unprinted.length > 0 && ` · no printer takes ${p.unprinted.join(', ')}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
