import { useMemo, useState } from 'react';
import { now } from '../../../../lib/clock';
import type { Recipe } from '../../../../store/menuEdits';
import { EmptyState, SearchField, Tabs, toast } from '../../../../ui';
import { BoCallout, BoPage } from '../../kit';
import { updateBo, useBo } from '../data';
import { CATEGORIES, dishLong } from '../model/categories';
import { venuesAt } from '../model/cycle';
import { DINING_VENUE_ID } from '../model/liveOverlay';
import { menuPrices, orphanPrices, priceRow, recipesOnMenu, setPrice, type PriceField } from '../model/pricing';
import { MoneyInput, Select, TableFrame, tableClass } from '../ui/controls';
import s from './PricingPage.module.css';

const FIELDS: Array<[PriceField, string]> = [
  ['res', 'Resident'],
  ['guest', 'Guest'],
  ['ala', 'À la carte'],
];

/** Pricing: resident, guest and à la carte prices for each recipe at a venue. */
export function PricingPage() {
  const bo = useBo();
  const venues = useMemo(() => venuesAt(bo.venues, now()).filter((v) => v.active && v.menuId), [bo.venues]);
  const [venueId, setVenueId] = useState(venues[0]?.id ?? '');
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const venue = venues.find((v) => v.id === venueId) ?? venues[0];
  const onMenu = useMemo(() => recipesOnMenu(bo, venue?.menuId ?? null), [bo, venue]);
  const byId = useMemo(() => new Map(bo.recipes.map((r) => [r.id, r])), [bo.recipes]);
  const query = q.trim().toLowerCase();
  const rows = onMenu
    .map((id) => byId.get(id))
    .filter(
      (r): r is Recipe => !!r && (!cat || r.cat === cat) && (!query || r.name.toLowerCase().includes(query) || dishLong(r.name).toLowerCase().includes(query)),
    )
    .sort((a, b) => CATEGORIES.indexOf(a.cat) - CATEGORIES.indexOf(b.cat) || a.name.localeCompare(b.name));
  const orphans = venue ? orphanPrices(bo.prices, venue.id, onMenu) : [];

  if (!venue) {
    return (
      <BoPage title="Pricing" sub="Prices for each recipe at this venue, across every menu it serves.">
        <EmptyState title="No venue serves a menu yet">Give a venue a menu in Venue Settings, then set its prices here.</EmptyState>
      </BoPage>
    );
  }

  const change = (r: Recipe, field: PriceField, v: number | null) => updateBo((st) => ({ prices: setPrice(st.prices, venue.id, r, field, v) }));

  return (
    <BoPage
      title="Pricing"
      sub="Prices for each recipe at this venue, across every menu it serves. The 86 list covers what is sold out, and KDS Screens in Venue Settings cover where tickets go."
    >
      <div className={s.toolbar}>
        <Tabs variant="pills" size="md" value={venue.id} onChange={setVenueId} options={venues.map((v) => ({ id: v.id, label: v.name }))} aria-label="Venue" />
        <Select
          value={cat}
          onChange={setCat}
          placeholder="All categories"
          options={CATEGORIES.map((c) => ({ value: c, label: c }))}
          aria-label="Category"
          emphasize
        />
        <SearchField value={q} onChange={setQ} placeholder="Filter recipes" className={s.search} />
      </div>

      {orphans.length > 0 && (
        <BoCallout tone="warning">
          {orphans.length} price {orphans.length === 1 ? 'row' : 'rows'} in {venue.name} {orphans.length === 1 ? 'belongs' : 'belong'} to recipes no longer on
          its menu ({orphans.map((o) => byId.get(o.recipeId)?.name ?? o.recipeId).join(', ')}).{' '}
          <button
            className={s.inlineLink}
            onClick={() => {
              updateBo((st) => ({ prices: st.prices.filter((p) => !orphans.includes(p)) }));
              toast('Orphaned prices archived', { tone: 'success' });
            }}
          >
            Archive them
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
                    const v = own?.[k] ?? base[k];
                    return (
                      <td key={k} className={s.num}>
                        <MoneyInput
                          value={v}
                          onChange={(x) => change(r, k, x)}
                          aria-label={`${l} price for ${r.name}`}
                          className={own?.[k] != null ? s.changed : undefined}
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
                  {onMenu.length ? 'No recipes match. Try another word or category.' : `${venue.name}'s menu has nothing on it yet.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableFrame>
      <p className={s.foot}>Changes save as you type. A price change never alters a closed check: the check keeps the price it was ordered at.</p>
    </BoPage>
  );
}
