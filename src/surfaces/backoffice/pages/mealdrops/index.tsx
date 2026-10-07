import { AlertTriangle, Plus } from 'lucide-react';
import { uid } from '../../../../lib/id';
import { Button } from '../../../../ui';
import { BoCallout, BoPage, CrudTable, setBillingList, useBilling, useCrudEditing, type CrudColumn } from '../../kit';
import type { BoPageProps } from '../../nav';
import { MEAL_COUNT_FOR, type MealCountFor, type MealCountOption } from '../../seed/billing';
import { duplicateNames } from './duplicates';
import s from './mealdrops.module.css';

const COLUMNS: Array<CrudColumn<MealCountOption>> = [
  { key: 'text', header: 'Option', render: (m) => <span className={s.name}>{m.text}</span>, editor: { kind: 'text', key: 'text' } },
  {
    key: 'count',
    header: 'Counts as',
    width: 140,
    render: (m) => `${m.count} ${m.count === 1 ? 'meal' : 'meals'}`,
    editor: { kind: 'select', key: 'count', options: [0, 1, 2].map((n) => ({ value: n, label: String(n) })) },
  },
  { key: 'amt', header: 'Charge', width: 130, render: (m) => (m.amt > 0 ? `$${m.amt}` : '—'), editor: { kind: 'number', key: 'amt', prefix: '$', step: 0.5 } },
  {
    key: 'isGuest',
    header: 'Applies to',
    width: 160,
    render: (m) => MEAL_COUNT_FOR[m.isGuest],
    editor: { kind: 'select', key: 'isGuest', options: ([0, 1, 2] as MealCountFor[]).map((v) => ({ value: v, label: MEAL_COUNT_FOR[v] })) },
  },
];

/** Meal Counts: the options a server picks when closing a check. */
export default function MealCountsPage(_props: BoPageProps) {
  const { mealCounts } = useBilling();
  const editing = useCrudEditing<MealCountOption>();
  const dupes = duplicateNames(mealCounts.filter((m) => m.active).map((m) => m.text));
  return (
    <BoPage
      title="Meal Counts"
      sub="The options a server picks when closing a check: resident, guest and associate variants."
      actions={
        <Button
          variant="primary"
          icon={<Plus size={15} />}
          disabled={editing.draft != null}
          onClick={() => editing.add({ id: uid('md'), text: 'New option', count: 0, amt: 0, isGuest: 0, isDefault: false, active: true })}
        >
          Add
        </Button>
      }
    >
      {dupes.length > 0 && (
        <BoCallout tone="warning">
          <span className={s.warn}>
            <AlertTriangle size={15} aria-hidden />
            <span>
              Duplicate rows found ({dupes.map((g) => g.map((t) => `“${t}”`).join(' and ')).join('; ')}). The old editor could not edit a row, so typos were added again. Edit in place now and retire the duplicates.
            </span>
          </span>
        </BoCallout>
      )}
      <CrudTable noun="option" rows={mealCounts} setRows={(fn) => setBillingList('mealCounts', fn)} columns={COLUMNS} editing={editing} />
    </BoPage>
  );
}
