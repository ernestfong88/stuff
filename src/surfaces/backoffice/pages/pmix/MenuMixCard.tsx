import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from '../../../../ui';
import { DonutChart, type DonutSlice } from '../../kit';
import { CATEGORY_OTHER, categoryHue } from '../../kit/charts/palette';
import { categoryName, orderedCategories, pct, type MixItem } from './mix';
import s from './pmix.module.css';

type Group = 'sp' | 'al';
const GROUP_NAME: Record<Group, string> = { sp: 'Specials', al: 'À la carte' };
/** Dishes named on the ring when a category is open, one per ramp step, as on the dashboard wheel. */
const RING_DISHES = 4;
/** Colour is the course category, as on the dashboard wheel: specials in its full hue, à la carte in the same hue softened. */
const shade = (g: Group, cat: string) => (g === 'sp' ? categoryHue(categoryName(cat)).base : categoryHue(categoryName(cat)).soft);

interface CatTotal {
  cat: string;
  n: number;
}

/**
 * Menu mix ring: specials against à la carte, split by category. Tapping a
 * slice puts that category's dishes on the ring.
 */
export function MenuMixCard({ items, what, range }: { items: MixItem[]; what: string; range: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const cats = orderedCategories(items);
  const totals = (g: Group): CatTotal[] =>
    cats.map((cat) => ({ cat, n: items.filter((x) => x.r.cat === cat).reduce((q, x) => q + x[g], 0) })).filter((c) => c.n > 0);
  const SP = totals('sp');
  const AL = totals('al');
  const tS = SP.reduce((q, c) => q + c.n, 0);
  const tA = AL.reduce((q, c) => q + c.n, 0);
  const T = tS + tA;
  const dishesOf = (g: Group, cat: string) =>
    items
      .filter((x) => x.r.cat === cat && x[g] > 0)
      .map((x) => ({ r: x.r, n: x[g] }))
      .sort((a, b) => b.n - a.n);

  const [openGroup, openCat] = (openKey?.split('|') ?? [null, null]) as [Group | null, string | null];
  const openDishes = openGroup && openCat ? dishesOf(openGroup, openCat) : [];
  const openTotal = openDishes.reduce((q, x) => q + x.n, 0);

  const slices: DonutSlice[] = openGroup
    ? [
        ...openDishes
          .slice(0, RING_DISHES)
          .map((x, i) => ({ key: `i${i}`, name: x.r.name, value: x.n, color: categoryHue(categoryName(openCat ?? '')).ramp[i] })),
        ...(openDishes.length > RING_DISHES
          ? [
              {
                key: 'io',
                name: `Everything else (${openDishes.length - RING_DISHES})`,
                value: openDishes.slice(RING_DISHES).reduce((q, x) => q + x.n, 0),
                color: CATEGORY_OTHER,
              },
            ]
          : []),
      ]
    : [
        ...SP.map((c) => ({ key: `sp|${c.cat}`, name: `Specials · ${categoryName(c.cat)}`, value: c.n, color: shade('sp', c.cat) })),
        ...AL.map((c) => ({ key: `al|${c.cat}`, name: `À la carte · ${categoryName(c.cat)}`, value: c.n, color: shade('al', c.cat) })),
      ];
  const ringTotal = openGroup ? openTotal : T;
  const hovered = slices.find((x) => x.key === hover);
  const clip = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
  const center: [string, string, string] = hovered
    ? [clip(hovered.name, 24), `${pct(hovered.value, ringTotal)}%`, `${hovered.value} sold`]
    : openGroup && openCat
      ? [
          `${GROUP_NAME[openGroup]} · ${categoryName(openCat).split(' ')[0]}`,
          String(openTotal),
          `${openDishes.length} ${openDishes.length === 1 ? 'dish' : 'dishes'} · ${pct(openTotal, T)}% of all`,
        ]
      : ['Specials', `${pct(tS, T)}%`, `à la carte ${pct(tA, T)}%`];

  const toggleOpen = (key: string) => {
    setOpenKey(openKey === key ? null : key);
    setHover(null);
  };

  const summary = (() => {
    if (openGroup && openCat && openDishes[0])
      return (
        <>
          <b>
            {GROUP_NAME[openGroup]} · {categoryName(openCat)}: {openTotal} sold
          </b>
          , {pct(openTotal, T)}% of everything sold. Most popular: {openDishes[0].r.name} with {openDishes[0].n} ({pct(openDishes[0].n, openTotal)}%).
        </>
      );
    const live = cats.filter((c) => (SP.find((x) => x.cat === c)?.n ?? 0) + (AL.find((x) => x.cat === c)?.n ?? 0) > 0);
    const parts = live.map((c) => {
      const sp = SP.find((x) => x.cat === c)?.n ?? 0;
      const v = pct(sp, sp + (AL.find((x) => x.cat === c)?.n ?? 0));
      const nm = categoryName(c).toLowerCase();
      return v >= 100 ? `all ${nm}` : v <= 0 ? `no ${nm}` : `${v}% of ${nm}`;
    });
    return (
      <>
        <b>
          Specials were {pct(tS, T)}% of {what.toLowerCase()} sold
        </b>
        , à la carte {pct(tA, T)}%.
        {parts.length > 1 &&
          ` Within each category, specials took ${parts.slice(0, -1).join(', ')}${parts.length > 2 ? ',' : ''} and ${parts[parts.length - 1]}.`}
      </>
    );
  })();

  const list = (g: Group, rows: CatTotal[], total: number) => (
    <div className={s.mixCol}>
      <div className={s.mixHead}>
        <span className={cx(s.mark, g === 'al' && s.markOpen)} aria-hidden />
        <span className={s.mixTitle}>{GROUP_NAME[g]}</span>
        <span className={s.num}>{total}</span>
        <span className={s.pctStrong}>{pct(total, T)}%</span>
      </div>
      {rows.length === 0 && <div className={s.none}>None sold</div>}
      {rows.map((c) => {
        const key = `${g}|${c.cat}`;
        const open = !collapsed[key];
        const dishes = dishesOf(g, c.cat);
        const show = showAll[key] ? dishes : dishes.slice(0, 5);
        const ringed = openKey === key;
        return (
          <div key={key} className={cx(s.catBlock, ringed && s.catRinged)}>
            <button
              className={s.catRow}
              aria-expanded={open}
              onClick={() => setCollapsed((v) => ({ ...v, [key]: open }))}
              onMouseEnter={() => !openKey && setHover(key)}
              onMouseLeave={() => !openKey && setHover(null)}
            >
              <ChevronRight size={13} className={cx(s.caret, open && s.caretOpen)} aria-hidden />
              <span
                className={cx(s.swatch, g === 'al' && s.swatchSoft)}
                style={{ background: shade(g, c.cat), color: categoryHue(categoryName(c.cat)).base }}
                aria-hidden
              />
              <span className={s.catName}>{categoryName(c.cat)}</span>
              <span className={s.num}>{c.n}</span>
              <span className={s.pctSmall}>{pct(c.n, T)}%</span>
            </button>
            {open && (
              <ul className={s.dishes}>
                {show.map((d, i) => {
                  const hk = ringed ? (i < RING_DISHES ? `i${i}` : 'io') : null;
                  const color = hk ? slices.find((x) => x.key === hk)?.color : undefined;
                  return (
                    <li
                      key={d.r.id}
                      className={cx(s.dish, hk && hover === hk && s.dishHover)}
                      onMouseEnter={() => hk && setHover(hk)}
                      onMouseLeave={() => hk && setHover(null)}
                    >
                      <span className={cx(s.dot, color && s.dotRinged)} style={color ? { background: color } : undefined} aria-hidden />
                      <span className={s.dishName}>{d.r.name}</span>
                      <span className={s.num}>{d.n}</span>
                      <span className={s.pctSmall} title="Share of this category">
                        {pct(d.n, c.n)}%
                      </span>
                    </li>
                  );
                })}
                {dishes.length > 5 && (
                  <li>
                    <button className={s.more} onClick={() => setShowAll((v) => ({ ...v, [key]: !v[key] }))}>
                      {showAll[key] ? 'Show fewer' : `Show all ${dishes.length}`}
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <section className={s.card} aria-label="Menu mix">
      <header className={s.cardHead}>
        <h2 className={s.cardTitle}>Menu mix</h2>
        <span className={s.cardSub}>Specials vs à la carte · tap a slice to see the dishes</span>
        <span className={s.cardRange}>
          {what} · {range}
        </span>
      </header>
      {!T ? (
        <p className={s.empty}>Nothing sold for these filters.</p>
      ) : (
        <div className={s.mixBody}>
          <div className={s.ring}>
            <DonutChart
              slices={slices}
              label={openGroup ? `${GROUP_NAME[openGroup]} ${categoryName(openCat ?? '')} by dish` : 'Specials and à la carte by category'}
              center={center}
              hovered={hover}
              onHover={setHover}
              onSelect={openGroup ? undefined : toggleOpen}
              describe={(x) => `${x.name}: ${x.value} (${pct(x.value, ringTotal)}%)`}
            />
            {openKey && (
              <button className={s.back} onClick={() => toggleOpen(openKey)}>
                <ChevronLeft size={14} aria-hidden /> All categories
              </button>
            )}
          </div>
          <div className={s.mixRight}>
            <p className={s.summary}>{summary}</p>
            <div className={s.mixCols}>
              {list('sp', SP, tS)}
              {list('al', AL, tA)}
            </div>
            <p className={s.foot}>
              {openKey
                ? 'The ring shows the dishes in the outlined category. Dish percents are shares of their category.'
                : 'Colour is the course, as on the dashboard: specials in the full colour, à la carte in the paler shade. Tap a slice to see its dishes on the ring. Category percents are of everything sold; dish percents are of their category.'}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
