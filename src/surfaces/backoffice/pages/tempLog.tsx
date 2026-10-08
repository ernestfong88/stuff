/**
 * Temperature Log: the food temperatures each kitchen took on the prep
 * tablet, a day at a time. Log: every dish at each meal with its readings
 * (who and when), out-of-range readings with the action taken, missed
 * checks and any extra checks the cooks added; printable. Targets: whether each dish on the menu is held hot or
 * cold (or not logged), as the menu suggests or as set here.
 */
import { useState } from 'react';
import { Printer } from 'lucide-react';
import { addDays, isoOf } from '../../../domain/cleaning';
import {
  ACTION_LABEL,
  CHECK_INTERVAL_MIN,
  COLD_HOLD_F,
  COOK_LABEL,
  COOK_MIN_F,
  EXTRA_REASON_LABEL,
  HOLD_LABEL,
  HOT_HOLD_F,
  SERVICE,
  TEMP_MEALS,
  clockLabel,
  formatTemp,
  inRange,
  mealChecks,
  targetFor,
  tempTotals,
  type HoldType,
  type TempCell,
  type TempExtraCell,
} from '../../../domain/tempLog';
import { formatTime } from '../../../lib/format';
import { PRODUCTION_VENUES, getProductionVenue } from '../../../store/production';
import { mealLog, menuDishesAround, setDishHold, useTempLog, type TempDish } from '../../../store/tempLog';
import { Button, Tabs, cx, toast, useNow } from '../../../ui';
import { BoCallout, BoPage, BoSection, BoSelect, BoStatRow, BoStatTile } from '../kit';
import type { BoPageProps } from '../nav';
import { usePageTab } from './pageTab';
import { dayName, holdRule, printTempLog } from './tempLogPrint';
import s from './tempLog.module.css';

const TABS = ['log', 'targets'] as const;
/** How many days back the log goes. */
const DAYS_BACK = 6;
/** Targets lists the dishes served this many days either side of today. */
const TARGET_DAYS = 7;

export default function Page(_props: BoPageProps) {
  const state = useTempLog();
  const [tab, setTab] = usePageTab('tempLog', TABS);
  const [venueId, setVenueId] = useState(PRODUCTION_VENUES[0].id);
  const [back, setBack] = useState('0');
  const nowMs = useNow(60_000);
  const venue = getProductionVenue(venueId);
  const todayIso = isoOf(new Date(nowMs));
  const iso = addDays(todayIso, -+back);
  const logs = TEMP_MEALS.map((m) => mealLog(state, venueId, iso, m, nowMs));
  const totals = tempTotals(
    logs.flatMap((l) => l.dishes.flatMap((d) => d.cells)),
    logs.flatMap((l) => l.dishes.flatMap((d) => d.extras)),
  );
  const label = dayName(iso, +back);

  return (
    <BoPage title="Temperature Log">
      <Tabs
        variant="underline"
        aria-label="Temperature log sections"
        value={tab}
        onChange={setTab}
        options={[
          { id: 'log', label: 'Log', count: totals.out + totals.missed + totals.overdue || undefined, countTone: 'danger' },
          { id: 'targets', label: 'Targets' },
        ]}
      />
      <Tabs
        variant="segmented"
        aria-label="Kitchen"
        value={venueId}
        onChange={setVenueId}
        options={PRODUCTION_VENUES.map((v) => ({ id: v.id, label: v.name }))}
        className={s.venues}
      />
      {tab === 'log' ? (
        <>
          <div className={s.dayBar}>
            <Tabs
              variant="segmented"
              aria-label="Day"
              value={back}
              onChange={setBack}
              options={Array.from({ length: DAYS_BACK + 1 }, (_, i) => ({ id: String(i), label: dayName(addDays(todayIso, -i), i) }))}
            />
            <Button icon={<Printer size={15} />} onClick={() => printTempLog(venue.fullName, label, iso, logs)}>
              Print this day
            </Button>
          </div>
          <BoStatRow>
            <BoStatTile value={totals.taken} label="readings taken" tone="green" />
            <BoStatTile value={totals.out} label="out of range" tone={totals.out ? 'danger' : undefined} />
            <BoStatTile
              value={totals.missed + totals.overdue}
              label="missed or overdue"
              tone={totals.missed + totals.overdue ? 'danger' : undefined}
            />
            {+back === 0 && <BoStatTile value={totals.open} label="due now" />}
          </BoStatRow>
          {logs.map((log) => {
            const anyExtra = log.dishes.some((d) => d.extras.length);
            return log.dishes.length ? (
              <BoSection
                key={log.meal}
                flush
                title={log.meal}
                sub={`${clockLabel(SERVICE[log.meal].start)} to ${clockLabel(SERVICE[log.meal].end)} · on the line, then every ${CHECK_INTERVAL_MIN / 60} hours`}
              >
                <div className={s.scroll}>
                  <table className={s.log}>
                    <thead>
                      <tr>
                        <th className={s.dishCol}>Dish</th>
                        {mealChecks(log.meal).map((c) => (
                          <th key={c.id}>
                            {c.label} <span className={s.due}>{clockLabel(c.due)}</span>
                          </th>
                        ))}
                        {anyExtra && <th>Extra checks</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {log.dishes.map(({ dish, cells, extras }) => (
                        <tr key={dish.key}>
                          <th scope="row" className={s.dishCol}>
                            <span className={s.dishName}>{dish.name}</span>
                            <span className={cx(s.dishMeta, dish.hold === 'hot' ? s.hot : s.cold)}>
                              {holdRule(dish.hold, dish.cook)}
                              {dish.added && ' · added on the tablet'}
                            </span>
                          </th>
                          {cells.map((c) => (
                            <td key={c.check.id} className={cx(c.status === 'out' && s.outCell)}>
                              <Cell cell={c} />
                            </td>
                          ))}
                          {anyExtra && (
                            <td>
                              {extras.length ? extras.map((x) => <Extra key={x.reading.id} x={x} />) : <span className={s.state}>None</span>}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </BoSection>
            ) : (
              <BoSection key={log.meal} title={log.meal}>
                <p className={s.empty}>Nothing hot or cold on the menu.</p>
              </BoSection>
            );
          })}
        </>
      ) : (
        <TargetsTab venueId={venueId} todayIso={todayIso} />
      )}
    </BoPage>
  );
}

function Cell({ cell }: { cell: TempCell }) {
  const { reading, status, check } = cell;
  if (reading) {
    const fixed = reading.recheckF != null && inRange(cell.target, reading.recheckF);
    return (
      <span className={s.reading}>
        <span className={cx(s.temp, status === 'out' && s.tempOut)}>{formatTemp(reading.tempF)}</span>
        <span className={s.at}>
          {reading.by} · {formatTime(reading.at)}
        </span>
        {status === 'out' && (
          <span className={s.action}>
            {reading.action ? ACTION_LABEL[reading.action] : 'No action recorded'}
            {reading.recheckF != null && <span className={cx(fixed ? s.recheckOk : s.tempOut)}> · recheck {formatTemp(reading.recheckF)}</span>}
          </span>
        )}
      </span>
    );
  }
  if (status === 'missed') return <span className={s.missed}>Missed</span>;
  if (status === 'overdue') return <span className={s.missed}>Overdue</span>;
  if (status === 'due') return <span className={s.state}>Due now</span>;
  return <span className={s.state}>{check.kind === 'line' ? 'Not yet' : `At ${clockLabel(check.due)}`}</span>;
}

/** An extra check: the temperature, who, when and why, and what was done if it was out of range. */
function Extra({ x }: { x: TempExtraCell }) {
  const { reading, status, target } = x;
  const fixed = reading.recheckF != null && inRange(target, reading.recheckF);
  return (
    <span className={cx(s.reading, s.extra, status === 'out' && s.extraOut)}>
      <span className={cx(s.temp, status === 'out' && s.tempOut)}>
        {formatTemp(reading.tempF)} <span className={s.reason}>{reading.reason ? EXTRA_REASON_LABEL[reading.reason] : 'Extra'}</span>
      </span>
      <span className={s.at}>
        {reading.by} · {formatTime(reading.at)}
      </span>
      {status === 'out' && (
        <span className={s.action}>
          {reading.action ? ACTION_LABEL[reading.action] : 'No action recorded'}
          {reading.recheckF != null && <span className={cx(fixed ? s.recheckOk : s.tempOut)}> · recheck {formatTemp(reading.recheckF)}</span>}
        </span>
      )}
    </span>
  );
}

// ─── Targets ─────────────────────────────────────────────────────────────

function TargetsTab({ venueId, todayIso }: { venueId: string; todayIso: string }) {
  const state = useTempLog();
  const dishes = menuDishesAround(state, venueId, todayIso, TARGET_DAYS);
  const set = (d: TempDish, hold: HoldType) => {
    setDishHold(venueId, d.name, hold === d.inferred ? null : hold);
    toast(`${d.name}: ${HOLD_LABEL[hold].toLowerCase()}`);
  };
  return (
    <>
      <BoCallout title="The rules">
        Hot food reaches its cooking temperature when it goes on the line ({COOK_MIN_F.poultry}°F poultry and anything reheated, {COOK_MIN_F.ground}°F
        ground meat and eggs, {COOK_MIN_F.whole}°F fish and whole cuts, {HOT_HOLD_F}°F everything else), then stays at {HOT_HOLD_F}°F or above. Cold
        food stays at {COLD_HOLD_F}°F or below. Checked on the line and every {CHECK_INTERVAL_MIN / 60} hours of service.
      </BoCallout>
      <BoSection
        title="Dishes on the menu"
        sub="Served the week before and after today. How each is held is worked out from its name and category; change it here."
      >
        {dishes.length === 0 && <p className={s.empty}>Nothing on the menu.</p>}
        {dishes.map((d) => (
          <div key={d.key} className={s.row}>
            <span className={s.targetText}>
              <span className={s.dishName}>{d.name}</span>
              <span className={s.dishMeta}>
                {d.category}
                {d.hold === 'hot' && ` · ${COOK_LABEL[d.cook]}`} · {targetLine(d)}
              </span>
            </span>
            {d.hold !== d.inferred && <span className={s.changed}>Set here · menu says {HOLD_LABEL[d.inferred].toLowerCase()}</span>}
            <BoSelect className={s.hold} value={d.hold} aria-label={`How ${d.name} is held`} onChange={(e) => set(d, e.target.value as HoldType)}>
              {(['hot', 'cold', 'none'] as const).map((h) => (
                <option key={h} value={h}>
                  {HOLD_LABEL[h]}
                </option>
              ))}
            </BoSelect>
          </div>
        ))}
      </BoSection>
    </>
  );
}

function targetLine(d: TempDish): string {
  if (d.hold === 'none') return 'no temperature kept';
  if (d.hold === 'cold') return targetFor('cold', 'hold').label;
  const line = targetFor('hot', 'line', d.cook);
  return line.min === HOT_HOLD_F ? `${line.label}` : `${line.label} on the line, ${targetFor('hot', 'hold').label} held`;
}
