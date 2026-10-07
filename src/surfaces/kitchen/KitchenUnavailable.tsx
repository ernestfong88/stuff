import { Printer as PrinterIcon } from 'lucide-react';
import { COMMUNITY_NAME } from '../../data';
import { CornerControls } from '../../shell/controls';
import { cx } from '../../ui';
import s from './KitchenUnavailable.module.css';
import type { Printer } from './venueSettings';

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
          : `${COMMUNITY_NAME} routes kitchen tickets to printers. Orders sent from any device print by station, exactly like today. Displays can be turned on later in the back office without changing how servers work.`}
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
    </div>
  );
}
