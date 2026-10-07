import { useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { COMMUNITY_NAME } from '../../../../data';
import { now } from '../../../../lib/clock';
import { useSetting } from '../../../../store/serviceConfig';
import { Button, Chip, EmptyState, Tabs, cx, toast } from '../../../../ui';
import { BoPage } from '../../kit';
import { placementSides, useBo } from '../data';
import { venuesAt } from '../../../../domain/menuCycle';
import { alaCarteItems, menuHtml, printContext, printWeek, TEMPLATES, weekDays, type PrintKind, type TemplateId } from '../model/menuPrint';
import { Field, Select } from '../ui/controls';
import { PagePreview } from '../ui/PagePreview';
import { printHtml } from '../ui/printFrame';
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
  const venues = useMemo(() => venuesAt(bo.venues, at).filter((v) => v.active && v.menuId), [bo.venues, at]);
  const [venueId, setVenueId] = useState(venues[0]?.id ?? '');
  const [kind, setKind] = useState<PrintKind>('daily');
  const [template, setTemplate] = useState<TemplateId>('classic');
  const [diet, setDiet] = useState(true);
  const [snacks, setSnacks] = useState(false);
  const venue = venues.find((v) => v.id === venueId) ?? venues[0];

  const ctx = useMemo(
    () => printContext(bo, { venueId: venue?.id, template, diet, snacks, winGrid, at }, (m, d, r) => placementSides(bo, m, d, r).sides),
    [bo, venue, template, diet, snacks, winGrid, at],
  );
  const html = useMemo(() => menuHtml(kind, ctx), [kind, ctx]);
  const count = useMemo(() => {
    if (kind === 'alacarte') return alaCarteItems(ctx).length;
    const days = kind === 'daily' ? [0, ctx.today || 1] : weekDays(ctx, printWeek(ctx));
    const lines = days.flatMap((d) => ctx.at(d)).filter((x) => (kind === 'order' ? x.c !== 'Sides' && x.g.day > 0 : true));
    return new Set(lines.map((x) => x.r.id)).size;
  }, [kind, ctx]);

  if (!venue) {
    return (
      <BoPage title="Menu Export" sub="Letter-size menus for residents.">
        <EmptyState title="No venue serves a menu yet">Give a venue a menu in Venue Settings to print its menus.</EmptyState>
      </BoPage>
    );
  }

  const kindName = KINDS.find((k) => k.id === kind)!.name;
  const tpl = TEMPLATES.find((t) => t.id === template)!;
  const weeks = Math.ceil(ctx.len / 7);
  const print = () => {
    printHtml(html);
    toast(`${kindName} sent to the printer · ${tpl.name} template, ${venue.name} header`, { tone: 'success' });
  };

  return (
    <BoPage
      title="Menu Export"
      sub={`Letter-size menus for residents with ${COMMUNITY_NAME} branding: the daily menu, the week, à la carte and the pick up order form. The menu builder prints them too.`}
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
              <Select value={venue.id} onChange={setVenueId} options={venues.map((v) => ({ value: v.id, label: v.name }))} />
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
            {kind === 'daily' && weeks > 0 && ctx.today > 0 && (
              <p className={s.hint}>
                Today is week {Math.ceil(ctx.today / 7)} of the {weeks}-week cycle. The export follows it automatically.
              </p>
            )}
            {(kind === 'week' || kind === 'order') && weeks > 0 && (
              <p className={s.hint}>
                Prints week {printWeek(ctx) + 1} of the {weeks}-week cycle, the one running now. The menu builder prints any week.
              </p>
            )}
            {kind !== 'alacarte' && weeks === 0 && (
              <p className={s.hint}>{venue.name} serves an à la carte menu, so the printout lists what it offers every day.</p>
            )}
          </section>

          <section className={s.card}>
            <div className={s.label}>Template · maintained by marketing, HO managed</div>
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
              Every template drops in {venue.name}&apos;s logo automatically. Communities pick, never edit: that keeps the brand and keeps typos off the menu.
            </p>
          </section>

          <section className={s.card}>
            <label className={s.check}>
              <input type="checkbox" checked={diet} onChange={(e) => setDiet(e.target.checked)} />
              Diet indicators
            </label>
            <label className={s.check}>
              <input type="checkbox" checked={snacks} onChange={(e) => setSnacks(e.target.checked)} />
              Snacks section, dietitian copy only, hidden from residents
            </label>
            <p className={s.hint}>The raw-food consumption notice prints on every export automatically, including à la carte. It is not optional.</p>
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
