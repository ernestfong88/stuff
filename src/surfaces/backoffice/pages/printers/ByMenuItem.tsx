import { Fragment, useMemo, useState } from 'react';
import { Check, ChevronDown, TriangleAlert } from 'lucide-react';
import { rooms } from '../../../../data';
import { itemPrinterIds, printersFor, printRoute, setItemPrinters, subLabel, type PrintItem, type RoutedPrinter } from '../../../../domain/printing';
import { printMenuItems, type PrintMenuRow } from '../../../../store/printing';
import { useRecipeBookVersion } from '../../../../store/recipes';
import { kitchenPrinters, setPrinterRoutes, type Printer, type Venue, type VenueSettings } from '../../../../store/venueSettings';
import { Chip, MenuDivider, MenuItem, Popover, SearchField, Tabs, cx, toast } from '../../../../ui';
import { BoSection } from '../../kit';
import s from './printers.module.css';

type Show = 'all' | 'nowhere' | 'item';

/** Why an item prints where it does, in a few words. */
function reason(row: PrintItem, printers: RoutedPrinter[], picked: string[]): string {
  if (picked.length) return 'Set for this item';
  const picks = printers.map(printRoute).filter((r) => r !== 'all');
  if (row.sub && picks.some((r) => r.subs.includes(row.sub!))) return `By category · ${subLabel(row.sub)}`;
  if (picks.some((r) => r.groups.includes(row.group))) return `By group · ${row.group}`;
  return printers.some((p) => printRoute(p) === 'all') ? 'Whole-ticket printers only' : '';
}

/**
 * Every item on the tablet menu, where it prints in one kitchen today, and
 * a Send to control that sets a rule for that one item: it prints at exactly
 * the printers picked (and at the whole-ticket printers), or back to
 * Automatic, where its category or group decides. With a venue picked on
 * the page it shows that venue's kitchen.
 */
export function ByMenuItem({ settings, venue }: { settings: VenueSettings; venue?: Venue | null }) {
  const book = useRecipeBookVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the menu's recipes change when the Recipe Book does
  const rows = useMemo(() => printMenuItems(), [book]);
  const kitchens = Object.keys(rooms).filter((k) => settings.venues.some((v) => v.active && v.room === k));
  const [picked, setRoom] = useState(kitchens[0] ?? Object.keys(rooms)[0]);
  const room = venue ? venue.room : picked;
  const [q, setQ] = useState('');
  const [show, setShow] = useState<Show>('all');
  const printers = room ? kitchenPrinters(settings, room).filter((p) => p.active) : [];
  const venues = settings.venues.filter((v) => v.active && v.room === room).map((v) => v.name);

  const all = rows.map((row) => {
    const picked = row.recipeId ? itemPrinterIds(printers, row.recipeId) : [];
    return { row, at: printersFor(row, printers), picked };
  });
  const needle = q.trim().toLowerCase();
  const shown = all.filter(
    (x) =>
      (show === 'all' || (show === 'nowhere' ? !x.at.length : x.picked.length > 0)) &&
      (!needle || [x.row.name, x.row.group, x.row.sub ?? ''].some((t) => t.toLowerCase().includes(needle))),
  );
  const nowhere = all.filter((x) => !x.at.length).length;
  const byItem = all.filter((x) => x.picked.length).length;

  const send = (row: PrintMenuRow, ids: string[]) => {
    if (!row.recipeId) return;
    const next = setItemPrinters(printers, row.recipeId, ids);
    setPrinterRoutes(next.filter((p, i) => p !== printers[i]).map((p) => ({ id: p.id, print: p.print })));
    const names = printers.filter((p) => ids.includes(p.id)).map((p) => p.name);
    toast(ids.length ? `${row.name} now prints at ${names.join(' and ')}` : `${row.name} prints by its category or group again`, { tone: 'success' });
  };

  if (venue && !room)
    return (
      <BoSection title="By menu item">
        <p className={s.empty}>{venue.name} has no kitchen of its own, so there is no menu to send item by item.</p>
      </BoSection>
    );

  return (
    <BoSection
      title="By menu item"
      sub="Where each item on the tablet menu prints. Send an item to one or more printers to override its category and group; whole-ticket printers always get it too. A printer shared by two kitchens takes the same items in both."
    >
      <div className={s.toolbar}>
        {!venue && kitchens.length > 1 && (
          <Tabs
            variant="segmented"
            size="sm"
            aria-label="Kitchen"
            value={picked}
            onChange={setRoom}
            options={kitchens.map((k) => ({ id: k, label: `${rooms[k].name} kitchen` }))}
          />
        )}
        <SearchField value={q} onChange={setQ} placeholder="Find an item or category" className={s.search} />
        <Tabs<Show>
          variant="segmented"
          size="sm"
          aria-label="Show"
          value={show}
          onChange={setShow}
          options={[
            { id: 'all', label: 'All items', count: all.length },
            { id: 'nowhere', label: 'Print nowhere', count: nowhere, countTone: nowhere ? 'danger' : 'neutral' },
            { id: 'item', label: 'Set by item', count: byItem, countTone: 'plum' },
          ]}
        />
      </div>
      <p className={s.kitchenNote}>
        {room && venues.length ? `${rooms[room].name} kitchen cooks for ${venues.join(' and ')}. ` : ''}
        {printers.length ? `Its printers: ${printers.map((p) => p.name).join(', ')}.` : 'It has no printers yet. Add one on the Printers tab.'}
      </p>
      {nowhere > 0 && (
        <p className={s.warn} role="status">
          <TriangleAlert size={15} aria-hidden />
          {nowhere} item{nowhere === 1 ? " doesn't" : "s don't"} print anywhere in this kitchen.
        </p>
      )}

      <div className={s.tableWrap}>
        <table className={s.table}>
          <caption className="sr-only">Where each menu item prints</caption>
          <thead>
            <tr>
              <th>Item</th>
              <th>Prints at</th>
              <th className={s.sendCol}>Send to</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((x, i) => {
              const prev = shown[i - 1]?.row;
              const newGroup = !prev || prev.group !== x.row.group;
              const newSub = newGroup || prev.sub !== x.row.sub;
              return (
                <Fragment key={x.row.key}>
                  {newGroup && (
                    <tr className={s.groupRow}>
                      <th colSpan={3} scope="colgroup">
                        {x.row.group}
                      </th>
                    </tr>
                  )}
                  {newSub && (
                    <tr className={s.subRow}>
                      <th colSpan={3} scope="colgroup">
                        {x.row.sub ? subLabel(x.row.sub) : 'No Recipe Book category'}
                      </th>
                    </tr>
                  )}
                  <tr className={cx(s.itemRow, !x.at.length && s.itemNowhere)}>
                    <td className={s.itemName}>{x.row.name}</td>
                    <td>
                      <div className={s.at}>
                        {x.at.length ? (
                          x.at.map((p) => (
                            <Chip key={p.id} tone={printRoute(p) === 'all' ? 'outline' : x.picked.includes(p.id) ? 'plum' : 'info'}>
                              {p.name}
                            </Chip>
                          ))
                        ) : (
                          <Chip tone="danger">Nowhere</Chip>
                        )}
                        <span className={s.why}>{reason(x.row, printers, x.picked)}</span>
                      </div>
                    </td>
                    <td className={s.sendCol}>
                      {x.row.recipeId ? (
                        <SendTo row={x.row} printers={printers} picked={x.picked} onSend={(ids) => send(x.row, ids)} />
                      ) : (
                        <span className={s.why}>Not in the Recipe Book: prints by its group</span>
                      )}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
            {!shown.length && (
              <tr>
                <td colSpan={3} className={s.noRows}>
                  {needle ? `No item matches “${q}”.` : show === 'nowhere' ? 'Every item prints somewhere.' : 'No item is set by item yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </BoSection>
  );
}

/** Automatic, or the printers this one item goes to. */
function SendTo({ row, printers, picked, onSend }: { row: PrintMenuRow; printers: Printer[]; picked: string[]; onSend: (ids: string[]) => void }) {
  const routed = printers.filter((p) => printRoute(p) !== 'all');
  const whole = printers.filter((p) => printRoute(p) === 'all');
  const label = picked.length
    ? printers
        .filter((p) => picked.includes(p.id))
        .map((p) => p.name)
        .join(', ')
    : 'Automatic';
  return (
    <Popover
      align="right"
      minWidth={260}
      trigger={({ open, toggle }) => (
        <button
          className={cx(s.sendBtn, picked.length > 0 && s.sendBtnSet)}
          aria-expanded={open}
          aria-label={`Send ${row.name} to: ${label}`}
          onClick={toggle}
        >
          <span className={s.sendLabel}>{label}</span>
          <ChevronDown size={14} aria-hidden />
        </button>
      )}
    >
      {({ close }) => (
        <>
          <MenuItem
            active={!picked.length}
            end={!picked.length ? <Check size={15} /> : undefined}
            onClick={() => {
              if (picked.length) onSend([]);
              close();
            }}
          >
            Automatic
            <span className={s.menuHint}>By its category or group</span>
          </MenuItem>
          {routed.length > 0 && <MenuDivider />}
          {routed.map((p) => {
            const on = picked.includes(p.id);
            return (
              <MenuItem
                key={p.id}
                active={on}
                end={on ? <Check size={15} /> : undefined}
                onClick={() => onSend(on ? picked.filter((id) => id !== p.id) : [...picked, p.id])}
              >
                {p.name}
                <span className={s.menuHint}>{p.type} printer</span>
              </MenuItem>
            );
          })}
          {whole.length > 0 && <MenuDivider />}
          {whole.map((p) => (
            <MenuItem key={p.id} disabled>
              {p.name}
              <span className={s.menuHint}>Prints the whole ticket, so it gets every item</span>
            </MenuItem>
          ))}
        </>
      )}
    </Popover>
  );
}
