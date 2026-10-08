/**
 * Associate Meals: the standard associate menu (one chef special per meal
 * period from the day's menu cycle, the associate special of the week,
 * plus the standing choices, each a Recipe Book recipe; the soup is always
 * the soup of the day) and how associates plan meals by shift in the
 * Associate App. Edits go to the service settings, so every associate's
 * phone has them at once.
 */
import { useState } from 'react';
import { rooms } from '../../../data';
import { isoDate } from '../../../domain/pickup';
import { setSetting } from '../../../store/serviceConfig';
import { Button, Chip, Tabs, toast } from '../../../ui';
import { STANDING_SLOTS, addDays, menuWeek, weekStartOf, weekState, type WeekState } from '../../../domain/assocMeals/menu';
import { useAssocSettings } from '../../../domain/assocMeals/settings';
import { assocWindows, windowMinutes, type AssocMealName } from '../../../domain/assocMeals/windows';
import {
  daySoup,
  daySpecial,
  setDaySpecial,
  setDaySpecialCap,
  setStandingRecipe,
  setWeekScheduled,
  setWeekSpecial,
  standingRecipe,
  useAssocMenuSettings,
  weekSpecial,
  type AssocMenuSettings,
} from '../../../store/assocMenu';
import { recipesIn } from '../../../store/recipes';
import { BoPage, BoRow, BoSection, NumberBox } from '../kit';
import type { BoPageProps } from '../nav';
import { spansText } from './assocRanges';
import s from './assoc.module.css';

/** What each week state means for associates, in plain words. */
const WEEK_TEXT: Record<WeekState, string> = {
  active: 'Live. Associates are planning meals from it.',
  scheduled: 'Scheduled. Associates can plan it now.',
  draft: "Draft. Associates can't plan it until you schedule it.",
};

const shortDay = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const weekLabel = (monday: string) => `${shortDay(monday)} to ${shortDay(addDays(monday, 6))}`;
const weekday = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });

export default function Page({ goto }: BoPageProps) {
  const settings = useAssocSettings();
  const menuSettings = useAssocMenuSettings();
  const todayIso = isoDate(0);

  const rangesFor = (meal: AssocMealName) => spansText(assocWindows(settings.grid, meal, '', []).map((w) => windowMinutes(w) ?? 0));

  return (
    <BoPage title="Associate Meals">
      <MenuSection settings={menuSettings} todayIso={todayIso} />
      <StandingChoices settings={menuSettings} todayIso={todayIso} />

      <BoSection title="Ordering">
        <BoRow label="Associate meal venue" hint="Exactly one per community. Its pick up ranges decide when associates can pick up.">
          <select
            className={s.select}
            value={settings.venue}
            onChange={(e) => setSetting('am.venue', e.target.value)}
            aria-label="Associate meal venue"
          >
            {Object.entries(rooms).map(([id, r]) => (
              <option key={id} value={id}>
                {r.name}
              </option>
            ))}
          </select>
        </BoRow>
        <BoRow label="Ordering closes" hint="Minutes before a pick up range starts. NOC orders close this long before the dinner line closes.">
          <NumberBox
            value={settings.cutoffMin}
            min={0}
            unit="min"
            aria-label="Ordering closes, minutes before pickup"
            onChange={(v) => v != null && v >= 0 && setSetting('am.cut', Math.floor(v))}
          />
        </BoRow>
        <BoRow
          align="start"
          label="Pick up times"
          hint={
            <span className={s.ranges}>
              <span>Lunch: {rangesFor('Lunch')}</span>
              <span>Dinner: {rangesFor('Dinner')}</span>
              <span>Overnight (NOC): {rangesFor('NOC')}</span>
              <span>Associates pick a 15 minute range within these times.</span>
            </span>
          }
        >
          <Button size="sm" onClick={() => goto('svcWin')}>
            Change pick up times
          </Button>
        </BoRow>
        <p className={s.note}>
          Eligibility: a scheduled shift unlocks ordering (ADP identity, no PIN). Salaried and management associates can plan any day. A call-off in
          the Scheduling App cancels the order automatically. Coverage shifts are entered at the community tablet as Associate diners.
        </p>
      </BoSection>
    </BoPage>
  );
}

/** The chef's special for each meal period, day by day, from the menu cycle. */
function MenuSection({ settings, todayIso }: { settings: AssocMenuSettings; todayIso: string }) {
  const current = weekStartOf(todayIso);
  const [monday, setMonday] = useState(current);
  const week = menuWeek(monday, todayIso, settings.weeks);
  const state = weekState(week, monday, todayIso);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const isNext = monday !== current;

  const schedule = (sched: boolean) => {
    setWeekScheduled(monday, sched);
    if (!sched) toast(`Back to draft, associates can't plan ${weekLabel(monday)}`);
    else
      toast(
        todayIso >= monday
          ? `Live now, associates can plan ${weekLabel(monday)}`
          : `Scheduled, live ${shortDay(monday)}. Associates can plan it now.`,
        { tone: 'success' },
      );
  };

  return (
    <BoSection
      title="Associate menu"
      sub="Each lunch and dinner gets one chef special from that day's menu cycle, first come, first served up to the daily limit. Overnight (NOC) meals get the dinner special. The special of the week is on every day of its week."
      actions={
        <span className={s.status}>
          {!week.sched ? (
            <Button size="sm" variant="primary" onClick={() => schedule(true)}>
              Schedule {isNext ? 'next week' : 'this week'}
            </Button>
          ) : (
            state === 'scheduled' && (
              <Button size="sm" variant="ghost" onClick={() => schedule(false)}>
                Back to draft
              </Button>
            )
          )}
        </span>
      }
    >
      <div className={s.weekBar}>
        <Tabs
          variant="segmented"
          size="sm"
          aria-label="Week"
          value={isNext ? 'next' : 'this'}
          onChange={(w) => setMonday(w === 'next' ? addDays(current, 7) : current)}
          options={[
            { id: 'this', label: `This week · ${weekLabel(current)}` },
            { id: 'next', label: `Next week · ${weekLabel(addDays(current, 7))}` },
          ]}
        />
        <span className={s.weekText}>{WEEK_TEXT[state]}</span>
      </div>
      <WeekSpecialPicker monday={monday} settings={settings} />
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Day</th>
              <th>Lunch special</th>
              <th>Dinner special · and NOC</th>
            </tr>
          </thead>
          <tbody>
            {days.map((date) => (
              <tr key={date} className={date < todayIso ? s.pastRow : undefined}>
                <td className={s.week}>
                  <div className={s.weekName}>{date === todayIso ? 'Today' : weekday(date)}</div>
                  <div className={s.weekDates}>{shortDay(date)}</div>
                </td>
                <td>
                  <SpecialPicker date={date} period="Lunch" settings={settings} past={date < todayIso} />
                </td>
                <td>
                  <SpecialPicker date={date} period="Dinner" settings={settings} past={date < todayIso} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BoSection>
  );
}

function SpecialPicker({ date, period, settings, past }: { date: string; period: 'Lunch' | 'Dinner'; settings: AssocMenuSettings; past: boolean }) {
  const sp = daySpecial(date, period, settings);
  const label = `${period} special, ${shortDay(date)}`;
  if (past) return <span className={s.pastText}>{sp.recipe?.name ?? 'No special'}</span>;
  const value = sp.recipe?.id ?? '';
  const offCycle = sp.recipe && !sp.options.some((o) => o.recipeId === sp.recipe!.id);
  return (
    <div className={s.special}>
      <select
        className={s.select}
        aria-label={label}
        value={value}
        onChange={(e) => setDaySpecial(date, period, e.target.value || null)}
        disabled={!sp.options.length && !sp.recipe}
      >
        {sp.options.map((o) => (
          <option key={o.recipeId} value={o.recipeId}>
            {o.name}
          </option>
        ))}
        {offCycle && <option value={sp.recipe!.id}>{sp.recipe!.name}</option>}
        <option value="">No special</option>
      </select>
      {sp.recipe && (
        <NumberBox
          value={sp.cap}
          min={0}
          width={60}
          unit="a day"
          aria-label={`Associates who can have the ${label}`}
          onChange={(v) => v != null && v >= 0 && setDaySpecialCap(date, period, v)}
        />
      )}
      {!sp.options.length && !sp.recipe && <span className={s.hint}>No entrée special on the cycle</span>}
      {sp.chosen && sp.options.length > 0 && (
        <button className={s.link} onClick={() => setDaySpecial(date, period, undefined)}>
          Use the cycle's
        </button>
      )}
    </div>
  );
}

/** The associate special of the week: one recipe offered every day of the week, set per week. */
function WeekSpecialPicker({ monday, settings }: { monday: string; settings: AssocMenuSettings }) {
  const r = weekSpecial(monday, settings);
  const options = recipesIn('Entrees');
  return (
    <div className={s.weekSpecial}>
      <span className={s.weekSpecialLabel}>Special of the week</span>
      <div className={s.special}>
        <select
          className={s.select}
          aria-label={`Associate special of the week, ${weekLabel(monday)}`}
          value={r?.id ?? ''}
          onChange={(e) => setWeekSpecial(monday, e.target.value || undefined)}
        >
          <option value="">No special of the week</option>
          {r && !options.some((o) => o.id === r.id) && <option value={r.id}>{r.name}</option>}
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <span className={s.hint}>
          {r
            ? `On the associate menu every day, ${weekLabel(monday)}, after the chef's special.`
            : 'Pick a Recipe Book entrée to offer associates all week.'}
        </span>
      </div>
    </div>
  );
}

/** The standing choices, each made from a Recipe Book recipe the chef can swap; the soup is always the soup of the day. */
function StandingChoices({ settings, todayIso }: { settings: AssocMenuSettings; todayIso: string }) {
  const soup = daySoup(todayIso, 'Lunch', settings) ?? daySoup(todayIso, 'Dinner', settings);
  return (
    <BoSection
      title="Standing choices · always on"
      sub="Each choice is a Recipe Book recipe, so allergens and production counts match. Change the recipe when the sandwich of the month changes. The soup follows the dining room's soup of the day."
    >
      <div className={s.choices}>
        {STANDING_SLOTS.map((slot) => {
          if (slot.daySoup)
            return (
              <div key={slot.id} className={s.choice}>
                <div className={s.choiceHead}>
                  <span className={s.choiceName}>Soup of the day</span>
                  <Chip size="xs">Automatic</Chip>
                </div>
                <div className={s.choiceSub}>Soup: always the soup of the day (today: {soup?.name ?? 'no soup on the menu cycle'})</div>
                <div className={s.choiceMods}>{slot.mods.map((g) => `${g.group}: ${g.options.join(', ')}`).join(' · ')}</div>
              </div>
            );
          const r = standingRecipe(slot, settings);
          const options = recipesIn(slot.cat, slot.sub);
          const isStandard = !settings.std[slot.id] || settings.std[slot.id] === slot.defaultRecipe;
          return (
            <div key={slot.id} className={s.choice}>
              <div className={s.choiceHead}>
                <span className={s.choiceName}>{slot.withSoup ? 'Soup & Salad Combo' : slot.label[0].toUpperCase() + slot.label.slice(1)}</span>
                {isStandard ? (
                  <Chip size="xs">Standard</Chip>
                ) : (
                  <button className={s.link} onClick={() => setStandingRecipe(slot.id, undefined)}>
                    Back to standard
                  </button>
                )}
              </div>
              {slot.withSoup && <div className={s.choiceSub}>Cup of the soup of the day{soup ? ` (today: ${soup.name})` : ''}, plus</div>}
              <select
                className={s.select}
                value={r?.id ?? ''}
                aria-label={`Recipe for ${slot.label}`}
                onChange={(e) => setStandingRecipe(slot.id, e.target.value === slot.defaultRecipe ? undefined : e.target.value)}
              >
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              {r?.desc && <div className={s.choiceSub}>{r.desc}</div>}
              {!!r?.allergens?.length && (
                <div className={s.allergens}>
                  {r.allergens.map((a) => (
                    <Chip key={a} tone="danger" size="xs">
                      {a}
                    </Chip>
                  ))}
                </div>
              )}
              <div className={s.choiceMods}>{slot.mods.map((g) => `${g.group}: ${g.options.join(', ')}`).join(' · ')}</div>
            </div>
          );
        })}
      </div>
    </BoSection>
  );
}
