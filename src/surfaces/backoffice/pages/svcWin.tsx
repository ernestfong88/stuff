/**
 * Pick Up Windows. Every booking is a 15 minute range such as 5:00 to
 * 5:15 PM. Back Office ticks the ranges each venue offers for resident pick
 * up, associate pick up and delivery, caps how many orders a range takes,
 * and sets when ordering closes and how early the kitchen fires.
 */
import { useState } from 'react';
import { rooms } from '../../../data';
import { isoDate, pickupLeadMinutes, ticketAverage } from '../../../domain/pickup';
import type { MealName } from '../../../domain/types';
import { now } from '../../../lib/clock';
import { updateConfig, useConfig } from '../../../store/config';
import { useAssocOrders, useDiningHistory, useDiningOrders } from '../../../store/dining';
import { setSetting } from '../../../store/serviceConfig';
import { Button, Tabs, Toggle, cx, toast } from '../../../ui';
import { useServiceSettings, windowSettings } from '../../../domain/pickupService/settings';
import {
  ASSOC_ROOM,
  MEAL_WINDOWS,
  NOC_DAY,
  WINDOW_DAY,
  WINDOW_TYPES,
  mealWindows,
  minuteLabel,
  nocMadeBy,
  nocStarts,
  rangeLabel,
  windowCaps,
  windowCutoff,
  windowStarts,
  windowTypeOn,
  windowUsage,
  type WindowCaps,
  type WindowSettings,
  type WindowType,
} from '../../../domain/pickupService/windows';
import { BoPage, BoRow, BoSection, BoTabbedPage, NumberBox } from '../kit';
import type { BoPageProps } from '../nav';
import { ConfirmReset } from './ConfirmReset';
import { useHubTab, usePageTab } from './pageTab';
import DeliveryFeesTab from './fees';
import { spansText } from './svcWinSteps';
import { SvcWinSetup, type SetupSections } from './SvcWinSetup';
import s from './svcWin.module.css';

const TABS = ['ranges', 'capacity', 'timing'] as const;
type WinTab = (typeof TABS)[number];
const TAB_LABELS: Record<WinTab, string> = { ranges: 'Ranges offered', capacity: 'How many per range', timing: 'Timing' };

const venueOptions = Object.entries(rooms).map(([id, r]) => ({ id, label: r.name }));
const hourLabel = (h: number) => `${h % 12 || 12} ${h % 24 >= 12 ? 'PM' : 'AM'}`;

function VenueTabs({ venue, onChange }: { venue: string; onChange: (v: string) => void }) {
  return <Tabs aria-label="Venue" size="sm" variant="segmented" value={venue} onChange={onChange} options={venueOptions} />;
}

/** Which order types book a range at all. `plain` (the step-by-step setup) drops the note. */
function OrderTypes({ win, plain }: { win: WindowSettings; plain?: boolean }) {
  return (
    <BoSection
      title={plain ? 'Book a 15 minute range' : 'Order types'}
      sub={plain ? undefined : 'Turn ranges off and staff take the order as soon as it is ready instead. Associate meals always book a range.'}
    >
      {WINDOW_TYPES.map((t) => (
        <BoRow key={t.id} label={t.label} hint={t.hint}>
          {t.id === 'assoc' ? (
            <span className={s.muted}>Always on</span>
          ) : (
            <Toggle
              checked={windowTypeOn(win, t.id)}
              label="Use ranges"
              onChange={(v) => {
                setSetting(`win.types.${t.id}.on`, v ? undefined : false);
                toast(v ? `${t.label} books a 15 minute range` : `${t.label} is as soon as it is ready`);
              }}
            />
          )}
        </BoRow>
      ))}
    </BoSection>
  );
}

/** One quarter-hour cell: tap to offer or stop offering that range. */
function Cell({ on, label, start, noc, onClick }: { on: boolean; label: string; start: number; noc?: boolean; onClick: () => void }) {
  return (
    <button
      className={cx(s.cell, on && (noc ? s.cellNoc : s.cellOn))}
      aria-pressed={on}
      aria-label={`${label} ${rangeLabel(start)}`}
      title={rangeLabel(start)}
      onClick={onClick}
    >
      :{String(start % 60).padStart(2, '0')}
    </button>
  );
}

/** Ranges the settings would offer with nothing changed, so a meal switched back on gets its usual hours. */
const NO_CHANGES = {} as WindowSettings;

/**
 * The ranges each venue offers, one order type at a time. Each meal is one
 * line: on or off, from and until. Fine-tune opens that meal's quarter hours
 * for gaps.
 */
function RangesOffered({ win, venue, setVenue, plain }: { win: WindowSettings; venue: string; setVenue: (v: string) => void; plain?: boolean }) {
  const [type, setType] = useState<WindowType>('pickup');
  const label = WINDOW_TYPES.find((t) => t.id === type)?.label ?? '';
  const starts = windowStarts(win, venue, type);
  const noc = nocStarts(win, venue);
  const put = (key: WindowType | 'noc', list: number[] | undefined) => setSetting(`win.grid.${venue}.${key}`, list);
  /** Replace one meal's part of the list, with Undo. */
  const setMeal = (key: WindowType | 'noc', all: number[], bounds: readonly [number, number], next: number[], what: string) => {
    const before = win.grid?.[venue]?.[key];
    put(
      key,
      [...all.filter((x) => x < bounds[0] || x >= bounds[1]), ...next].sort((x, y) => x - y),
    );
    toast(what, { action: { label: 'Undo', onClick: () => put(key, before) } });
  };
  const meals = Object.keys(MEAL_WINDOWS) as MealName[];
  return (
    <BoSection title={plain ? undefined : 'Ranges offered'} actions={<VenueTabs venue={venue} onChange={setVenue} />}>
      <div className={s.typeBar}>
        <Tabs
          aria-label="Order type"
          size="sm"
          variant="segmented"
          value={type}
          onChange={setType}
          options={WINDOW_TYPES.map((t) => ({
            id: t.id,
            label: t.label,
            count: windowStarts(win, venue, t.id).length + (t.id === 'assoc' ? noc.length : 0),
          }))}
        />
        <button
          className={s.link}
          onClick={() => setMeal(type, starts, WINDOW_DAY, windowStarts(NO_CHANGES, venue, type), `${label}: back to the usual meal hours`)}
        >
          Back to meal hours
        </button>
      </div>
      {!windowTypeOn(win, type) && (
        <p className={s.offNote}>{label} doesn't book ranges at the moment (see Order types), so these only apply once it does.</p>
      )}
      <div className={s.meals}>
        {meals.map((m) => (
          <MealRanges
            key={m}
            meal={m}
            label={label}
            bounds={MEAL_WINDOWS[m]}
            starts={starts.filter((x) => x >= MEAL_WINDOWS[m][0] && x < MEAL_WINDOWS[m][1])}
            usual={windowStarts(NO_CHANGES, venue, type).filter((x) => x >= MEAL_WINDOWS[m][0] && x < MEAL_WINDOWS[m][1])}
            onChange={(next, what) => setMeal(type, starts, MEAL_WINDOWS[m], next, what)}
          />
        ))}
        {type === 'assoc' && (
          <MealRanges
            meal="NOC shift"
            hint="Overnight, into the next morning"
            label="NOC"
            noc
            bounds={NOC_DAY}
            starts={noc}
            usual={nocStarts(NO_CHANGES, venue)}
            onChange={(next, what) => setMeal('noc', noc, NOC_DAY, next, what)}
          />
        )}
      </div>
    </BoSection>
  );
}

/** One meal's ranges: on or off, from and until, and the quarter hours behind Fine-tune. */
function MealRanges({
  meal,
  hint,
  label,
  noc,
  bounds,
  starts,
  usual,
  onChange,
}: {
  meal: string;
  hint?: string;
  label: string;
  noc?: boolean;
  bounds: readonly [number, number];
  starts: number[];
  usual: number[];
  onChange: (next: number[], what: string) => void;
}) {
  const [fine, setFine] = useState(false);
  const on = starts.length > 0;
  const quarters: number[] = [];
  for (let x = bounds[0]; x < bounds[1]; x += 15) quarters.push(x);
  const from = starts[0] ?? bounds[0];
  const until = (starts[starts.length - 1] ?? bounds[0]) + 15;
  const gaps = on && starts.length !== (until - from) / 15;
  const span = (a: number, b: number) => quarters.filter((x) => x >= a && x < b);
  const flip = (st: number) => (starts.includes(st) ? starts.filter((x) => x !== st) : [...starts, st].sort((x, y) => x - y));
  return (
    <div className={cx(s.meal, !on && s.mealOff)}>
      <div className={s.mealHead}>
        <span className={s.mealName}>
          {meal}
          {hint && <span className={s.mealHint}>{hint}</span>}
        </span>
        <Toggle
          checked={on}
          label={
            <span className="sr-only">
              Offer {label.toLowerCase()} at {meal.toLowerCase()}
            </span>
          }
          onChange={(v) =>
            onChange(v ? (usual.length ? usual : quarters) : [], v ? `${meal}: ranges back on` : `${meal}: no ${label.toLowerCase()} ranges`)
          }
        />
        {on ? (
          <>
            <span className={s.span}>{spansText(starts)}</span>
            <span className={s.muted}>
              {starts.length} {starts.length === 1 ? 'range' : 'ranges'}
            </span>
          </>
        ) : (
          <span className={s.muted}>Not offered</span>
        )}
        {on && (
          <span className={s.fromTo}>
            <select
              className={s.select}
              aria-label={`${meal} from`}
              value={from}
              onChange={(e) =>
                onChange(span(+e.target.value, Math.max(until, +e.target.value + 15)), `${meal}: from ${minuteLabel(+e.target.value)}`)
              }
            >
              {quarters.map((x) => (
                <option key={x} value={x}>
                  {minuteLabel(x)}
                </option>
              ))}
            </select>
            <span className={s.muted}>until</span>
            <select
              className={s.select}
              aria-label={`${meal} until`}
              value={until}
              onChange={(e) =>
                onChange(span(Math.min(from, +e.target.value - 15), +e.target.value), `${meal}: until ${minuteLabel(+e.target.value)}`)
              }
            >
              {quarters.map((x) => (
                <option key={x} value={x + 15}>
                  {minuteLabel(x + 15)}
                </option>
              ))}
            </select>
          </span>
        )}
        <button className={s.link} aria-expanded={fine} onClick={() => setFine(!fine)}>
          {fine ? 'Done' : gaps ? 'Fine-tune (has gaps)' : 'Fine-tune'}
        </button>
      </div>
      {fine && (
        <div className={s.fine}>
          {quarters
            .filter((x) => x % 60 === 0)
            .map((h) => (
              <div key={h} className={s.fineHour}>
                <span className={s.hour}>{hourLabel(h / 60)}</span>
                <div className={s.quarters}>
                  {[0, 15, 30, 45].map((q) => (
                    <Cell
                      key={q}
                      start={h + q}
                      noc={noc}
                      label={label}
                      on={starts.includes(h + q)}
                      onClick={() => onChange(flip(h + q), `${meal}: ${rangeLabel(h + q)} ${starts.includes(h + q) ? 'off' : 'on'}`)}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/** How many orders one range can take at a venue, and what's booked today. */
function Capacity({ win, venue, setVenue, plain }: { win: WindowSettings; venue: string; setVenue: (v: string) => void; plain?: boolean }) {
  const orders = useDiningOrders();
  const history = useDiningHistory();
  const assocOrders = useAssocOrders();
  const caps = windowCaps(win, venue);
  const set = (key: keyof WindowCaps, v: number | null) => setSetting(`win.cap.${venue}`, { ...caps, [key]: v && v > 0 ? Math.floor(v) : 0 });
  const date = isoDate(0);
  const d = new Date(now());
  const nowMin = d.getHours() * 60 + d.getMinutes();
  const starts = new Set<number>();
  for (const m of Object.keys(MEAL_WINDOWS) as MealName[])
    for (const t of WINDOW_TYPES) for (const w of mealWindows(win, t.id, venue, m)) if (w.start >= nowMin) starts.add(w.start);
  const busy = [...starts]
    .sort((a, b) => a - b)
    .map((start) => ({ start, used: windowUsage({ orders, history, assocOrders }, venue, start, date) }))
    .filter((b) => b.used.total > 0);
  const box = (key: keyof WindowCaps, label: string) => (
    <NumberBox value={caps[key] || ''} placeholder="No limit" width={96} min={0} step={1} aria-label={label} onChange={(v) => set(key, v)} />
  );
  return (
    <BoSection
      title={plain ? undefined : 'Capacity'}
      sub={plain ? undefined : `Limit how many orders can book the same 15 minute window at ${rooms[venue]?.name}. Leave a box blank for no limit.`}
      actions={<VenueTabs venue={venue} onChange={setVenue} />}
    >
      <BoRow
        label="Max orders per 15 minute window"
        hint="Resident pick up, associate pick up and delivery counted together, since it is the kitchen's capacity."
      >
        {box('total', 'Max orders per 15 minute window')}
      </BoRow>
      {WINDOW_TYPES.map((t) => (
        <BoRow key={t.id} label={`${t.label} per window`} hint={`Optional. Blank means no limit for ${t.label.toLowerCase()}.`}>
          {box(t.id, `${t.label} per window`)}
        </BoRow>
      ))}
      {!plain && (
        <p className={s.note}>
          The total and the per type limits both apply: a window is full as soon as either one is reached. Booking screens show Full, or how many are
          left when it is down to 2.
          {venue !== ASSOC_ROOM && ' Associate meals are made in the main kitchen, so they count there.'}
        </p>
      )}
      <div className={s.booked}>
        <span className={s.bookedLabel}>Booked today</span>
        {!busy.length && <span className={s.muted}>Nothing booked in a window yet.</span>}
        {busy.map((b) => {
          const full = caps.total > 0 && b.used.total >= caps.total;
          return (
            <span
              key={b.start}
              className={cx(s.bookedChip, full && s.bookedFull)}
              title={`${b.used.pickup} resident pick up, ${b.used.assoc} associate, ${b.used.delivery} delivery`}
            >
              {rangeLabel(b.start)} · {b.used.total}
              {caps.total > 0 ? ` of ${caps.total}` : ''}
              {full ? ' · Full' : ''}
            </span>
          );
        })}
      </div>
    </BoSection>
  );
}

/** When ordering closes, when NOC meals are made, packing time and the resulting fire lead. */
function Timing({ win, plain }: { win: WindowSettings; plain?: boolean }) {
  const cfg = useConfig();
  const orders = useDiningOrders();
  const history = useDiningHistory();
  const cut = windowCutoff(win);
  const all = [...orders, ...history];
  const avg = ticketAverage(all, cfg);
  const lead = pickupLeadMinutes(all, cfg);
  const nocOptions = Array.from({ length: 17 }, (_, i) => 1080 + i * 15);
  return (
    <BoSection title={plain ? undefined : 'Timing'}>
      <BoRow label="Orders close before the range starts" hint="A range disappears from every booking screen this long before it starts. Up to 4 hours (240 min).">
        <NumberBox
          value={cut}
          unit="min"
          min={0}
          max={240}
          step={5}
          aria-label="Orders close before the range starts"
          onChange={(v) => setSetting('win.cut', v == null ? undefined : Math.max(0, v))}
        />
      </BoRow>
      <BoRow
        label="NOC meals are made by"
        hint={`The kitchen may be closed overnight, so the dinner line makes NOC meals before this time and sets them out. NOC orders close ${cut} min before it.`}
      >
        <select
          className={s.select}
          value={nocMadeBy(win)}
          aria-label="NOC meals are made by"
          onChange={(e) => {
            const v = +e.target.value;
            setSetting('win.nocBy', v === 1200 ? undefined : v);
            toast(`NOC meals are made by ${minuteLabel(v)}, orders close at ${minuteLabel(v - cut)}`);
          }}
        >
          {nocOptions.map((v) => (
            <option key={v} value={v}>
              {minuteLabel(v)}
            </option>
          ))}
        </select>
      </BoRow>
      <BoRow label="Packing time" hint="Added to the average ticket time to decide when the kitchen fires a scheduled order.">
        <NumberBox
          value={cfg.pickupPackMinutes}
          unit="min"
          min={0}
          max={60}
          aria-label="Packing time"
          onChange={(v) => updateConfig({ pickupPackMinutes: Math.max(0, v ?? 5) })}
        />
      </BoRow>
      <BoRow
        label="Kitchen fires a scheduled order"
        hint={`${avg.live ? "Tonight's" : "The last week's"} average ticket is ${Math.round(avg.v * 10) / 10} min. Rounded up to the next 5 minutes, at least 10, so the order is ready when its range starts. Orders close ${cut} min before.`}
      >
        <span className={s.lead}>{lead} min before the range</span>
      </BoRow>
    </BoSection>
  );
}

/** Pick Up Windows: The 15 minute ranges each venue offers. */
function PickUpTimes() {
  const win = windowSettings(useServiceSettings());
  const [venue, setVenue] = useState(venueOptions[0].id);
  const [tab, setTab] = usePageTab<WinTab>('svcWin', TABS);
  return (
    <BoPage
      title="Pick Up Windows"
      actions={
        <ConfirmReset
          sections={['win']}
          onReset={() => updateConfig({ pickupPackMinutes: 5 })}
          title="Put pick up windows back to the default?"
          message="Ranges, limits and timing at every venue go back to the standard."
          done="Pick up windows are back to the defaults"
        />
      }
    >
      <OrderTypes win={win} />
      <Tabs
        aria-label="Pick up windows"
        variant="underline"
        value={tab}
        onChange={setTab}
        options={TABS.map((id) => ({ id, label: TAB_LABELS[id] }))}
      />
      {tab === 'ranges' && <RangesOffered win={win} venue={venue} setVenue={setVenue} />}
      {tab === 'capacity' && <Capacity win={win} venue={venue} setVenue={setVenue} />}
      {tab === 'timing' && <Timing win={win} />}
    </BoPage>
  );
}

const HUB_TABS = ['times', 'fees'] as const;

/** The page's own sections, without their titles, for the step-by-step setup. */
const SETUP_SECTIONS: SetupSections = {
  types: ({ win }) => <OrderTypes win={win} plain />,
  ranges: (p) => <RangesOffered {...p} plain />,
  capacity: (p) => <Capacity {...p} plain />,
  timing: ({ win }) => <Timing win={win} plain />,
};

/** Pick Up & Delivery: when residents and associates can book, and what delivery costs. */
export default function Page(_props: BoPageProps) {
  const [tab, go] = useHubTab('svcWin', HUB_TABS);
  const [setup, setSetup] = useState(false);
  return (
    <>
      <BoTabbedPage
        page="svcWin"
        title="Pick Up & Delivery"
        current={tab}
        onTab={go}
        actions={
          <Button variant="primary" size="sm" onClick={() => setSetup(true)}>
            Set up step by step
          </Button>
        }
        tabs={[
          { id: 'times', label: 'Pick up times', render: () => <PickUpTimes /> },
          { id: 'fees', label: 'Delivery fees & sick waivers', render: () => <DeliveryFeesTab /> },
        ]}
      />
      <SvcWinSetup open={setup} onClose={() => setSetup(false)} sections={SETUP_SECTIONS} />
    </>
  );
}
