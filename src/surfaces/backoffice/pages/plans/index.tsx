import { AlertTriangle, Plus } from 'lucide-react';
import { uid } from '../../../../lib/id';
import { Button } from '../../../../ui';
import { BoCallout, BoPage, BoRow, BoSection, CrudTable, setBillingList, useBilling, useCrudEditing, type CrudColumn } from '../../kit';
import type { BoPageProps } from '../../nav';
import type { BoMealPlan } from '../../seed/billing';
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
export default function MealPlansPage({ goto }: BoPageProps) {
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
