import { useMemo, useState } from 'react';
import { FileText, Printer } from 'lucide-react';
import { now } from '../../../../lib/clock';
import { useSetting } from '../../../../store/serviceConfig';
import { Button, Chip, EmptyState, Tabs, cx, toast } from '../../../../ui';
import { BoPage } from '../../kit';
import { placementSides, useBo } from '../data';
import { dayStart, isoDay, parseIsoDay, venuesAt, weekStart } from '../../../../domain/menuCycle';
import { alaCarteMeals, menuDoc } from '../model/menuDoc';
import { menuWordDoc, wordFileName } from '../model/menuDocx';
import {
  docHtml,
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
import { fitMenu, useFittedMenu, type SplitMode } from '../ui/fitFrame';
import { PagePreview } from '../ui/PagePreview';
import { printHtml } from '../ui/printFrame';
import { downloadWord } from '../ui/wordExport';
import { exportWeeks, weekLabel } from './exportDays';
import {
  setAlaCartePages,
  setDietStyle,
  setPaper,
  setPrintPrices,
  useAlaCartePages,
  useDietStyle,
  usePaper,
  usePrintPrices,
  type DietStyle,
} from './paperStore';
import type { PriceField } from '../model/pricing';
import s from './ExportPage.module.css';

const KINDS: Array<{ id: PrintKind; label: string; name: string }> = [
  { id: 'daily', label: 'Daily', name: 'Daily menu' },
  { id: 'week', label: 'Weekly', name: 'Week at a glance' },
  { id: 'alacarte', label: 'À la carte', name: 'À la carte menu' },
  { id: 'order', label: 'Order form', name: 'Pick up order form' },
];

/** What a Word file is called after: "Sequoia daily menu 2026-10-08.docx". */
const FILE_WHAT: Record<PrintKind, string> = { daily: 'daily menu', week: 'week at a glance', alacarte: 'a la carte menu', order: 'order form' };

/** À la carte menus fit one page up to this many dishes. */
const ALA_CARTE_LIMIT = 20;

const DIET_STYLES: Array<{ id: DietStyle; label: string }> = [
  { id: 'off', label: 'Off' },
  { id: 'words', label: 'Words' },
  { id: 'icons', label: 'Icons' },
];

/** Which price prints with each dish. */
const PRICE_OPTIONS: Array<{ value: PriceField | 'off'; label: string }> = [
  { value: 'off', label: 'Off' },
  { value: 'guest', label: 'Guest' },
  { value: 'ala', label: 'À la carte' },
  { value: 'res', label: 'Resident' },
];

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
  const dietStyle = useDietStyle();
  const prices = usePrintPrices();
  const diet = dietStyle !== 'off';
  const dietIcons = dietStyle === 'icons';
  const [snacks, setSnacks] = useState(false);
  // The date the daily menu prints, and the Sunday of the week the others print.
  const [date, setDate] = useState(() => isoDay(dayStart(at)));
  const [week, setWeek] = useState(() => isoDay(weekStart(at)));
  // Daily: meals printed a page each; à la carte: meals printed a section each. Empty prints every meal.
  const [meals, setMeals] = useState<string[]>([]);
  const paperId = usePaper(kind);
  const alcPages = useAlaCartePages();
  const alc = kind === 'alacarte';
  const paper = paperOf(paperId);
  const venue = venues.find((v) => v.id === venueId) ?? venues[0];
  const daily = kind === 'daily';
  const weeks = useMemo(() => exportWeeks(at), [at]);
  const printAt = (daily ? (parseIsoDay(date) ?? dayStart(at)) : (parseIsoDay(week) ?? weekStart(at))).getTime();

  const ctx = useMemo(
    () =>
      printContext(
        bo,
        { venueId: venue?.id, template, diet, dietIcons, prices, snacks, winGrid, paper: paperId, at: printAt },
        (m, d, r) => placementSides(bo, m, d, r).sides,
      ),
    [bo, venue, template, diet, dietIcons, prices, snacks, winGrid, paperId, printAt],
  );
  const mealOptions = useMemo(() => (daily ? printMeals(ctx) : alc ? alaCarteMeals(ctx) : []), [ctx, daily, alc]);
  const picked = useMemo(() => meals.filter((m) => mealOptions.includes(m)), [meals, mealOptions]);
  const pick = useMemo(() => ({ meals: picked, weekOf: daily ? null : new Date(printAt), pages: alcPages }), [picked, daily, printAt, alcPages]);
  const doc = useMemo(() => menuDoc(kind, ctx, pick), [kind, ctx, pick]);
  // A daily menu with every meal goes onto two pages only when one page would be too small to read.
  const split: SplitMode = daily && !picked.length ? 'auto' : alc && alcPages === 2 ? 'two' : 'none';
  const { fitted, current } = useFittedMenu(doc, ctx.options, split);
  const html = useMemo(() => fitted?.html ?? docHtml(doc, ctx.options), [fitted, doc, ctx.options]);
  const pages = (fitted ?? { doc }).doc.sheets.length;
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
  // The fitted menu as previewed; measured now if the preview has not caught up yet.
  const ready = () => (fitted && current ? Promise.resolve(fitted) : fitMenu(doc, ctx.options, split));
  const when = daily
    ? new Date(printAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) +
      (picked.length ? ', ' + picked.join(', ') : '')
    : weekLabel(new Date(printAt)) + (picked.length ? ', ' + picked.join(', ') : '');
  const print = () =>
    ready().then((f) => {
      printHtml(f.html);
      toast(`${kindName} for ${when} sent to the printer · ${paper.name}`, { tone: 'success' });
    });
  const exportWord = () =>
    ready()
      .then((f) => {
        const file = wordFileName(venue.name, FILE_WHAT[kind], daily ? date : week);
        return downloadWord(menuWordDoc(f.doc, paper, f.fits, template), file).then(() => toast(`${file} downloaded`, { tone: 'success' }));
      })
      .catch(() => toast('Could not make the Word file. Try again.', { tone: 'danger' }));

  return (
    <BoPage
      title="Menu Export"
      actions={
        <>
          <Button variant="secondary" icon={<FileText size={16} />} onClick={exportWord}>
            Export to Word
          </Button>
          <Button variant="primary" icon={<Printer size={16} />} onClick={print}>
            Print
          </Button>
        </>
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
        {(daily || alc) && (
          <Field label="Meals">
            <div className={s.picks} role="group" aria-label="Meals">
              <button className={cx(s.pick, !picked.length && s.pickOn)} aria-pressed={!picked.length} onClick={() => setMeals([])}>
                {daily ? 'All on one page' : 'All meals'}
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
        {alc && (
          <Field label="Pages">
            <Tabs
              variant="segmented"
              size="sm"
              value={String(alcPages) as '1' | '2'}
              onChange={(v) => setAlaCartePages(v === '2' ? 2 : 1)}
              options={[
                { id: '1', label: '1' },
                { id: '2', label: '2' },
              ]}
              aria-label="Pages"
            />
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
        <Field label="Diet indicators">
          <Tabs variant="segmented" size="sm" value={dietStyle} onChange={setDietStyle} options={DIET_STYLES} aria-label="Diet indicators" />
        </Field>
        <Field label="Prices">
          <Select
            size="sm"
            aria-label="Prices"
            value={prices ?? 'off'}
            onChange={(v) => setPrintPrices(v === 'off' ? null : (v as PriceField))}
            options={PRICE_OPTIONS}
          />
        </Field>
        <div className={s.checks}>
          <label className={s.check}>
            <input type="checkbox" checked={snacks} onChange={(e) => setSnacks(e.target.checked)} />
            Snacks (dietitian copy)
          </label>
        </div>
        {prices && kind === 'week' && (
          <p className={s.notice} role="status">
            The week at a glance has no room for prices. They print on the daily menu, à la carte menu and order form.
          </p>
        )}
        {fitted?.overflowed && current && (
          <p className={s.notice} role="status">
            Doesn't fit on one page at a readable size — printing on 2 pages
          </p>
        )}
        {alc && alcPages === 1 && current && fitted?.fits.some((f) => !f.readable) && (
          <p className={s.notice} role="status">
            One page needs very small type for this menu — 2 pages reads better
          </p>
        )}
      </section>

      <section className={s.preview} aria-label="Preview">
        <div className={s.previewHead}>
          <span className={s.label}>
            Preview · {count} {count === 1 ? 'item' : 'items'}
            {pages > 1 ? ` · ${pages} pages` : ''}
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
