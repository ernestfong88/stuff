/**
 * Associate Meals: the associate menu each week, the standing choices, and
 * how associates plan meals by shift in the Associate App. Edits go to the
 * service settings, so every associate's phone has them at once.
 */
import { catalog, rooms } from '../../../data';
import { isoDate } from '../../../domain/pickup';
import { useDining } from '../../../store/dining';
import { setSetting } from '../../../store/serviceConfig';
import { Button, Chip, Stat, TextField, toast } from '../../../ui';
import { addDays, menuWeek, mondayOf, standingChoices, weekState, type MenuWeek, type WeekState } from '../../../domain/assocMeals/menu';
import { useAssocSettings } from '../../../domain/assocMeals/settings';
import { assocWindows, isLive, rangeLabel, windowMinutes, type AssocMealName } from '../../../domain/assocMeals/windows';
import { BoPage, BoRow, BoSection, NumberBox } from '../kit';
import type { BoPageProps } from '../nav';
import s from './assoc.module.css';

const STATE_CHIP: Record<WeekState, { label: string; tone: 'success' | 'info' | 'warning' }> = {
  active: { label: 'Active', tone: 'success' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  draft: { label: 'Draft', tone: 'warning' },
};

const shortDay = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const weekLabel = (monday: string) => `${shortDay(monday)} to ${shortDay(addDays(monday, 6))}`;

/** Entrées and specials on the dining menus, for the weekly special. */
const SPECIAL_CHOICES = [...new Set(catalog.filter((i) => i.special || /entr/i.test(i.category)).map((i) => i.name))].sort();

export default function Page({ goto }: BoPageProps) {
  const settings = useAssocSettings();
  const { assocOrders } = useDining();
  const todayIso = isoDate(0);
  const current = mondayOf(todayIso);
  const weeks = [current, addDays(current, 7)];

  const setWeek = (monday: string, patch: Partial<MenuWeek>) => setSetting(`am.weeks.${monday}`, { ...menuWeek(monday, todayIso, settings.weeks), ...patch });

  // This week's associate meals, from the dining store.
  const thisWeek = assocOrders.filter((o) => o.date >= current && o.date <= addDays(current, 6));
  const live = thisWeek.filter(isLive);
  const pickedUp = thisWeek.filter((o) => o.status === 'Picked up').length;
  const cancelled = thisWeek.length - live.length;
  const special = menuWeek(current, todayIso, settings.weeks);
  const specialDays = live.filter((o) => o.item === special.special).map((o) => o.date);
  const soldOutDays =
    special.special && special.cap > 0 ? [...new Set(specialDays)].filter((d) => specialDays.filter((x) => x === d).length >= special.cap).length : 0;

  const rangesFor = (meal: AssocMealName) => assocWindows(settings.grid, meal, '', []).map((w) => rangeLabel(windowMinutes(w) ?? 0));

  return (
    <BoPage title="Associate Meals" sub="Associates plan meals by shift in the Associate App · one venue per community serves them">
      <BoSection
        title="Associate menu"
        sub="A week is a draft until you schedule it, and goes live on its Monday. Associates can plan meals on scheduled and active weeks, up to the end of next week. Each week has one special with a daily limit, first come, first served; when it runs out it shows Sold out. The four standing choices are always on, with associate-only choices and no notes."
      >
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Week</th>
                <th>Special</th>
                <th>Associates per day</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((monday, i) => {
                const w = menuWeek(monday, todayIso, settings.weeks);
                const st = weekState(w, monday, todayIso);
                const name = i ? 'next week' : 'this week';
                return (
                  <tr key={monday}>
                    <td className={s.week}>
                      <div className={s.weekName}>{i ? 'Next week' : 'This week'}</div>
                      <div className={s.weekDates}>{weekLabel(monday)}</div>
                    </td>
                    <td>
                      <select className={s.select} aria-label={`Special for ${name}`} value={w.special} onChange={(e) => setWeek(monday, { special: e.target.value, sub: '' })}>
                        <option value="">No special</option>
                        {[...new Set([w.special, ...SPECIAL_CHOICES].filter(Boolean))].map((x) => (
                          <option key={x} value={x}>
                            {x}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <NumberBox value={w.cap} min={0} width={72} aria-label={`Associates per day for ${name}`} onChange={(v) => v != null && v >= 0 && setWeek(monday, { cap: Math.floor(v) })} />
                    </td>
                    <td>
                      <span className={s.status}>
                        <Chip tone={STATE_CHIP[st].tone} size="xs">
                          {STATE_CHIP[st].label}
                        </Chip>
                        {!w.sched ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              setWeek(monday, { sched: true });
                              toast(todayIso >= monday ? `Live now, associates can plan ${weekLabel(monday)}` : `Scheduled, live ${shortDay(monday)}. Associates can plan it now.`, { tone: 'success' });
                            }}
                          >
                            Schedule
                          </Button>
                        ) : (
                          st === 'scheduled' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setWeek(monday, { sched: false });
                                toast(`Back to draft, associates can't plan ${weekLabel(monday)}`);
                              }}
                            >
                              Back to draft
                            </Button>
                          )
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <h3 className={s.cap}>Standing choices · always on</h3>
        <div className={s.choices}>
          {standingChoices(settings.fixed).map((c) => (
            <div key={c.id} className={s.choice}>
              <div className={s.choiceName}>{c.name}</div>
              <TextField
                key={c.sub}
                defaultValue={c.sub}
                aria-label={`What ${c.name} is this week`}
                onBlur={(e) => {
                  const t = e.target.value.trim();
                  if (t && t !== c.sub) setSetting(`am.fixed.${c.id}`, { sub: t });
                  else e.target.value = c.sub;
                }}
              />
              <div className={s.choiceMods}>{c.mods.map((g) => `${g.group}, pick one: ${g.options.join(', ')}`).join(' · ')}</div>
            </div>
          ))}
        </div>
      </BoSection>

      <div className={s.stats}>
        <Stat value={live.length} label="Planned this week" />
        <Stat value={pickedUp} label="Picked up" tone="flora" />
        <Stat value={cancelled} label="Cancelled" tone="clay" />
        <Stat value={soldOutDays} label={soldOutDays === 1 ? 'Day the special sold out' : 'Days the special sold out'} tone="ocean" />
      </div>

      <BoSection title="Ordering">
        <BoRow label="Associate meal venue" hint="Exactly one per community. Its pick up ranges decide when associates can pick up.">
          <select className={s.select} value={settings.venue} onChange={(e) => setSetting('am.venue', e.target.value)} aria-label="Associate meal venue">
            {Object.entries(rooms).map(([id, r]) => (
              <option key={id} value={id}>
                {r.name}
              </option>
            ))}
          </select>
        </BoRow>
        <BoRow label="Ordering closes" hint="Minutes before a pickup range starts. NOC orders close this long before the dinner line closes.">
          <NumberBox value={settings.cutoffMin} min={0} unit="min" aria-label="Ordering closes, minutes before pickup" onChange={(v) => v != null && v >= 0 && setSetting('am.cut', Math.floor(v))} />
        </BoRow>
        <BoRow
          align="start"
          label="Pickup times"
          hint={
            <span className={s.ranges}>
              <span>Lunch: {rangesFor('Lunch').join(', ') || 'none'}</span>
              <span>Dinner: {rangesFor('Dinner').join(', ') || 'none'}</span>
              <span>NOC: {rangesFor('NOC').join(', ') || 'none'}</span>
            </span>
          }
        >
          <Button size="sm" onClick={() => goto('svcWin')}>
            Change in Pick Up Windows
          </Button>
        </BoRow>
        <p className={s.note}>
          Eligibility: a scheduled shift unlocks ordering (ADP identity, no PIN). Salaried and management associates can plan any day. A call-off in the Scheduling App cancels the order
          automatically. Coverage shifts are entered at the community tablet as Associate diners.
        </p>
      </BoSection>
    </BoPage>
  );
}

