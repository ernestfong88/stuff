import { useMemo, useState } from 'react';
import { now } from '../../../../lib/clock';
import type { Recipe } from '../../../../store/menuEdits';
import { EmptyState, SearchField, Tabs, Toggle, toast } from '../../../../ui';
import { BoCallout, BoPage } from '../../kit';
import { updateBo, useBo } from '../data';
import { CATEGORIES, dishLong } from '../model/categories';
import { venuesAt } from '../../../../domain/menuCycle';
import { DINING_VENUE_ID } from '../model/liveOverlay';
import { menuPrices, orphanPrices, priceRow, recipesOnMenu, setPrice, type PriceField } from '../model/pricing';
import { Select, TableFrame, tableClass } from '../ui/controls';
import { PriceCell } from './PriceCell';
import s from './PricingPage.module.css';

const FIELDS: Array<[PriceField, string]> = [
  ['res', 'Resident'],
  ['guest', 'Guest'],
  ['ala', 'À la carte'],
];

/** Pricing: resident, guest and à la carte prices for each recipe at a venue. */
export function PricingPage({ venueId: fixedVenue }: { venueId?: string } = {}) {
  const bo = useBo();
  const venues = useMemo(() => venuesAt(bo.venues, now()).filter((v) => v.active && (v.menuId || v.alcMenuId)), [bo.venues]);
  const [venueId, setVenueId] = useState(venues[0]?.id ?? '');
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [changedOnly, setChangedOnly] = useState(false);
  const venue = fixedVenue ? venues.find((v) => v.id === fixedVenue) : (venues.find((v) => v.id === venueId) ?? venues[0]);
  const onMenu = useMemo(() => recipesOnMenu(bo, venue?.menuId ?? venue?.alcMenuId ?? null), [bo, venue]);
  const byId = useMemo(() => new Map(bo.recipes.map((r) => [r.id, r])), [bo.recipes]);
  const query = q.trim().toLowerCase();
  const rows = onMenu
    .map((id) => byId.get(id))
    .filter(
      (r): r is Recipe =>
        !!r &&
        (!cat || r.cat === cat) &&
        (!query || r.name.toLowerCase().includes(query) || dishLong(r.name).toLowerCase().includes(query)) &&
        (!changedOnly || !!(venue && priceRow(bo.prices, venue.id, r.id))),
    )
    .sort((a, b) => CATEGORIES.indexOf(a.cat) - CATEGORIES.indexOf(b.cat) || a.name.localeCompare(b.name));
  const orphans = venue ? orphanPrices(bo.prices, venue.id, onMenu) : [];

  if (!venue) {
    return (
      <BoPage title="Pricing">
        {fixedVenue ? (
          <EmptyState title="No menu yet">Choose this venue's menu on its Menu tab, then set its prices here.</EmptyState>
        ) : (
          <EmptyState title="No venue serves a menu yet">Give a venue a menu in Venue Settings, then set its prices here.</EmptyState>
        )}
      </BoPage>
    );
  }

  const change = (r: Recipe, field: PriceField, v: number | null) => updateBo((st) => ({ prices: setPrice(st.prices, venue.id, r, field, v) }));
  const changedCount = onMenu.filter((id) => priceRow(bo.prices, venue.id, id)).length;
  const archiveOrphans = () => {
    updateBo((st) => ({ prices: st.prices.filter((p) => !orphans.includes(p)) }));
    toast(`${orphans.length === 1 ? 'Old price' : 'Old prices'} cleared`, {
      tone: 'success',
      action: { label: 'Undo', onClick: () => updateBo((st) => ({ prices: [...st.prices, ...orphans] })) },
    });
  };

  return (
    <BoPage title="Pricing" sub="Changes save as you type. A closed check keeps the price it was ordered at.">
      <div className={s.toolbar}>
        {!fixedVenue && (
          <Tabs
            variant="pills"
            size="md"
            value={venue.id}
            onChange={setVenueId}
            options={venues.map((v) => ({ id: v.id, label: v.name }))}
            aria-label="Venue"
          />
        )}
        <Select
          value={cat}
          onChange={setCat}
          placeholder="All categories"
          options={CATEGORIES.map((c) => ({ value: c, label: c }))}
          aria-label="Category"
          emphasize
        />
        <SearchField value={q} onChange={setQ} placeholder="Filter recipes" className={s.search} />
        <Toggle checked={changedOnly} onChange={setChangedOnly} label={`Only changed prices (${changedCount})`} />
      </div>
      <p className={s.how}>
        Each price starts as the menu&apos;s own price. Type a new one to change it for {venue.name} only; a changed price shows in blue with{' '}
        <b>Use menu price</b> under it.
      </p>

      {orphans.length > 0 && (
        <BoCallout tone="warning">
          {venue.name} still has its own {orphans.length === 1 ? 'price' : 'prices'} for {orphans.length === 1 ? 'a dish' : 'dishes'} no longer on its
          menu ({orphans.map((o) => byId.get(o.recipeId)?.name ?? o.recipeId).join(', ')}).{' '}
          <button className={s.inlineLink} onClick={archiveOrphans}>
            Clear {orphans.length === 1 ? 'it' : 'them'}
          </button>
        </BoCallout>
      )}

      {venue.id !== DINING_VENUE_ID && venue.menuId === venues.find((v) => v.id === DINING_VENUE_ID)?.menuId && (
        <BoCallout tone="info">
          The dining room tablets ring up {venues.find((v) => v.id === DINING_VENUE_ID)?.name} prices. Prices here print on {venue.name}&apos;s menus.
        </BoCallout>
      )}

      <TableFrame>
        <table className={tableClass}>
          <thead>
            <tr>
              <th>Recipe</th>
              {FIELDS.map(([k, l]) => (
                <th key={k} className={s.num}>
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const own = priceRow(bo.prices, venue.id, r.id);
              const base = menuPrices(r);
              return (
                <tr key={r.id}>
                  <td>
                    <div className={s.name}>{dishLong(r.name)}</div>
                    <div className={s.cat}>{r.cat}</div>
                  </td>
                  {FIELDS.map(([k, l]) => {
                    return (
                      <td key={k} className={s.num}>
                        <PriceCell
                          value={own?.[k] ?? null}
                          menuPrice={base[k]}
                          onChange={(x) => change(r, k, x)}
                          label={`${l} price for ${r.name}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={4} className={s.empty}>
                  {!onMenu.length
                    ? `${venue.name}'s menu has nothing on it yet.`
                    : changedOnly && !changedCount
                      ? `No price has been changed at ${venue.name}. Every dish uses the menu price.`
                      : 'No recipes match. Try another word or category.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableFrame>
    </BoPage>
  );
}
