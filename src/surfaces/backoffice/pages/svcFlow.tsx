import { rooms } from '../../../data';
import { COURSE_MODES, flag, type CourseMode, type FlowFlag } from '../../../domain/config';
import type { MealName } from '../../../domain/types';
import { updateConfig, useConfig } from '../../../store/config';
import { getSetting, setSetting, useSetting } from '../../../store/serviceConfig';
import { Button, Toggle } from '../../../ui';
import { greetConfig } from '../../manager/floor/greet';
import { checkInMinutes } from '../../manager/floor/triage';
import { MEALS } from '../../manager/metrics/stepsOfService';
import { InlineField, InlineFields, PickMany, ResetButton, SettingNumber, SettingSelect } from '../../manager/settings/SettingControls';
import type { BoPageProps } from '../nav';
import { BoPage, BoRow, BoSection, BoTable, type BoColumn } from '../kit';

const venues = Object.entries(rooms).map(([key, r]) => ({ key, name: r.name }));
type Venue = (typeof venues)[number];

function FlowToggle({ k, label, hint }: { k: FlowFlag; label: string; hint: string }) {
  const cfg = useConfig();
  return (
    <BoRow label={label} hint={hint}>
      <Toggle checked={flag(cfg, k)} onChange={(v) => updateConfig((c) => ({ flow: { ...c.flow, [k]: v } }))} label={<span className="sr-only">{label}</span>} />
    </BoRow>
  );
}

/**
 * Coursing is the culinary director's call for each venue and meal, not
 * something a server sets on each check. Every mode has one backup, counted
 * from when the course before was run, so a table never stalls.
 */
function Coursing() {
  const cfg = useConfig();
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
          <SettingSelect<CourseMode> label={`${v.name} ${meal} coursing`} value={cfg.course[v.key]?.[meal] ?? 'expo'} options={COURSE_MODES} onChange={(m) => set(v.key, meal, m)} />
        ),
      }),
    ),
  ];
  return (
    <BoSection
      flush
      title="Coursing"
      sub="Turn coursing on or off, and set when the next course fires, for each venue and meal. Servers do not change this on the check. Off sends every course to the kitchen together. Every mode has a 15 minute backup counted from when the course before was run, so nothing stalls. Dessert always waits: it fires when the server or expo fires it, or 15 minutes after the entrees reach the table."
    >
      <BoTable columns={columns} rows={venues} rowKey={(v) => v.key} />
    </BoSection>
  );
}

/** Time to greet: when greet to drinks is slow, per venue and meal. */
function Greet() {
  useSetting('greet');
  const set = (room: string, patch: Partial<ReturnType<typeof greetConfig>>) => setSetting(`greet.${room}`, { ...greetConfig(room), ...patch });
  const columns: Array<BoColumn<Venue>> = [
    { key: 'venue', header: 'Venue', render: (v) => <b>{v.name}</b> },
    { key: 'over', header: 'Flag over', render: (v) => <SettingNumber path={`greet.${v.key}.over`} label={`${v.name} flag greet to drinks over`} step={0.5} min={0.5} placeholder={String(greetConfig(v.key).over)} /> },
    { key: 'under', header: 'Ignore under', render: (v) => <SettingNumber path={`greet.${v.key}.under`} label={`${v.name} ignore greet to drinks under`} step={0.5} placeholder={String(greetConfig(v.key).under)} /> },
    {
      key: 'meals',
      header: 'Meals',
      render: (v) => <PickMany<MealName> options={MEALS} value={greetConfig(v.key).meals} onChange={(meals) => set(v.key, { meals })} label={`${v.name} meals timed`} />,
    },
  ];
  return (
    <BoSection
      flush
      title="Time to greet"
      sub="The clock starts when the check opens. When a host seats the table it starts when the server first opens the check, and seated to greeted is recorded too. Greet to drinks over the limit is flagged for the manager and counted as a slow greeting; anything under the floor is ignored."
    >
      <BoTable columns={columns} rows={venues} rowKey={(v) => v.key} />
    </BoSection>
  );
}

/** Per venue: staff mark a pick up collected (the default), or packed and set out finishes it. */
function PickupTracking() {
  useSetting('pud');
  return (
    <BoSection title="Pick up orders" sub="Residents get one text when a pick up is packed and set out. Off: the order is complete at that point, with no picked-up step on PU & Delivery or Expo.">
      {venues.map((v) => {
        const on = getSetting<boolean | undefined>(`pud.track.${v.key}`) !== false;
        return (
          <BoRow
            key={v.key}
            label={`Track when pick up orders are collected · ${v.name}`}
            hint={on ? 'Staff tap Picked up when the resident or associate collects it.' : 'Packed and set out finishes the order.'}
          >
            <Toggle checked={on} onChange={(x) => setSetting(`pud.track.${v.key}`, x ? undefined : false)} label={<span className="sr-only">Track when pick up orders are collected at {v.name}</span>} />
          </BoRow>
        );
      })}
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
    <BoRow label="Nudge a check-in" hint="After a course is run, the Check in button on the table card turns green once this many minutes have passed. Until then it stays grey. Set 0 to light it straight away." align="start">
      <InlineFields>
        {venues.map((v) => (
          <InlineField key={v.key} label={v.name}>
            <SettingNumber path={`ciMin.${v.key}`} label={`${v.name} check-in nudge minutes`} placeholder={String(checkInMinutes(v.key))} clearRemoves width={58} />
          </InlineField>
        ))}
      </InlineFields>
    </BoRow>
  );
}

/** Service Flow: the steps servers see on each table, from the order to the check. */
export default function Page({ goto }: BoPageProps) {
  const cfg = useConfig();
  return (
    <BoPage
      title="Service Flow"
      sub="The steps servers see on each table, from the order to the check."
      actions={<ResetButton sections={['ciMin', 'greet', 'pud']} onReset={() => updateConfig({ flow: {}, course: {} })} message="Service flow is back to the defaults" />}
    >
      <Coursing />
      <Greet />
      <PickupTracking />
      <BoSection title="After the entree">
        <FlowToggle k="checkIn" label="Check in after the entree" hint="Tables stay in Eating after course 2 until the server taps Check in. Off moves them straight to Ready to close." />
        {flag(cfg, 'checkIn') && <CheckInNudge />}
        <FlowToggle k="dessert" label="Ask about dessert" hint="After the check-in the card offers Dessert and No dessert. Off moves the table to Ready to close as soon as they check in." />
      </BoSection>
      <BoSection title="Taking the order">
        <FlowToggle k="appToEntree" label="Move on to entrees after a starter" hint="Adding a starter switches the menu to Entrees for the next pick." />
        <FlowToggle
          k="entreeNext"
          label="Move on to the next diner after an entree"
          hint="Adding an entree selects the next diner on the check and opens Starters. An entree that comes without a side opens the Sides tab automatically, but choosing a side is optional: pick one and the check moves on, or carry on with another item, the next diner or Send. The last diner stays selected."
        />
        <FlowToggle k="dessertNext" label="Move on to the next diner after a dessert" hint="When the table is ordering dessert after the meal, adding one selects the next diner and stays on Desserts." />
        <FlowToggle k="hideDefaults" label="Hide default choices on the check" hint="A line only lists the choices the guest changed, not the ones that come with the dish." />
        <FlowToggle k="usuals" label="Show usual picks" hint="Before anything is ordered, a resident's usual drinks and dishes show as small chips under their name. Off hides them." />
      </BoSection>
      <BoSection title="Comps">
        <FlowToggle
          k="hospiceAuto"
          label="Comp meals for residents on hospice"
          hint="Residents marked On hospice in Dining Plans & Notes have their meals comped at close with the reason Hospice. No manager PIN, and no meal credit used."
        />
        <FlowToggle
          k="freeDeliveryComp"
          label="Waive delivery fees for residents on hospice"
          hint="Residents marked On hospice in Dining Plans & Notes get the delivery fee waived automatically, with no manager PIN. For anyone else Hospice needs a manager PIN, like every other comp. Sick has its own waiver with a monthly limit, under Delivery Options."
        />
      </BoSection>
      <BoSection
        title="Item names"
        sub="Each recipe has its menu name and a short name. Set the short name on the recipe."
        actions={
          <Button size="sm" variant="ghost" onClick={() => goto('recipes')}>
            Open recipes
          </Button>
        }
      >
        <FlowToggle k="shortServer" label="Short names for servers" hint="Menu tiles, the check and the usual picks use the short name." />
        <FlowToggle k="shortKitchen" label="Short names for the kitchen" hint="Cook line, expo and the bar use the short name." />
      </BoSection>
    </BoPage>
  );
}
