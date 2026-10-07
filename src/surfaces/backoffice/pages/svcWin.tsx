/**
 * Pick Up Windows. Every booking is a 15 minute range such as 5:00 to
 * 5:15 PM. Back Office ticks the ranges each venue offers for resident pick
 * up, associate pick up and delivery, caps how many orders a range takes,
 * and sets when ordering closes and how early the kitchen fires.
 */
import { useState, type ReactNode } from 'react';
import { rooms } from '../../../data';
import { isoDate, pickupLeadMinutes, ticketAverage } from '../../../domain/pickup';
import type { MealName } from '../../../domain/types';
import { now } from '../../../lib/clock';
import { updateConfig, useConfig } from '../../../store/config';
import { useDining } from '../../../store/dining';
import { setSetting } from '../../../store/serviceConfig';
import { Tabs, Toggle, cx, toast } from '../../../ui';
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
import s from './svcWin.module.css';

const TABS = ['ranges', 'capacity', 'timing'] as const;
type WinTab = (typeof TABS)[number];
const TAB_LABELS: Record<WinTab, string> = { ranges: 'Ranges offered', capacity: 'How many per range', timing: 'Timing' };

const venueOptions = Object.entries(rooms).map(([id, r]) => ({ id, label: r.name }));
const hourLabel = (h: number) => `${h % 12 || 12} ${h % 24 >= 12 ? 'PM' : 'AM'}`;
const mealOfHour = (h: number) => (Object.keys(MEAL_WINDOWS) as MealName[]).find((m) => h * 60 >= MEAL_WINDOWS[m][0] && h * 60 < MEAL_WINDOWS[m][1]);

function VenueTabs({ venue, onChange }: { venue: string; onChange: (v: string) => void }) {
  return <Tabs aria-label="Venue" size="sm" variant="segmented" value={venue} onChange={onChange} options={venueOptions} />;
}

/** Which order types book a range at all. */
function OrderTypes({ win }: { win: WindowSettings }) {
  return (
    <BoSection title="Order types" sub="Turn ranges off and staff take the order as soon as it is ready instead. Associate meals always book a range.">
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
function Cell({ on, label, start, noc, dim, onClick }: { on: boolean; label: string; start: number; noc?: boolean; dim?: boolean; onClick: () => void }) {
  return (
    <button className={cx(s.cell, on && (noc ? s.cellNoc : s.cellOn), dim && s.cellDim)} aria-pressed={on} aria-label={`${label} ${rangeLabel(start)}`} title={rangeLabel(start)} onClick={onClick}>
      :{String(start % 60).padStart(2, '0')}
    </button>
  );
}

/** The grid of quarter hours each venue offers, by meal, plus the NOC shift. */
function RangesOffered({ win, venue, setVenue }: { win: WindowSettings; venue: string; setVenue: (v: string) => void }) {
  const grid = Object.fromEntries(WINDOW_TYPES.map((t) => [t.id, windowStarts(win, venue, t.id)])) as Record<WindowType, number[]>;
  const noc = nocStarts(win, venue);
  const put = (type: WindowType | 'noc', list: number[] | undefined) => setSetting(`win.grid.${venue}.${type}`, list);
  /** Swap a whole column at once, with Undo, since one tap clears a day of ranges. */
  const replaceAll = (type: WindowType, label: string, list: number[] | undefined) => {
    const before = win.grid?.[venue]?.[type];
    put(type, list);
    toast(list ? `${label}: no ranges offered at ${rooms[venue]?.name}` : `${label}: back to the meal hours at ${rooms[venue]?.name}`, {
      action: { label: 'Undo', onClick: () => put(type, before) },
    });
  };
  const flip = (list: number[], start: number) => (list.includes(start) ? list.filter((x) => x !== start) : [...list, start].sort((a, b) => a - b));
  const hours: number[] = [];
  for (let h = WINDOW_DAY[0] / 60; h < WINDOW_DAY[1] / 60; h++) hours.push(h);
  const nocHours: number[] = [];
  for (let h = NOC_DAY[0] / 60; h < NOC_DAY[1] / 60; h++) nocHours.push(h);
  return (
    <BoSection
      title="Ranges offered"
      sub="Tap a quarter hour to offer it (dark) or stop offering it (light). Meal hours puts back the standard ranges for each meal; None stops that order type booking at this venue."
      actions={<VenueTabs venue={venue} onChange={setVenue} />}
    >
      <div className={s.gridWrap}>
        <table className={s.grid}>
          <thead>
            <tr>
              <th className={s.hourCol}>Starts</th>
              {WINDOW_TYPES.map((t) => (
                <th key={t.id}>
                  <div>{t.label}</div>
                  <div className={s.headTools}>
                    <span className={s.muted}>
                      {grid[t.id].length} {grid[t.id].length === 1 ? 'range' : 'ranges'}
                    </span>
                    <button className={s.link} onClick={() => replaceAll(t.id, t.label, undefined)}>
                      Meal hours
                    </button>
                    <button className={s.link} onClick={() => replaceAll(t.id, t.label, [])}>
                      None
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((h) => (
              <HourRow key={h} hour={h} meal={mealOfHour(h) !== mealOfHour(h - 1) ? mealOfHour(h) : undefined}>
                {WINDOW_TYPES.map((t) => (
                  <td key={t.id}>
                    <div className={s.quarters}>
                      {[0, 15, 30, 45].map((q) => {
                        const start = h * 60 + q;
                        return (
                          <Cell
                            key={q}
                            start={start}
                            label={t.label}
                            on={grid[t.id].includes(start)}
                            dim={!windowTypeOn(win, t.id)}
                            onClick={() => put(t.id, flip(grid[t.id], start))}
                          />
                        );
                      })}
                    </div>
                  </td>
                ))}
              </HourRow>
            ))}
            <tr>
              <td colSpan={1 + WINDOW_TYPES.length} className={s.nocHead}>
                <span className={s.nocTitle}>NOC shift</span>
                <span className={s.muted}>
                  Associate pick up only, overnight into the next morning. {noc.length} {noc.length === 1 ? 'range' : 'ranges'} offered.
                </span>
              </td>
            </tr>
            {nocHours.map((h) => (
              <HourRow key={h} hour={h % 24}>
                {WINDOW_TYPES.map((t) => (
                  <td key={t.id}>
                    {t.id === 'assoc' ? (
                      <div className={s.quarters}>
                        {[0, 15, 30, 45].map((q) => {
                          const start = h * 60 + q;
                          return <Cell key={q} noc start={start} label="NOC" on={noc.includes(start)} onClick={() => put('noc', flip(noc, start))} />;
                        })}
                      </div>
                    ) : (
                      <span className={s.none}>—</span>
                    )}
                  </td>
                ))}
              </HourRow>
            ))}
          </tbody>
        </table>
      </div>
    </BoSection>
  );
}

function HourRow({ hour, meal, children }: { hour: number; meal?: string; children: ReactNode }) {
  return (
    <>
      {meal && (
        <tr>
          <td colSpan={1 + WINDOW_TYPES.length} className={s.band}>
            {meal}
          </td>
        </tr>
      )}
      <tr>
        <td className={s.hour}>{hourLabel(hour)}</td>
        {children}
      </tr>
    </>
  );
}

/** How many orders one range can take at a venue, and what's booked today. */
function Capacity({ win, venue, setVenue }: { win: WindowSettings; venue: string; setVenue: (v: string) => void }) {
  const { orders, history, assocOrders } = useDining();
  const caps = windowCaps(win, venue);
  const set = (key: keyof WindowCaps, v: number | null) => setSetting(`win.cap.${venue}`, { ...caps, [key]: v && v > 0 ? Math.floor(v) : 0 });
  const date = isoDate(0);
  const d = new Date(now());
  const nowMin = d.getHours() * 60 + d.getMinutes();
  const starts = new Set<number>();
  for (const m of Object.keys(MEAL_WINDOWS) as MealName[]) for (const t of WINDOW_TYPES) for (const w of mealWindows(win, t.id, venue, m)) if (w.start >= nowMin) starts.add(w.start);
  const busy = [...starts]
    .sort((a, b) => a - b)
    .map((start) => ({ start, used: windowUsage({ orders, history, assocOrders }, venue, start, date) }))
    .filter((b) => b.used.total > 0);
  const box = (key: keyof WindowCaps, label: string) => (
    <NumberBox value={caps[key] || ''} placeholder="No limit" width={96} min={0} step={1} aria-label={label} onChange={(v) => set(key, v)} />
  );
  return (
    <BoSection
      title="Capacity"
      sub={`Limit how many orders can book the same 15 minute window at ${rooms[venue]?.name}. Leave a box blank for no limit.`}
      actions={<VenueTabs venue={venue} onChange={setVenue} />}
    >
      <BoRow label="Max orders per 15 minute window" hint="Resident pick up, associate pick up and delivery counted together, since it is the kitchen's capacity.">
        {box('total', 'Max orders per 15 minute window')}
      </BoRow>
      {WINDOW_TYPES.map((t) => (
        <BoRow key={t.id} label={`${t.label} per window`} hint={`Optional. Blank means no limit for ${t.label.toLowerCase()}.`}>
          {box(t.id, `${t.label} per window`)}
        </BoRow>
      ))}
      <p className={s.note}>
        The total and the per type limits both apply: a window is full as soon as either one is reached. Booking screens show Full, or how many are left when it is down to 2.
        {venue !== ASSOC_ROOM && ' Associate meals are made in the main kitchen, so they count there.'}
      </p>
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
function Timing({ win }: { win: WindowSettings }) {
  const cfg = useConfig();
  const { orders, history } = useDining();
  const cut = windowCutoff(win);
  const all = [...orders, ...history];
  const avg = ticketAverage(all, cfg);
  const lead = pickupLeadMinutes(all, cfg);
  const nocOptions = Array.from({ length: 17 }, (_, i) => 1080 + i * 15);
  return (
    <BoSection title="Timing">
      <BoRow label="Orders close before the range starts" hint="A range disappears from every booking screen this long before it starts.">
        <NumberBox value={cut} unit="min" min={0} step={5} aria-label="Orders close before the range starts" onChange={(v) => setSetting('win.cut', v == null ? undefined : Math.max(0, v))} />
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
      <Tabs aria-label="Pick up windows" variant="underline" value={tab} onChange={setTab} options={TABS.map((id) => ({ id, label: TAB_LABELS[id] }))} />
      {tab === 'ranges' && <RangesOffered win={win} venue={venue} setVenue={setVenue} />}
      {tab === 'capacity' && <Capacity win={win} venue={venue} setVenue={setVenue} />}
      {tab === 'timing' && <Timing win={win} />}
    </BoPage>
  );
}

const HUB_TABS = ['times', 'fees'] as const;

/** Pick Up & Delivery: when residents and associates can book, and what delivery costs. */
export default function Page(_props: BoPageProps) {
  const [tab, go] = useHubTab('svcWin', HUB_TABS);
  return (
    <BoTabbedPage
      page="svcWin"
      title="Pick Up & Delivery"
      current={tab}
      onTab={go}
      tabs={[
        { id: 'times', label: 'Pick up times', render: () => <PickUpTimes /> },
        { id: 'fees', label: 'Delivery fees & sick waivers', render: () => <DeliveryFeesTab /> },
      ]}
    />
  );
}
