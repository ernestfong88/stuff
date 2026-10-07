import { useMemo, useState } from 'react';
import { Plus, Printer as PrinterIcon, Search, TriangleAlert, X } from 'lucide-react';
import { rooms } from '../../../data';
import { EMPTY_PICK, PRINT_GROUPS, printRoute, unprintedGroups, type PrintGroup, type PrintPick } from '../../../domain/printing';
import { printOptions, type PrintOption } from '../../../store/printing';
import { kitchenPrinters, setPrinterRoute, useVenueSettings, type Printer } from '../../../store/venueSettings';
import { useRecipeBookVersion } from '../../../store/recipes';
import { cx, Tabs } from '../../../ui';
import { BoSection } from '../kit';
import s from './PrinterRouting.module.css';

/**
 * Printer mode: what each printer prints. A printer prints the whole ticket
 * (the pass, a small kitchen with one printer) or only what it is set to:
 * whole groups (entrées and sides to the hot line), Recipe Book categories
 * (entrée salads to the pantry) or single recipes (the burger to the grill).
 * The most specific setting wins.
 */
export function PrinterRouting() {
  const settings = useVenueSettings();
  const book = useRecipeBookVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the options change when the Recipe Book does
  const options = useMemo(() => printOptions(), [book]);
  const printers = settings.printers.filter((p) => p.active && p.type !== 'Label');
  const venuesOf = (id: string) =>
    settings.printerLinks
      .filter((l) => l.printerId === id)
      .map((l) => settings.venues.find((v) => v.id === l.venueId)?.name)
      .filter(Boolean);
  const groupOf = new Map(options.map((o) => [o.key, o.group]));
  const gaps = Object.keys(rooms)
    .map((room) => ({
      room,
      missing: unprintedGroups(
        kitchenPrinters(settings, room).filter((p) => p.active),
        (id) => groupOf.get(id),
      ),
    }))
    .filter((g) => g.missing.length && kitchenPrinters(settings, g.room).length);

  return (
    <BoSection
      title="What each printer prints"
      sub="When the server sends, each printer gets one ticket with its items. Set a printer to whole groups, to Recipe Book categories, or to single recipes. The most specific wins: a recipe or category picked for one printer prints there instead of at the printer that takes its whole group. Add or remove printers on each venue's Devices tab."
    >
      {gaps.map((g) => {
        const none = g.missing.filter((m) => !m.partly).map((m) => m.group);
        const partly = g.missing.filter((m) => m.partly).map((m) => m.group);
        return (
          <p key={g.room} className={s.warn} role="status">
            <TriangleAlert size={15} aria-hidden />
            <span>
              {rooms[g.room].name} kitchen: {none.length > 0 && `${listText(none)} ${none.length === 1 ? "doesn't" : "don't"} print anywhere. `}
              {partly.length > 0 && `${listText(partly)} only print${partly.length === 1 ? 's' : ''} where a category or recipe is picked.`}
            </span>
          </p>
        );
      })}
      {printers.length === 0 && <p className={s.empty}>No kitchen printers yet. Add one on a venue's Devices tab.</p>}
      <ul className={s.list}>
        {printers.map((p) => (
          <PrinterRow key={p.id} printer={p} venues={venuesOf(p.id).join(', ')} options={options} />
        ))}
      </ul>
    </BoSection>
  );
}

function PrinterRow({ printer: p, venues, options }: { printer: Printer; venues: string; options: PrintOption[] }) {
  const route = printRoute(p);
  const whole = route === 'all';
  const pick: PrintPick = whole ? EMPTY_PICK : route;
  const save = (next: Partial<PrintPick>) => setPrinterRoute(p.id, { ...pick, ...next });
  const toggleGroup = (g: PrintGroup) =>
    save({ groups: pick.groups.includes(g) ? pick.groups.filter((x) => x !== g) : PRINT_GROUPS.filter((x) => x === g || pick.groups.includes(x)) });
  const byKey = new Map(options.map((o) => [o.key, o]));
  const picked = [...pick.subs, ...pick.recipes].map(
    (k) => byKey.get(k) ?? { key: k, label: k, group: 'Entrées' as PrintGroup, kind: 'recipe' as const, hint: '' },
  );
  const remove = (o: PrintOption) =>
    save(o.kind === 'sub' ? { subs: pick.subs.filter((k) => k !== o.key) } : { recipes: pick.recipes.filter((k) => k !== o.key) });
  const add = (o: PrintOption) => save(o.kind === 'sub' ? { subs: [...pick.subs, o.key] } : { recipes: [...pick.recipes, o.key] });
  const nothing = !whole && !pick.groups.length && !picked.length;

  return (
    <li className={s.row}>
      <div className={s.head}>
        <PrinterIcon size={16} className={s.icon} aria-hidden />
        <span className={s.main}>
          <span className={s.name}>{p.name}</span>
          <span className={s.meta}>
            {p.type} · {venues || 'No venue'}
          </span>
        </span>
        <Tabs
          variant="segmented"
          size="sm"
          aria-label={`What ${p.name} prints`}
          value={whole ? 'all' : 'some'}
          onChange={(v) => setPrinterRoute(p.id, v === 'all' ? 'all' : whole ? { ...EMPTY_PICK, groups: ['Entrées'] } : pick)}
          options={[
            { id: 'all', label: 'Whole ticket' },
            { id: 'some', label: 'Only some items' },
          ]}
        />
      </div>
      {!whole && (
        <div className={s.body}>
          <div className={s.level}>
            <span className={s.levelLabel}>Groups</span>
            <div className={s.groups} role="group" aria-label={`Groups ${p.name} prints`}>
              {PRINT_GROUPS.map((g) => {
                const on = pick.groups.includes(g);
                return (
                  <button key={g} className={cx(s.group, on && s.groupOn)} aria-pressed={on} onClick={() => toggleGroup(g)}>
                    {g}
                  </button>
                );
              })}
            </div>
          </div>
          <div className={s.level}>
            <span className={s.levelLabel}>Categories and recipes</span>
            <div className={s.groups}>
              {picked.map((o) => (
                <span key={o.key} className={cx(s.picked, o.kind === 'recipe' && s.pickedRecipe)}>
                  <span className={s.pickedKind}>{o.kind === 'sub' ? 'Category' : 'Recipe'}</span>
                  {o.label}
                  <button className={s.unpick} onClick={() => remove(o)} aria-label={`Stop printing ${o.label} at ${p.name}`}>
                    <X size={13} />
                  </button>
                </span>
              ))}
              <OptionSearch
                printer={p.name}
                options={options.filter((o) => !pick.subs.includes(o.key) && !pick.recipes.includes(o.key))}
                onPick={add}
              />
            </div>
          </div>
          {nothing && <span className={s.none}>Prints nothing</span>}
        </div>
      )}
    </li>
  );
}

/** Type to find a Recipe Book category or a recipe on the menu, and add it to a printer. */
function OptionSearch({ printer, options, onPick }: { printer: string; options: PrintOption[]; onPick: (o: PrintOption) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const needle = q.trim().toLowerCase();
  const hits = needle
    ? options.filter((o) => o.label.toLowerCase().includes(needle) || o.hint.toLowerCase().includes(needle))
    : options.filter((o) => o.kind === 'sub');
  // Categories first, then recipes.
  const shown = [...hits.filter((o) => o.kind === 'sub'), ...hits.filter((o) => o.kind === 'recipe')].slice(0, 8);
  const pick = (o: PrintOption) => {
    onPick(o);
    setQ('');
  };
  return (
    <span className={s.search} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOpen(false)}>
      {open ? <Search size={14} className={s.searchIcon} aria-hidden /> : <Plus size={14} className={s.searchIcon} aria-hidden />}
      <input
        className={s.searchInput}
        value={q}
        placeholder="Add a category or recipe"
        aria-label={`Add a category or recipe to ${printer}`}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && shown[0]) pick(shown[0]);
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && (
        <span className={s.menu} role="listbox">
          {shown.map((o) => (
            <button
              key={o.key}
              role="option"
              aria-selected={false}
              className={s.option}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o)}
            >
              <span className={s.optionLabel}>{o.label}</span>
              <span className={s.optionHint}>
                {o.kind === 'sub' ? 'Category' : 'Recipe'} · {o.hint}
              </span>
            </button>
          ))}
          {!shown.length && <span className={s.noHit}>No category or recipe matches “{q}”.</span>}
          {!needle && <span className={s.noHit}>Type to find a recipe.</span>}
        </span>
      )}
    </span>
  );
}

function listText(xs: string[]): string {
  return xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}
