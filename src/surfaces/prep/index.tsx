/**
 * Production Prep, on the kitchen tablet. Breakfast, lunch and dinner from
 * today up to a week ahead, opening on today's meal being served. Specials
 * come first, each with the amount the director set to make; until one is
 * set the card shows a forecast from the venue's usual covers. Below them is
 * the venue's own checklist from Back Office (Prep Checklist), showing only
 * the items for the meal on screen. Every check records who and when for
 * that venue, date and meal, so tomorrow starts fresh.
 *
 * The Cleaning log tab holds the kitchen's daily and weekly cleaning; each
 * task is signed off with the cook's PIN. The Temp log tab takes each
 * dish's temperature at today's meals, signed the same way.
 */
import { useState } from 'react';
import { ModeChip, TextZoom } from '../../shell/controls';
import { useSignedIn } from '../../shell/session';
import { isoDate } from '../../domain/pickup';
import { today } from '../../lib/clock';
import { cx, useNow } from '../../ui';
import {
  checkMark,
  checklistForMeal,
  getProductionVenue,
  preppedMark,
  specialAmount,
  specialsFor,
  useProduction,
  type ChecklistItem,
  type PrepSpecial,
} from '../../store/production';
import { useCleaning } from '../../store/cleaning';
import { mealLog, useTempLog } from '../../store/tempLog';
import { tempTotals, type TempMeal } from '../../domain/tempLog';
import { Checklist } from './Checklist';
import { CleaningLog } from './CleaningLog';
import { cleaningToday, mealAt, signature, tempOverdue } from './logic';
import { MealPicker, prepDayName, type MealSelection } from './MealPicker';
import { RecipeSheet } from './RecipeSheet';
import { SpecialCard } from './SpecialCard';
import { TempLog } from './TempLog';
import { VenueTabs } from './VenueTabs';
import { usePrepVenue } from './usePrepVenue';
import s from './Prep.module.css';

/** The kitchen sign-in has no name behind it, so work here is signed as the prep cook unless someone signed in. */
const PREP_COOK = 'L. Ortega';

type View = 'prep' | 'cleaning' | 'temp';

export default function ProductionPrep() {
  const state = useProduction();
  const nowMs = useNow(30_000);
  const signedIn = useSignedIn();
  const cook = signedIn ? signature(signedIn.name) : PREP_COOK;
  const [venueId, setVenueId] = usePrepVenue();
  const venue = getProductionVenue(venueId);
  const [sel, setSel] = useState<MealSelection>(() => ({ offset: 0, meal: mealAt(today().getHours()) }));
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const [view, setView] = useState<View>('prep');
  const cleaning = cleaningToday(useCleaning(), venueId, nowMs);
  const temps = useTempLog();
  const [tempMeal, setTempMeal] = useState<TempMeal>(() => mealAt(today().getHours()));

  const iso = isoDate(sel.offset);
  const meal = sel.meal;
  const dayName = prepDayName(new Date(nowMs), sel.offset);
  const when = `${dayName}'s ${meal.toLowerCase()}`;

  const specials = specialsFor(state, venueId, sel.offset, meal);
  const prepped = (sp: PrepSpecial) => preppedMark(state, venueId, iso, meal, sp.slot);
  // Specials still to prep first; prepped ones drop to the end as grey lines.
  const ordered = [...specials.filter((sp) => !prepped(sp)), ...specials.filter((sp) => prepped(sp))];
  const opened = specials.find((sp) => sp.slot === openSlot) ?? null;

  const groups = checklistForMeal(state, venueId, meal);
  const markOf = (item: ChecklistItem) => checkMark(state, venueId, iso, meal, item, nowMs);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const done = groups.reduce((n, g) => n + g.items.filter((it) => markOf(it)).length, 0);
  const preppedCount = specials.filter((sp) => prepped(sp)).length;
  // The header counts everything for the meal on screen: specials and checklist.
  const allDone = done + preppedCount;
  const allTotal = total + specials.length;
  const cleaningLate = cleaning.rows.filter((r) => r.status === 'overdue').length;
  const tempLate = tempOverdue(temps, venueId, nowMs);
  const tempCells = view === 'temp' ? mealLog(temps, venueId, isoDate(0), tempMeal, nowMs).dishes.flatMap((d) => d.cells) : [];
  const tempTaken = tempTotals(tempCells).taken;

  return (
    <div className={s.screen} data-prep={`${sel.offset}|${meal}`}>
      <header className={s.header}>
        <div className={s.topRow}>
          <h1 className={s.title}>Prep · Production plan</h1>
          <VenueTabs value={venueId} onChange={setVenueId} />
          <span className={s.right}>
            {view === 'prep' ? (
              <span
                className={allDone === allTotal && allTotal > 0 ? s.tallyDone : s.tally}
                aria-label={`${allDone} of ${allTotal} specials and checklist items done`}
                title="Specials prepped and checklist items done for the meal on screen"
              >
                {allDone} of {allTotal} <small>done</small>
              </span>
            ) : view === 'temp' ? (
              <span
                className={tempTaken === tempCells.length && tempCells.length > 0 ? s.tallyDone : s.tally}
                aria-label={`${tempTaken} of ${tempCells.length} temperature checks taken`}
                title="Temperature checks taken for the meal on screen"
              >
                {tempTaken} of {tempCells.length} <small>temps taken</small>
              </span>
            ) : (
              <span
                className={cleaning.done === cleaning.rows.length && cleaning.rows.length > 0 ? s.tallyDone : s.tally}
                aria-label={`${cleaning.done} of ${cleaning.rows.length} cleaning tasks signed off`}
              >
                {cleaning.done} of {cleaning.rows.length} <small>signed off</small>
              </span>
            )}
            <TextZoom tall />
            <ModeChip tall />
          </span>
        </div>
        <div className={s.subRow}>
          <div className={s.views} role="tablist" aria-label="Prep, cleaning or temperatures">
            <button role="tab" aria-selected={view === 'prep'} className={cx(s.view, view === 'prep' && s.viewOn)} onClick={() => setView('prep')}>
              Prep checklist
            </button>
            <button
              role="tab"
              aria-selected={view === 'cleaning'}
              className={cx(s.view, view === 'cleaning' && s.viewOn)}
              onClick={() => setView('cleaning')}
            >
              Cleaning log
              {cleaningLate > 0 && (
                <span className={s.viewLate} aria-label={`${cleaningLate} overdue`}>
                  {cleaningLate}
                </span>
              )}
            </button>
            <button role="tab" aria-selected={view === 'temp'} className={cx(s.view, view === 'temp' && s.viewOn)} onClick={() => setView('temp')}>
              Temp log
              {tempLate > 0 && (
                <span className={s.viewLate} aria-label={`${tempLate} overdue`}>
                  {tempLate}
                </span>
              )}
            </button>
          </div>
          {view === 'prep' && <MealPicker value={sel} onChange={setSel} base={new Date(nowMs)} />}
        </div>
      </header>

      {view === 'cleaning' ? (
        <main className={s.body}>
          <CleaningLog venueId={venueId} nowMs={nowMs} />
        </main>
      ) : view === 'temp' ? (
        <main className={s.body}>
          <TempLog venueId={venueId} meal={tempMeal} onMeal={setTempMeal} nowMs={nowMs} />
        </main>
      ) : (
        <main className={s.body}>
          <div className={s.sectionHead}>
            <h2 className={s.capSpecials}>{when} specials · make this many</h2>
            {specials.length > 0 && (
              <span className={s.checklistCount}>
                {preppedCount} of {specials.length} prepped
              </span>
            )}
          </div>
          {specials.length > 0 ? (
            <div className={s.specials}>
              {ordered.map((sp) => (
                <SpecialCard
                  key={sp.slot}
                  special={sp}
                  amount={specialAmount(state, venueId, iso, meal, sp)}
                  prepped={prepped(sp)}
                  venueId={venueId}
                  iso={iso}
                  meal={meal}
                  cook={cook}
                  onOpen={(x) => setOpenSlot(x.slot)}
                />
              ))}
            </div>
          ) : (
            <p className={s.empty}>
              {venue.menu === 'cycle'
                ? `No ${meal.toLowerCase()} specials on the cycle for ${sel.offset < 2 ? dayName.toLowerCase() : dayName}.`
                : `${venue.fullName} serves the same menu every day, so there are no specials to prep.`}
            </p>
          )}

          <div className={s.checklistHead}>
            <h2 className={s.capChecklist}>{when} checklist</h2>
            {total > 0 && (
              <span className={s.checklistCount}>
                {done} of {total} done
              </span>
            )}
          </div>
          {groups.length > 0 ? (
            <Checklist groups={groups} markOf={markOf} venueId={venueId} iso={iso} meal={meal} cook={cook} />
          ) : (
            <p className={s.empty}>Nothing on the checklist for {meal.toLowerCase()}. Back Office sets it up under Prep Checklist.</p>
          )}
        </main>
      )}

      <RecipeSheet special={opened} make={opened ? specialAmount(state, venueId, iso, meal, opened).n : 0} onClose={() => setOpenSlot(null)} />
    </div>
  );
}
