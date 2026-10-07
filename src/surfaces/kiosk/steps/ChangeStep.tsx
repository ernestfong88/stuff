import { getItem } from '../../../data';
import { rangeLabel } from '../../pud/service/windows';
import type { KioskState, Screen } from '../model/flow';
import { dishLongName, drinkName, type KioskMenu } from '../model/menu';
import { mainDishName } from '../model/order';
import { KButton } from '../ui/KButton';
import { Question, TileGrid } from '../ui/Layout';
import type { KioskFlow } from '../useKioskFlow';
import s from './ChangeStep.module.css';

interface Choice {
  label: string;
  value: string;
  to: Screen;
  patch: Partial<KioskState>;
}

/** "What would you like to change?": each answer, to change and come back to the review. */
export function ChangeStep({ flow, menu, today }: { flow: KioskFlow; menu: KioskMenu; today: boolean }) {
  const st = flow.s;
  const nameOf = (id: string | null) => (id ? dishLongName(getItem(id)?.name ?? '') : 'None');
  const drink = getItem(st.drink);
  const choices: Choice[] = [
    { label: 'When', value: st.win != null ? rangeLabel(st.win) + (today ? '' : ' tomorrow') : '', to: 'type', patch: {} },
    { label: 'Main dish', value: st.entree ? mainDishName(st) : 'None', to: 'entree', patch: { special: 0, others: false } },
    ...(menu.soups.length ? [{ label: 'Soup', value: nameOf(st.soup), to: 'soup' as const, patch: {} }] : []),
    { label: 'Drink', value: drink ? drinkName(drink) : 'None', to: 'drink', patch: {} },
    ...(menu.desserts.length ? [{ label: 'Dessert', value: nameOf(st.dessert), to: 'dessert' as const, patch: { moreDessert: false } }] : []),
    { label: 'Changes', value: st.note || 'None', to: 'notes', patch: {} },
    { label: 'Utensils', value: st.utensils ? 'Yes' : 'No', to: 'utensils', patch: {} },
  ];
  return (
    <div>
      <Question title="What would you like to change?" sub="Tap one. You'll come back to your order after." />
      <TileGrid min={300} gap={16}>
        {choices.map((c) => (
          <KButton key={c.label} column className={s.choice} onClick={() => flow.go(c.to, { edit: true, ...c.patch })}>
            <span className={s.label}>{c.label}</span>
            <span className={s.value}>{c.value}</span>
          </KButton>
        ))}
      </TileGrid>
    </div>
  );
}
