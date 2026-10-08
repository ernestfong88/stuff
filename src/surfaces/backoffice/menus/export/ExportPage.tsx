import { useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { now } from '../../../../lib/clock';
import { useSetting } from '../../../../store/serviceConfig';
import { Button, Chip, EmptyState, Tabs, cx, toast } from '../../../../ui';
import { BoPage } from '../../kit';
import { placementSides, useBo } from '../data';
import { dayStart, isoDay, parseIsoDay, venuesAt, weekStart } from '../../../../domain/menuCycle';
import {
  menuHtml,
  PAPERS,
  paperOf,
  printContext,
  printedRecipes,
  printMeals,
  TEMPLATES,
  type PaperId,
  type PrintKind,
  type TemplateId,
} from '../model/menuPrint';
import { Field, Input, Select } from '../ui/controls';
import { PagePreview } from '../ui/PagePreview';
import { printHtml } from '../ui/printFrame';
import { exportWeeks, weekLabel } from './exportDays';
import { setPaper, usePaper } from './paperStore';
import s from './ExportPage.module.css';

const KINDS: Array<{ id: PrintKind; label: string; name: string }> = [
  { id: 'daily', label: 'Daily', name: 'Daily menu' },
  { id: 'week', label: 'Weekly', name: 'Week at a glance' },
  { id: 'alacarte', label: 'À la carte', name: 'À la carte menu' },
  { id: 'order', label: 'Order form', name: 'Pick up order form' },
];

/** À la carte menus fit one page up to this many dishes. */
const ALA_CARTE_LIMIT = 20;

/** Preview width per inch of paper, so a half sheet previews smaller than a tabloid. */
const PREVIEW_PX_PER_IN = 84;

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
  // The date the daily menu prints, and the Sunday of the week the others print.
  const [date, setDate] = useState(() => isoDay(dayStart(at)));
  const [week, setWeek] = useState(() => isoDay(weekStart(at)));
  // Meals printed a page each; empty prints every meal on one page.
  const [meals, setMeals] = useState<string[]>([]);
  const paperId = usePaper(kind);
  const paper = paperOf(paperId);
  const venue = venues.find((v) => v.id === venueId) ?? venues[0];
  const daily = kind === 'daily';
  const weeks = useMemo(() => exportWeeks(at), [at]);
  const printAt = (daily ? (parseIsoDay(date) ?? dayStart(at)) : (parseIsoDay(week) ?? weekStart(at))).getTime();

  const ctx = useMemo(
    () =>
      printContext(
        bo,
        { venueId: venue?.id, template, diet, snacks, winGrid, paper: paperId, at: printAt },
        (m, d, r) => placementSides(bo, m, d, r).sides,
      ),
    [bo, venue, template, diet, snacks, winGrid, paperId, printAt],
  );
  const mealOptions = useMemo(() => printMeals(ctx), [ctx]);
  const picked = useMemo(() => (daily ? meals.filter((m) => mealOptions.includes(m)) : []), [daily, meals, mealOptions]);
  const pick = useMemo(() => ({ meals: picked, weekOf: daily ? null : new Date(printAt) }), [picked, daily, printAt]);
  const html = useMemo(() => menuHtml(kind, ctx, pick), [kind, ctx, pick]);
  // The dishes the printout lists, so the count matches what prints.
  const count = useMemo(() => printedRecipes(kind, ctx, pick).size, [kind, ctx, pick]);

  if (!venue) {
    return (
      <BoPage title="Menu Export">
        <EmptyState title="No venue serves a menu yet">Give a venue a menu in Venue Settings to print its menus.</EmptyState>
      </BoPage>
    );
  }

  const kindName = KINDS.find((k) => k.id === kind)!.name;
  const landscape = kind === 'week';
  const toggleMeal = (m: string) => setMeals(picked.includes(m) ? picked.filter((x) => x !== m) : [...picked, m]);
  const print = () => {
    printHtml(html);
    const when = daily
      ? new Date(printAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) +
        (picked.length ? ', ' + picked.join(', ') : '')
      : weekLabel(new Date(printAt));
    toast(`${kindName} for ${when} sent to the printer · ${paper.name}`, { tone: 'success' });
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
      <section className={s.bar} aria-label="Print options">
        <Field label="Venue">
          <Select size="sm" value={venue.id} onChange={setVenueId} options={venues.map((v) => ({ value: v.id, label: v.name }))} />
        </Field>
        <Field label="Menu">
          <Tabs
            variant="segmented"
            size="sm"
            value={kind}
            onChange={setKind}
            options={KINDS.map((k) => ({ id: k.id, label: k.label }))}
            aria-label="Printout"
          />
        </Field>
        {daily ? (
          <Field label="Date">
            <Input size="sm" type="date" aria-label="Date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </Field>
        ) : (
          <Field label="Week">
            <Select
              size="sm"
              value={week}
              onChange={setWeek}
              options={weeks.map((w) => ({ value: isoDay(w), label: weekLabel(w) + (isoDay(w) === isoDay(weekStart(at)) ? ' · this week' : '') }))}
            />
          </Field>
        )}
        {daily && (
          <Field label="Meals">
            <div className={s.picks} role="group" aria-label="Meals">
              <button className={cx(s.pick, !picked.length && s.pickOn)} aria-pressed={!picked.length} onClick={() => setMeals([])}>
                All on one page
              </button>
              {mealOptions.map((m) => (
                <button
                  key={m}
                  className={cx(s.pick, picked.includes(m) && s.pickOn)}
                  aria-pressed={picked.includes(m)}
                  onClick={() => toggleMeal(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </Field>
        )}
        <Field label="Paper">
          <Select
            size="sm"
            value={paperId}
            onChange={(v) => setPaper(kind, v as PaperId)}
            options={PAPERS.map((p) => ({ value: p.id, label: p.name }))}
          />
        </Field>
        <Field label="Template">
          <Select
            size="sm"
            value={template}
            onChange={(v) => setTemplate(v as TemplateId)}
            options={TEMPLATES.map((t) => ({ value: t.id, label: t.name }))}
          />
        </Field>
        <div className={s.checks}>
          <label className={s.check}>
            <input type="checkbox" checked={diet} onChange={(e) => setDiet(e.target.checked)} />
            Diet indicators
          </label>
          <label className={s.check}>
            <input type="checkbox" checked={snacks} onChange={(e) => setSnacks(e.target.checked)} />
            Snacks (dietitian copy)
          </label>
        </div>
      </section>

      <section className={s.preview} aria-label="Preview">
        <div className={s.previewHead}>
          <span className={s.label}>
            Preview · {count} {count === 1 ? 'item' : 'items'}
            {daily && picked.length > 1 ? ` · ${picked.length} pages` : ''}
          </span>
          {kind === 'alacarte' && (
            <Chip tone={count > ALA_CARTE_LIMIT ? 'danger' : 'success'}>
              {count} / {ALA_CARTE_LIMIT} item limit{count > ALA_CARTE_LIMIT ? ', trim before export' : ''}
            </Chip>
          )}
        </div>
        <div className={s.sheet} style={{ maxWidth: Math.round((landscape ? paper.h : paper.w) * PREVIEW_PX_PER_IN) }}>
          <PagePreview html={html} title={`${kindName} preview`} landscape={landscape} paper={paper} />
        </div>
      </section>
    </BoPage>
  );
}
