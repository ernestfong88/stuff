import { useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { now } from '../../../../lib/clock';
import { useSetting } from '../../../../store/serviceConfig';
import { Button, Chip, EmptyState, Tabs, cx, toast } from '../../../../ui';
import { BoPage } from '../../kit';
import { placementSides, useBo } from '../data';
import { venuesAt } from '../../../../domain/menuCycle';
import { menuHtml, printContext, printedRecipes, printWeek, TEMPLATES, weekDays, type PrintKind, type TemplateId } from '../model/menuPrint';
import { Field, Select } from '../ui/controls';
import { PagePreview } from '../ui/PagePreview';
import { printHtml } from '../ui/printFrame';
import { dayLabel, exportDays, exportWeeks } from './exportDays';
import s from './ExportPage.module.css';

const KINDS: Array<{ id: PrintKind; label: string; name: string }> = [
  { id: 'daily', label: 'Daily', name: 'Daily menu' },
  { id: 'week', label: 'Weekly', name: 'Week at a glance' },
  { id: 'alacarte', label: 'À la carte', name: 'À la carte menu' },
  { id: 'order', label: 'Order form', name: 'Pick up order form' },
];

/** À la carte menus fit one page up to this many dishes. */
const ALA_CARTE_LIMIT = 20;

/** Menu Export: printable menus for residents and the weekly pick up order form. */
export function ExportPage() {
  const bo = useBo();
  const winGrid = useSetting<unknown>('win.grid');
  const [at] = useState(now);
  const venues = useMemo(() => venuesAt(bo.venues, at).filter((v) => v.active && (v.menuId || v.alcMenuId)), [bo.venues, at]);
  const [venueId, setVenueId] = useState(venues[0]?.id ?? '');
  const [kind, setKind] = useState<PrintKind>('daily');
  const [template, setTemplate] = useState<TemplateId>('classic');
  const [diet, setDiet] = useState(true);
  const [snacks, setSnacks] = useState(false);
  // The day or week to print; null follows today.
  const [dayPick, setDayPick] = useState<number | null>(null);
  const [weekPick, setWeekPick] = useState<number | null>(null);
  const venue = venues.find((v) => v.id === venueId) ?? venues[0];

  const ctx = useMemo(
    () => printContext(bo, { venueId: venue?.id, template, diet, snacks, winGrid, at }, (m, d, r) => placementSides(bo, m, d, r).sides),
    [bo, venue, template, diet, snacks, winGrid, at],
  );
  const dayOptions = exportDays(ctx.today, ctx.len);
  const day = dayPick != null && dayOptions.includes(dayPick) ? dayPick : ctx.today;
  const weekOptions = exportWeeks(printWeek(ctx), ctx.len);
  const week = weekPick != null && weekOptions.includes(weekPick) ? weekPick : printWeek(ctx);
  const html = useMemo(() => menuHtml(kind, ctx, { day, week }), [kind, ctx, day, week]);
  // The dishes the printout lists, so the count matches what prints.
  const count = useMemo(() => printedRecipes(kind, ctx, { day, week }).size, [kind, ctx, day, week]);

  if (!venue) {
    return (
      <BoPage title="Menu Export">
        <EmptyState title="No venue serves a menu yet">Give a venue a menu in Venue Settings to print its menus.</EmptyState>
      </BoPage>
    );
  }

  const kindName = KINDS.find((k) => k.id === kind)!.name;
  const tpl = TEMPLATES.find((t) => t.id === template)!;
  const weeks = Math.ceil(ctx.len / 7);
  const print = () => {
    printHtml(html);
    const when =
      kind === 'daily' && day ? `, ${ctx.dateOf(day).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}` : '';
    toast(`${kindName}${when} sent to the printer · ${tpl.name} template`, { tone: 'success' });
  };

  return (
    <BoPage
      title="Menu Export"
      actions={
        <Button variant="primary" icon={<Printer size={16} />} onClick={print}>
          Print
        </Button>
      }
    >
      <div className={s.layout}>
        <div className={s.side}>
          <section className={s.card}>
            <Field label="Venue">
              <Select
                value={venue.id}
                onChange={(v) => {
                  setVenueId(v);
                  setDayPick(null);
                  setWeekPick(null);
                }}
                options={venues.map((v) => ({ value: v.id, label: v.name }))}
              />
            </Field>
            <Tabs
              variant="segmented"
              size="sm"
              value={kind}
              onChange={setKind}
              options={KINDS.map((k) => ({ id: k.id, label: k.label }))}
              aria-label="Printout"
              className={s.kinds}
            />
            {kind === 'daily' && dayOptions.length > 0 && (
              <Field label="Day">
                <div className={s.dayPicks} role="radiogroup" aria-label="Day">
                  {dayOptions.map((d) => (
                    <button
                      key={d}
                      role="radio"
                      aria-checked={d === day}
                      className={cx(s.dayPick, d === day && s.dayPickOn)}
                      onClick={() => setDayPick(d)}
                    >
                      {dayLabel(d - ctx.today, ctx.dateOf(d))}
                    </button>
                  ))}
                </div>
                <p className={s.hint}>
                  Day {day} of the {weeks}-week cycle.
                </p>
              </Field>
            )}
            {(kind === 'week' || kind === 'order') && weeks > 0 && (
              <Field label="Week">
                {weekOptions.length > 1 && (
                  <Tabs
                    variant="segmented"
                    size="sm"
                    aria-label="Week"
                    value={String(week)}
                    onChange={(w) => setWeekPick(Number(w))}
                    options={weekOptions.map((w, i) => ({ id: String(w), label: i === 0 ? 'This week' : 'Next week' }))}
                  />
                )}
                <p className={s.hint}>
                  Week {week + 1} of the {weeks}-week cycle,{' '}
                  {ctx.dateOf(weekDays(ctx, week)[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to{' '}
                  {ctx.dateOf(weekDays(ctx, week).slice(-1)[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. The menu builder
                  prints any week.
                </p>
              </Field>
            )}
            {kind !== 'alacarte' && weeks === 0 && (
              <p className={s.hint}>{venue.name} serves an à la carte menu, so the printout lists what it offers every day.</p>
            )}
          </section>

          <section className={s.card}>
            <div className={s.label}>Template</div>
            <div className={s.templates} role="radiogroup" aria-label="Template">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  role="radio"
                  aria-checked={template === t.id}
                  className={cx(s.template, template === t.id && s.templateOn)}
                  onClick={() => setTemplate(t.id)}
                >
                  <span className={s.templateName}>{t.name}</span>
                  <span className={s.templateUse}>{t.use}</span>
                </button>
              ))}
            </div>
            <p className={s.hint}>
              Marketing keeps these templates, and each one adds {venue.name}&apos;s logo. You choose one but can&apos;t edit it, so the brand stays
              right and typos stay off the menu.
            </p>
          </section>

          <section className={s.card}>
            <label className={s.check}>
              <input type="checkbox" checked={diet} onChange={(e) => setDiet(e.target.checked)} />
              Diet indicators
            </label>
            <label className={s.check}>
              <input type="checkbox" checked={snacks} onChange={(e) => setSnacks(e.target.checked)} />
              Snacks section (for the dietitian&apos;s copy, not for residents)
            </label>
            <p className={s.hint}>The notice about raw or undercooked food always prints, on every menu.</p>
          </section>
        </div>

        <section className={s.preview} aria-label="Preview">
          <div className={s.previewHead}>
            <span className={s.label}>
              Preview · {count} {count === 1 ? 'item' : 'items'}
            </span>
            {kind === 'alacarte' && (
              <Chip tone={count > ALA_CARTE_LIMIT ? 'danger' : 'success'}>
                {count} / {ALA_CARTE_LIMIT} item limit{count > ALA_CARTE_LIMIT ? ', trim before export' : ''}
              </Chip>
            )}
          </div>
          <PagePreview html={html} title={`${kindName} preview`} landscape={kind === 'week'} />
        </section>
      </div>
    </BoPage>
  );
}
