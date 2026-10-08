import { Plus } from 'lucide-react';
import { residents } from '../../../../data';
import { uid } from '../../../../lib/id';
import { Button, toast } from '../../../../ui';
import { BoCallout, BoPage, BoRow, BoSection, BoSelect, BoTabbedPage, CrudTable, setBillingList, useBilling, useCrudEditing, type CrudColumn } from '../../kit';
import { setDefaultPlan } from '../../kit/billingStore';
import { CARE_LEVEL_NAMES, careLevelsOf, defaultPlanFor } from '../../kit/planDefaults';
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
  return (
    <BoPage
      columns
      title="Meal Plans"
      actions={
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => editing.add({ id: uid('pl'), text: 'New plan', amt: 30, type: 'Monthly', isDefault: false, active: true })} disabled={editing.draft != null}>
          Add a plan
        </Button>
      }
    >
      <BoCallout tone="warning" title="Checkout doesn't use this list yet">
        The tablets still count meals with the standard plans. Changes here are saved and used once billing is connected.
      </BoCallout>
      <CrudTable noun="plan" rows={plans} setRows={(fn) => setBillingList('plans', fn)} columns={COLUMNS} editing={editing} showDefault={false} />
      <RetiredList noun="plan" rows={plans} setRows={(fn) => setBillingList('plans', fn)} detail={(p) => `${planAmount(p)}, ${p.type}`} />
      <LevelDefaults />
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

/** Default plan by care level: what a new resident starts on, picked per level. */
function LevelDefaults() {
  const { plans, defaultPlans } = useBilling();
  const live = plans.filter((p) => p.active);
  const levels = careLevelsOf([...residents.map((r) => r.level), ...Object.keys(defaultPlans ?? {})]);
  const pick = (level: string, planId: string) => {
    const before = defaultPlans?.[level] ?? '';
    setDefaultPlan(level, planId);
    const name = live.find((p) => p.id === planId)?.text;
    toast(name ? `New ${level} residents start on ${name}` : `${level} has no default plan now`, {
      tone: 'success',
      action: { label: 'Undo', onClick: () => setDefaultPlan(level, before) },
    });
  };
  return (
    <BoSection
      title="Default plan by care level"
      sub="The plan a new resident starts on for their care level, when the tablets' plan doesn't match one here. Changing it doesn't move anyone already on a plan."
    >
      {levels.map((level) => {
        const current = defaultPlanFor(level, defaultPlans, plans);
        const count = residents.filter((r) => r.level === level).length;
        const retired = !current && defaultPlans?.[level] ? plans.find((p) => p.id === defaultPlans[level]) : undefined;
        return (
          <BoRow
            key={level}
            label={
              <span>
                <span className={s.name}>{level}</span> <span className={s.levelName}>{CARE_LEVEL_NAMES[level] ?? ''}</span>
              </span>
            }
            hint={retired ? `${retired.text} was retired. Pick another plan.` : `${count} ${count === 1 ? 'resident' : 'residents'}`}
          >
            <BoSelect value={current?.id ?? ''} onChange={(e) => pick(level, e.target.value)} aria-label={`Default plan for ${level}`}>
              <option value="">No default</option>
              {live.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.text}
                </option>
              ))}
            </BoSelect>
          </BoRow>
        );
      })}
    </BoSection>
  );
}

const HUB_TABS = ['plans', 'counts', 'corkage'] as const;

/** Meal Plans: the lists billing uses, set up once and rarely changed. */
export default function BillingSetupPage(props: BoPageProps) {
  const [tab, go] = useHubTab('plans', HUB_TABS);
  return (
    <BoTabbedPage
      page="plans"
      title="Meal Plans"
      current={tab}
      onTab={go}
      tabs={[
        { id: 'plans', label: 'Plan types', render: () => <MealPlansTab {...props} /> },
        { id: 'counts', label: 'Meal counts', render: () => <MealCountsPage {...props} /> },
        { id: 'corkage', label: 'Corkage', render: () => <CorkageTab /> },
      ]}
    />
  );
}
