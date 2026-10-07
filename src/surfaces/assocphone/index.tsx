/**
 * Associate Phone: associates plan the meal for each scheduled shift, pick
 * it up from the associate venue around their break, and see what they had.
 * Their plans show on the Manager's Associates tab and at Expo, through the
 * dining store's associate meals.
 */
import { useState } from 'react';
import { COMMUNITY_NAME } from '../../data';
import { isoDate } from '../../domain/pickup';
import { useDining } from '../../store/dining';
import { Toggle, toast, useNow } from '../../ui';
import { MealHistory } from './MealHistory';
import { cancelMeal, mealsOf, pastMeals, planMeal, plannedOn, type NewMeal } from '../../domain/assocMeals/meals';
import { closedReason } from '../../domain/assocMeals/menu';
import { orderingOver } from '../../domain/assocMeals/planning';
import { useAssocSettings } from '../../domain/assocMeals/settings';
import { DEMO_ASSOCIATE, dayName, upcomingShifts, type Shift } from '../../domain/assocMeals/shifts';
import { windowTag } from '../../domain/assocMeals/windows';
import { PhoneFrame } from './PhoneFrame';
import { PlanMeal } from './PlanMeal';
import { ShiftCard } from './ShiftCard';
import s from './AssociatePhone.module.css';

export default function AssociatePhone() {
  const { assocOrders, setAssocOrders, orders, history } = useDining();
  const settings = useAssocSettings();
  const nowMs = useNow(30_000);
  const [anyTime, setAnyTime] = useState(false);
  const [planning, setPlanning] = useState<Shift | null>(null);
  const todayIso = isoDate(0);
  const who = DEMO_ASSOCIATE.name;
  const mine = mealsOf(assocOrders, who);
  const shifts = upcomingShifts(todayIso);

  const plan = (meal: NewMeal) => {
    setAssocOrders((all) => planMeal(all, meal, who, nowMs));
    setPlanning(null);
    const day = dayName(meal.date, todayIso);
    toast(`${meal.item} planned for ${day === 'Today' || day === 'Tomorrow' ? day.toLowerCase() : day} · ${windowTag(meal.window)}`, { tone: 'success' });
  };

  const cancel = (id: string) => {
    const before = assocOrders.find((m) => m.id === id);
    setAssocOrders((all) => cancelMeal(all, id, who, nowMs));
    if (before) {
      toast(`${before.item} cancelled`, {
        action: { label: 'Undo', onClick: () => setAssocOrders((all) => all.map((m) => (m.id === id ? before : m))) },
      });
    }
  };

  if (planning) {
    return (
      <PhoneFrame>
        <PlanMeal
          shift={planning}
          anyTime={anyTime}
          todayIso={todayIso}
          settings={settings}
          meals={assocOrders}
          orders={[...orders, ...history]}
          onBack={() => setPlanning(null)}
          onPlan={plan}
        />
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <header className={s.head}>
        <div className={s.eyebrow}>Associate App · Meals</div>
        <div className={s.who}>
          <h1 className={s.name}>{who}</h1>
          <span className={s.role}>
            {DEMO_ASSOCIATE.role} · {COMMUNITY_NAME}
          </span>
        </div>
        <div className={s.toggle}>
          <Toggle checked={anyTime} onChange={setAnyTime} label="Salaried / manager view: plan any day, any time" />
        </div>
      </header>
      <main className={s.body}>
        <h2 className={s.capShifts}>{anyTime ? 'Plan a meal · any day' : 'Upcoming shifts · plan your meal'}</h2>
        <div className={s.shifts}>
          {shifts.map((shift) => (
            <ShiftCard
              key={shift.date}
              shift={shift}
              dayName={dayName(shift.date, todayIso)}
              anyTime={anyTime}
              planned={plannedOn(mine, shift.date)}
              closed={closedReason(shift.date, todayIso, settings.weeks)}
              orderingOver={orderingOver(shift, anyTime, settings, assocOrders, nowMs)}
              onPlan={() => setPlanning(shift)}
              onCancel={(m) => cancel(m.id)}
            />
          ))}
        </div>
        <h2 className={s.capHistory}>My meals · history</h2>
        <MealHistory meals={pastMeals(mine)} todayIso={todayIso} />
      </main>
    </PhoneFrame>
  );
}
