import { AlertTriangle, Plus } from 'lucide-react';
import { uid } from '../../../../lib/id';
import { Button } from '../../../../ui';
import { BoCallout, BoPage, BoRow, BoSection, BoTabbedPage, CrudTable, setBillingList, useBilling, useCrudEditing, type CrudColumn } from '../../kit';
import type { BoPageProps } from '../../nav';
import { CorkageTab } from '../fees';
import MealCountsPage from '../mealdrops';
import { useHubTab } from '../pageTab';
import type { BoMealPlan } from '../../seed/billing';
import { RetiredList } from '../RetiredList';
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
function MealPlansTab({ goto }: BoPageProps) {
  const { plans } = useBilling();
  const editing = useCrudEditing<BoMealPlan>();
  const defaults = plans.filter((p) => p.active && p.isDefault);
  return (
    <BoPage
      title="Meal Plans"
      sub="The plans a resident can be on: a number of meals a month or a day, or a dollar spend-down shared by a couple (Monthly $). Choose a resident's plan from their profile, under Residents."
      actions={
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => editing.add({ id: uid('pl'), text: 'New plan', amt: 30, type: 'Monthly', isDefault: false, active: true })} disabled={editing.draft != null}>
          Add a plan
        </Button>
      }
    >
      <BoCallout tone="warning" title="Checkout doesn't use this list yet">
        The tablets still count meals with the standard plans. Changes here are saved and used once billing is connected.
      </BoCallout>
      {defaults.length > 1 && (
        <BoCallout tone="warning">
          <span className={s.warn}>
            <AlertTriangle size={15} aria-hidden />
            <span>
              {defaults.length === 2 ? 'Two' : defaults.length} plans are marked default ({defaults.map((p) => p.text).join(' and ')}), carried over from the old system. Tick the one new residents should start on.
            </span>
          </span>
        </BoCallout>
      )}
      <CrudTable noun="plan" rows={plans} setRows={(fn) => setBillingList('plans', fn)} columns={COLUMNS} editing={editing} />
      <RetiredList noun="plan" rows={plans} setRows={(fn) => setBillingList('plans', fn)} detail={(p) => `${planAmount(p)}, ${p.type}`} />
      <BoSection title="Guest meals and what a credit covers" sub="Whether residents can use their meal credits for guests, and what one credit covers, are set in HO Settings.">
        <BoRow label="Meal credit rules">
          <Button size="sm" onClick={() => goto('credits')}>
            Open Meal Credits
          </Button>
        </BoRow>
      </BoSection>
    </BoPage>
  );
}

const HUB_TABS = ['plans', 'counts', 'corkage'] as const;

/** Billing Setup: the lists billing uses, set up once and rarely changed. */
export default function BillingSetupPage(props: BoPageProps) {
  const [tab, go] = useHubTab('plans', HUB_TABS);
  return (
    <BoTabbedPage
      page="plans"
      title="Billing Setup"
      sub="Set up once and rarely changed: the meal plans residents can be on, the meal counts servers pick at close, and corkage."
      current={tab}
      onTab={go}
      tabs={[
        { id: 'plans', label: 'Meal plans', render: () => <MealPlansTab {...props} /> },
        { id: 'counts', label: 'Meal counts', render: () => <MealCountsPage {...props} /> },
        { id: 'corkage', label: 'Corkage', render: () => <CorkageTab /> },
      ]}
    />
  );
}
