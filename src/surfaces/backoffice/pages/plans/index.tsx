import { AlertTriangle, Plus } from 'lucide-react';
import { uid } from '../../../../lib/id';
import { Button, Toggle } from '../../../../ui';
import { BoCallout, BoPage, BoRow, BoSection, CrudTable, setBillingList, useBilling, useCommunity, useCrudEditing, type CrudColumn } from '../../kit';
import type { BoPageProps } from '../../nav';
import { ALL_COMMUNITIES } from '../../seed/shell';
import type { BoMealPlan } from '../../seed/billing';
import { communitiesWithGuestCredit, guestCreditOn, setGuestCredit, useGuestCreditSettings } from './guestCredit';
import s from './plans.module.css';

const PLAN_TYPES = [
  { value: 'Monthly', label: 'Monthly (count)' },
  { value: 'Daily', label: 'Daily (count)' },
  { value: 'Monthly $', label: 'Monthly $ (spend-down)' },
];

/** "30 meals" for a count plan, "$400" for a spend-down. */
export function planAmount(p: Pick<BoMealPlan, 'amt' | 'type'>): string {
  return p.type === 'Monthly $' ? `$${p.amt}` : `${p.amt} ${p.amt === 1 ? 'meal' : 'meals'}`;
}

const COLUMNS: Array<CrudColumn<BoMealPlan>> = [
  { key: 'text', header: 'Plan', render: (p) => <span className={s.name}>{p.text}</span>, editor: { kind: 'text', key: 'text' } },
  { key: 'amt', header: 'Amount', width: 160, render: planAmount, editor: { kind: 'number', key: 'amt' } },
  { key: 'type', header: 'Type', width: 220, render: (p) => p.type, editor: { kind: 'select', key: 'type', options: PLAN_TYPES } },
];

/** Meal Plans: the plan types the charge engine uses, and guest meal credits. */
export default function MealPlansPage(_props: BoPageProps) {
  const { plans } = useBilling();
  const editing = useCrudEditing<BoMealPlan>();
  const defaults = plans.filter((p) => p.active && p.isDefault);
  return (
    <BoPage
      title="Meal Plans"
      sub="The plan type drives the charge engine: meal counts (Monthly or Daily) or a dollar spend-down pooled across a couple (Monthly $)."
      actions={
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => editing.add({ id: uid('pl'), text: 'New plan', amt: 30, type: 'Monthly', isDefault: false, active: true })} disabled={editing.draft != null}>
          Add
        </Button>
      }
    >
      {defaults.length > 1 && (
        <BoCallout tone="warning">
          <span className={s.warn}>
            <AlertTriangle size={15} aria-hidden />
            <span>
              {defaults.length === 2 ? 'Two' : defaults.length} plans are marked default ({defaults.map((p) => p.text).join(' and ')}), carried over from the old system. Pick one; from now on only one plan can be the default.
            </span>
          </span>
        </BoCallout>
      )}
      <CrudTable noun="plan" rows={plans} setRows={(fn) => setBillingList('plans', fn)} columns={COLUMNS} editing={editing} />
      <GuestMeals />
    </BoPage>
  );
}

function GuestMeals() {
  const community = useCommunity();
  const settings = useGuestCreditSettings();
  const on = guestCreditOn(settings, community);
  const everywhere = communitiesWithGuestCredit(settings, ALL_COMMUNITIES);
  return (
    <BoSection title="Guest meals" sub={`Some communities let a resident put a guest's meal on their own meal plan. This setting is for ${community}.`}>
      <BoRow
        label="Residents can use their meal credits for guests"
        hint={
          on
            ? "On: at close the server can put a guest's meal on the host's plan. It uses one of the host's meals."
            : "Off: guests pay à la carte on the host's account. Comping a guest still needs a manager PIN."
        }
      >
        <Toggle checked={on} onChange={(v) => setGuestCredit(community, v)} label={<span className="sr-only">Residents can use their meal credits for guests at {community}</span>} />
      </BoRow>
      <p className={s.foot}>{everywhere.length ? `On at ${everywhere.join(', ')}.` : 'Off at every community.'}</p>
    </BoSection>
  );
}
