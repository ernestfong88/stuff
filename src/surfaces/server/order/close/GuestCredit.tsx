import { dinerName } from '../../../../domain/orders';
import type { Diner, Resident } from '../../../../domain/types';
import { cx } from '../../../../ui';
import { hostPlan, type PlanUse } from './closeMath';
import s from './GuestCredit.module.css';

const meals = (k: number) => `${k} ${k === 1 ? 'meal' : 'meals'}`;

/**
 * Some communities let a resident put a guest's meal on their own meal
 * plan. It uses one of the host's meals and can be undone until the check
 * is closed.
 */
export function GuestCredit({
  diner,
  host,
  on,
  comped,
  enabled,
  use,
  onChange,
}: {
  diner: Diner;
  host: Resident | undefined;
  on: boolean;
  comped: boolean;
  /** The community allows it. */
  enabled: boolean;
  use: PlanUse | undefined;
  onChange: (on: boolean) => void;
}) {
  if (!diner.isGuest || !host || comped || !enabled) return null;
  const plan = hostPlan(host);
  if (!plan) return null;
  const hostFirst = host.name.split(' ')[0];
  const guest = dinerName(diner).split(' ')[0];
  const avail = plan.left - (use ? use.own + use.guests : 0);
  const none = !on && avail < 1;
  return (
    <div className={cx(s.box, on && s.on)}>
      <span className={s.text}>
        {on
          ? `${guest}'s meal is on ${hostFirst}'s meal plan. You can undo this until the check is closed.`
          : none
            ? `${hostFirst} has no meals left this period, so ${guest} can't go on ${hostFirst}'s meal plan.`
            : `Residents here can use their meal credits for guests. ${hostFirst} has ${meals(avail)} left after this table.`}
      </span>
      {on ? (
        <button className={s.undo} onClick={() => onChange(false)}>
          Undo
        </button>
      ) : (
        <button className={s.use} disabled={none} onClick={() => onChange(true)}>
          Use {hostFirst}'s meal credit
        </button>
      )}
    </div>
  );
}
