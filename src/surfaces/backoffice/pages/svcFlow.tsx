import type { ReactNode } from 'react';
import { rooms } from '../../../data';
import { COURSE_MODES, COURSE_SAFETY_NET, flag, printerMode, type CourseMode, type FlowFlag } from '../../../domain/config';
import type { MealName } from '../../../domain/types';
import { updateConfig, useConfig } from '../../../store/config';
import { getSetting, setSetting, useSetting } from '../../../store/serviceConfig';
import { Button, Tabs, Toggle } from '../../../ui';
import { greetConfig } from '../../../domain/greet';
import { checkInWakeMinutes } from '../../../domain/venue';
import { MEALS } from '../../../domain/metrics/stepsOfService';
import { PickMany, SettingNumber, SettingSelect } from '../kit/SettingControls';
import { ConfirmReset } from './ConfirmReset';
import { KitchenModeSetting } from './KitchenModeSetting';
import { usePageTab } from './pageTab';
import type { BoPageProps } from '../nav';
import { BoPage, BoRow, BoSection, BoTable, type BoColumn } from '../kit';
import css from './svcFlow.module.css';

const venues = Object.entries(rooms).map(([key, r]) => ({ key, name: r.name }));
type Venue = (typeof venues)[number];

const COURSE_OPTIONS = COURSE_MODES.map((m) => ({ id: m.id, label: m.label }));

const TABS = ['courses', 'order', 'pickup'] as const;
type FlowTab = (typeof TABS)[number];
const TAB_LABELS: Record<FlowTab, string> = { courses: 'Courses and timing', order: 'Taking the order', pickup: 'Pick up and comps' };

export function FlowToggle({ k, label, hint, disabled }: { k: FlowFlag; label: string; hint?: string; disabled?: boolean }) {
  const cfg = useConfig();
  return (
    <BoRow label={label} hint={hint}>
      <Toggle
        disabled={disabled}
        checked={flag(cfg, k)}
        onChange={(v) => updateConfig((c) => ({ flow: { ...c.flow, [k]: v } }))}
        label={<span className="sr-only">{label}</span>}
      />
    </BoRow>
  );
}

/** A setting set per venue: the label, then one aligned line per venue with its control on the right. */
function PerVenue({ label, hint, control }: { label: string; hint?: string; control: (v: Venue) => ReactNode }) {
  return (
    <div className={css.perVenue}>
      <BoRow label={label} hint={hint} />
      {venues.map((v) => (
        <div key={v.key} className={css.venue}>
          <span className={css.venueName}>{v.name}</span>
          <span className={css.venueControl}>{control(v)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Coursing is the culinary director's call for each venue and meal, not
 * something a server sets on each check. Every mode has one safety net, counted
 * from when the course before was run, so a table never stalls: a held course
 * fires on its own 15 min after the one before is dropped, and dessert waits
 * for a manual fire or those 15 min.
 */
function Coursing() {
  const cfg = useConfig();
  if (printerMode(cfg))
    return <BoSection title="Coursing" sub="Off with printers: the whole ticket prints at send. Coursing comes back with kitchen screens." />;
  const set = (room: string, meal: MealName, mode: CourseMode) =>
    updateConfig((c) => {
      const venue = { ...c.course[room] };
      if (mode === 'expo') delete venue[meal];
      else venue[meal] = mode;
      return { course: { ...c.course, [room]: venue } };
    });
  const columns: Array<BoColumn<Venue>> = [
    { key: 'venue', header: 'Venue', render: (v) => <b>{v.name}</b> },
    ...MEALS.map(
      (meal): BoColumn<Venue> => ({
        key: meal,
        header: meal,
        render: (v) => (
          <SettingSelect<CourseMode>
            label={`${v.name} ${meal} coursing`}
            value={cfg.course[v.key]?.[meal] ?? 'expo'}
            options={COURSE_OPTIONS}
            onChange={(m) => set(v.key, meal, m)}
          />
        ),
      }),
    ),
  ];
  return (
    <BoSection flush title="Coursing" sub="When each course goes to the kitchen, set for each venue and meal.">
      <BoTable columns={columns} rows={venues} rowKey={(v) => v.key} />
      {/* What each option means, one per line, and the safety net they all share. */}
      <dl className={css.key}>
        {COURSE_MODES.map((m) => (
          <div key={m.id} className={css.keyRow}>
            <dt>{m.label}</dt>
            <dd>{m.what}</dd>
          </div>
        ))}
        <div className={css.keyRow}>
          <dt>Safety net</dt>
          <dd>{COURSE_SAFETY_NET}</dd>
        </div>
      </dl>
    </BoSection>
  );
}

/**
 * Time to greet: greet to drinks runs from when the server opens the check to
 * when drinks are served. Over the flag time the manager sees it and it counts
 * as a slow greeting; under the ignore time it isn't counted at all.
 */
function Greet() {
  useSetting('greet');
  const set = (room: string, patch: Partial<ReturnType<typeof greetConfig>>) => setSetting(`greet.${room}`, { ...greetConfig(room), ...patch });
  const columns: Array<BoColumn<Venue>> = [
    { key: 'venue', header: 'Venue', render: (v) => <b>{v.name}</b> },
    {
      key: 'over',
      header: 'Slow over',
      render: (v) => (
        <SettingNumber
          path={`greet.${v.key}.over`}
          label={`${v.name} flag greet to drinks over`}
          step={0.5}
          min={0.5}
          placeholder={String(greetConfig(v.key).over)}
        />
      ),
    },
    {
      key: 'under',
      header: "Don't count under",
      render: (v) => (
        <SettingNumber
          path={`greet.${v.key}.under`}
          label={`${v.name} ignore greet to drinks under`}
          step={0.5}
          placeholder={String(greetConfig(v.key).under)}
        />
      ),
    },
    {
      key: 'meals',
      header: 'Meals timed',
      render: (v) => (
        <PickMany<MealName>
          options={MEALS}
          value={greetConfig(v.key).meals}
          onChange={(meals) => set(v.key, { meals })}
          label={`${v.name} meals timed`}
        />
      ),
    },
  ];
  const problems = venues.flatMap((v) => {
    const g = greetConfig(v.key);
    return g.under >= g.over ? [`${v.name}: "Don't count under" (${g.under} min) has to be less than "Slow over" (${g.over} min).`] : [];
  });
  return (
    <BoSection
      flush
      title="Time to greet"
      sub="From opening the check to drinks served. Slow ones are flagged to the manager on Triage, for the meals timed. Greets under the floor are left out of greet times."
    >
      <BoTable columns={columns} rows={venues} rowKey={(v) => v.key} />
      {problems.map((p) => (
        <p key={p} className={css.problem} role="alert">
          {p}
        </p>
      ))}
    </BoSection>
  );
}

/**
 * The Check in button on a table card stays grey, then turns green this many
 * minutes after a course is run, so servers do not interrupt the first bites.
 */
function CheckInNudge() {
  useSetting('ciMin');
  return (
    <PerVenue
      label="Light up the Check in button after"
      hint="Minutes after a course is run, 0 to 60. 0 lights it straight away."
      control={(v) => (
        <SettingNumber
          path={`ciMin.${v.key}`}
          label={`${v.name} check-in nudge minutes`}
          placeholder={String(checkInWakeMinutes(v.key))}
          clearRemoves
          max={60}
          width={58}
        />
      )}
    />
  );
}

/** Per venue: staff mark a pick up collected (the default), or packed and set out finishes it. */
function PickupTracking() {
  useSetting('pud');
  return (
    <PerVenue
      label="Staff mark pick ups as collected"
      hint="Off: packed and set out finishes the order."
      control={(v) => (
        <Toggle
          checked={getSetting<boolean | undefined>(`pud.track.${v.key}`) !== false}
          onChange={(x) => setSetting(`pud.track.${v.key}`, x ? undefined : false)}
          label={<span className="sr-only">Track when pick up orders are collected at {v.name}</span>}
        />
      )}
    />
  );
}

/** Pacing & Coursing: the steps servers see on each table, from the order to the check. */
export default function Page({ goto }: BoPageProps) {
  const cfg = useConfig();
  const [tab, setTab] = usePageTab<FlowTab>('svcFlow', TABS);
  return (
    <BoPage
      title="Pacing & Coursing"
      actions={
        <ConfirmReset
          sections={['ciMin', 'greet', 'pud']}
          onReset={() => updateConfig({ flow: {}, course: {}, kitchenMode: 'kds' })}
          title="Put service flow back to the default?"
          message="Kitchen screens instead of printers, coursing, greet times, pick up tracking and every switch on all three tabs go back to the standard."
          done="Pacing & Coursing is back to the defaults"
        />
      }
    >
      <Tabs
        aria-label="Pacing and coursing"
        variant="underline"
        value={tab}
        onChange={setTab}
        options={TABS.map((id) => ({ id, label: TAB_LABELS[id] }))}
      />
      {tab === 'courses' && (
        <>
          <KitchenModeSetting />
          <Coursing />
          <BoSection title="After the entrée">
            <FlowToggle k="checkIn" label="Ask to check in after the entrée" hint="Off: the table goes straight to Ready to close." />
            {flag(cfg, 'checkIn') && <CheckInNudge />}
          </BoSection>
          <BoSection title="Dessert">
            <FlowToggle
              k="dessert"
              label="Offer dessert after the check-in"
              disabled={!flag(cfg, 'checkIn')}
              hint={
                flag(cfg, 'checkIn')
                  ? 'Off: the table goes to Ready to close once checked in.'
                  : 'Not used while "Ask to check in" is off: tables go straight to Ready to close.'
              }
            />
          </BoSection>
          <Greet />
        </>
      )}
      {tab === 'order' && (
        <>
          <BoSection title="Taking the order">
            <FlowToggle k="appToEntree" label="Go to Entrées after a starter" />
            <FlowToggle k="entreeNext" label="Go to the next diner after an entrée" hint="Sides opens first if the entrée has none." />
            <FlowToggle k="dessertNext" label="Go to the next diner after a dessert" />
            <FlowToggle k="hideDefaults" label="Only list changed choices on the check" />
            <FlowToggle k="usuals" label="Show a resident's usual picks" hint="As chips under their name until the first order." />
          </BoSection>
          <BoSection
            title="Short names"
            sub="Set on each recipe."
            actions={
              <Button size="sm" variant="ghost" onClick={() => goto('recipes')}>
                Open the Recipe Book
              </Button>
            }
          >
            <FlowToggle k="shortServer" label="Use short names for servers" hint="Menu tiles, the check and usual picks." />
            <FlowToggle k="shortKitchen" label="Use short names in the kitchen" hint="Cook line, expo and the bar." />
          </BoSection>
        </>
      )}
      {tab === 'pickup' && (
        <>
          <BoSection title="Pick up">
            <PickupTracking />
          </BoSection>
          <BoSection title="Comps" sub="For residents marked On hospice in Resident Dining Profile.">
            <FlowToggle k="hospiceAuto" label="Comp hospice residents' meals" hint="At close, reason Hospice. No manager PIN or meal credit." />
            <FlowToggle k="freeDeliveryComp" label="Waive hospice residents' delivery fees" hint="No manager PIN needed." />
          </BoSection>
        </>
      )}
    </BoPage>
  );
}
