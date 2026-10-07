import { rooms } from '../../../data';
import { COURSE_MODES, flag, printerMode, type CourseMode, type FlowFlag } from '../../../domain/config';
import type { MealName } from '../../../domain/types';
import { updateConfig, useConfig } from '../../../store/config';
import { getSetting, setSetting, useSetting } from '../../../store/serviceConfig';
import { Button, Tabs, Toggle } from '../../../ui';
import { greetConfig } from '../../../domain/greet';
import { checkInWakeMinutes } from '../../../domain/venue';
import { MEALS } from '../../../domain/metrics/stepsOfService';
import { InlineField, InlineFields, PickMany, SettingNumber, SettingSelect } from '../kit/SettingControls';
import { ConfirmReset } from './ConfirmReset';
import { KitchenModeSetting } from './KitchenModeSetting';
import { usePageTab } from './pageTab';
import type { BoPageProps } from '../nav';
import { BoPage, BoRow, BoSection, BoTable, type BoColumn } from '../kit';

const venues = Object.entries(rooms).map(([key, r]) => ({ key, name: r.name }));
type Venue = (typeof venues)[number];

const COURSE_OPTIONS = COURSE_MODES.map((m) => ({ id: m.id, label: m.label }));

const TABS = ['courses', 'order', 'pickup'] as const;
type FlowTab = (typeof TABS)[number];
const TAB_LABELS: Record<FlowTab, string> = { courses: 'Courses and timing', order: 'Taking the order', pickup: 'Pick up and comps' };

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
  if (printerMode(cfg))
    return (
      <BoSection title="Coursing" sub="Printers print the whole ticket when the server sends it, so courses don't wait for each other. Coursing comes back with kitchen screens." />
    );
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
          <SettingSelect<CourseMode> label={`${v.name} ${meal} coursing`} value={cfg.course[v.key]?.[meal] ?? 'expo'} options={COURSE_OPTIONS} onChange={(m) => set(v.key, meal, m)} />
        ),
      }),
    ),
  ];
  return (
    <BoSection
      flush
      title="Coursing"
      sub="Fire all: every course at send · Fire on drop: when the one before is dropped at the table · Auto-fire +5 / +8: minutes after the one before fired · Manual fire: the server or expo fires it. A held course fires on its own 15 min after the one before is dropped; dessert waits for a manual fire or those 15 min."
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
      sub="Greet to drinks runs from when the server opens the check to when drinks are served. Over the flag time, the manager sees it and it counts as a slow greeting. Under the ignore time, it isn't counted at all."
    >
      <BoTable columns={columns} rows={venues} rowKey={(v) => v.key} />
    </BoSection>
  );
}

/** Per venue: staff mark a pick up collected (the default), or packed and set out finishes it. */
function PickupTracking() {
  useSetting('pud');
  return (
    <BoSection title="Track when pick up orders are collected" sub="Residents get one text when a pick up is packed and set out. Off: the order is done at that point, with no Picked up step on PU & Delivery or Expo.">
      {venues.map((v) => {
        const on = getSetting<boolean | undefined>(`pud.track.${v.key}`) !== false;
        return (
          <BoRow
            key={v.key}
            label={v.name}
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
            <SettingNumber path={`ciMin.${v.key}`} label={`${v.name} check-in nudge minutes`} placeholder={String(checkInWakeMinutes(v.key))} clearRemoves width={58} />
          </InlineField>
        ))}
      </InlineFields>
    </BoRow>
  );
}

/** Service Flow: the steps servers see on each table, from the order to the check. */
export default function Page({ goto }: BoPageProps) {
  const cfg = useConfig();
  const [tab, setTab] = usePageTab<FlowTab>('svcFlow', TABS);
  return (
    <BoPage
      title="Service Flow"
      actions={
        <ConfirmReset
          sections={['ciMin', 'greet', 'pud']}
          onReset={() => updateConfig({ flow: {}, course: {} })}
          title="Put service flow back to the default?"
          message="Coursing, greet times, pick up tracking and every switch on all three tabs go back to the standard."
          done="Service flow is back to the defaults"
        />
      }
    >
      <Tabs aria-label="Service flow" variant="underline" value={tab} onChange={setTab} options={TABS.map((id) => ({ id, label: TAB_LABELS[id] }))} />
      {tab === 'courses' && (
        <>
          <KitchenModeSetting />
          <Coursing />
          <BoSection title="After the entree">
            <FlowToggle k="checkIn" label="Check in after the entree" hint="Tables stay in Eating after course 2 until the server taps Check in. Off moves them straight to Ready to close." />
            {flag(cfg, 'checkIn') && <CheckInNudge />}
            <FlowToggle k="dessert" label="Ask about dessert" hint="After the check-in the card offers Dessert and No dessert. Off moves the table to Ready to close as soon as they check in." />
          </BoSection>
          <Greet />
        </>
      )}
      {tab === 'order' && (
        <>
          <BoSection title="Taking the order" sub="What the server's tablet does after each pick, so the order goes quickly.">
            <FlowToggle k="appToEntree" label="Move on to entrees after a starter" hint="Adding a starter switches the menu to Entrees for the next pick." />
            <FlowToggle
              k="entreeNext"
              label="Move on to the next diner after an entree"
              hint="Adding an entree selects the next diner and opens Starters. If the entree comes without a side, Sides opens first; picking one is optional. The last diner stays selected."
            />
            <FlowToggle k="dessertNext" label="Move on to the next diner after a dessert" hint="When the table orders dessert after the meal, adding one selects the next diner and stays on Desserts." />
            <FlowToggle k="hideDefaults" label="Hide default choices on the check" hint="A line only lists the choices the guest changed, not the ones that come with the dish." />
            <FlowToggle k="usuals" label="Show usual picks" hint="Before anything is ordered, a resident's usual drinks and dishes show as small chips under their name." />
          </BoSection>
          <BoSection
            title="Item names"
            sub="Each recipe has its menu name and a short name. Set the short name on the recipe."
            actions={
              <Button size="sm" variant="ghost" onClick={() => goto('recipes')}>
                Open the Recipe Book
              </Button>
            }
          >
            <FlowToggle k="shortServer" label="Short names for servers" hint="Menu tiles, the check and the usual picks use the short name." />
            <FlowToggle k="shortKitchen" label="Short names for the kitchen" hint="Cook line, expo and the bar use the short name." />
          </BoSection>
        </>
      )}
      {tab === 'pickup' && (
        <>
          <PickupTracking />
          <BoSection title="Comps for residents on hospice" sub="Mark a resident On hospice in Residents.">
            <FlowToggle k="hospiceAuto" label="Comp their meals" hint="Their meals are comped at close with the reason Hospice. No manager PIN, and no meal credit used." />
            <FlowToggle
              k="freeDeliveryComp"
              label="Waive their delivery fees"
              hint="The delivery fee is waived with no manager PIN. For anyone else a hospice waiver needs a manager PIN. Sick waivers have their own monthly limit, under Pick Up & Delivery."
            />
          </BoSection>
        </>
      )}
    </BoPage>
  );
}
