import { BoStatRow, BoStatTile, BoTable, MeterBar, type BoColumn } from '../../kit';
import { categoryHue } from '../../kit/charts/palette';
import { MEAL_NAMES, categoryName, pct, type Mix, type MixItem, type ShowFilter } from './mix';
import s from './pmix.module.css';

/** Every item with its share of the mix, the totals, and the sides chosen. */
export function FullDetail({ mix, items, show }: { mix: Mix; items: MixItem[]; show: ShowFilter }) {
  const onlySp = show === 'SpEnt';
  const rows = items.filter((x) => !onlySp || x.sp > 0).slice(0, 40);
  const value = (x: MixItem) => (onlySp ? x.sp : x.n);
  const max = rows.reduce((m, x) => Math.max(m, value(x)), 1);
  const columns: Array<BoColumn<MixItem>> = [
    { key: 'rank', header: '#', width: 40, render: (x) => <span className={s.rankCell}>{rows.indexOf(x) + 1}</span> },
    {
      key: 'item',
      header: 'Item',
      render: (x) => (
        <span>
          <span className={s.itemName}>{x.r.name}</span>
          <span className={s.itemCat}>{categoryName(x.r.cat)}</span>
        </span>
      ),
    },
    { key: 'type', header: 'Type', render: (x) => (x.sp > 0 && x.al > 0 ? 'Both' : x.sp > 0 ? 'Special' : 'À la carte') },
    { key: 'meal', header: 'Meal', render: (x) => x.meals.map((m) => MEAL_NAMES[m]).join(', ') },
    {
      key: 'share',
      header: 'Share',
      width: 140,
      render: (x) => <MeterBar value={value(x)} max={max} color={categoryHue(categoryName(x.r.cat)).base} />,
    },
    { key: 'sold', header: 'Sold', align: 'right', render: (x) => <span className={s.num}>{value(x)}</span> },
    { key: 'of', header: '% of mix', align: 'right', render: (x) => `${(mix.tot ? (value(x) / mix.tot) * 100 : 0).toFixed(1)}%` },
  ];
  const sidesTotal = mix.sides.reduce((q, x) => q + x.n, 0);
  return (
    <div className={s.full}>
      <BoStatRow>
        <BoStatTile value={mix.tot.toLocaleString()} label={`items sold in ${mix.days} ${mix.days === 1 ? 'day' : 'days'}`} />
        <BoStatTile value={Math.round(mix.tot / Math.max(1, mix.days)).toLocaleString()} label="a day on average" />
        <BoStatTile value={mix.ent.toLocaleString()} label="entrées" />
        <BoStatTile value={sidesTotal.toLocaleString()} label="sides chosen" />
      </BoStatRow>
      <div className={s.fullGrid}>
        <BoTable caption="Every item sold" dense columns={columns} rows={rows} rowKey={(x) => x.r.id} empty="Nothing sold for these filters." />
        <section className={s.card} aria-label="Sides chosen">
          <h2 className={s.caption}>Sides chosen</h2>
          <p className={s.cardSub}>Counted from each entrée's side choices and sides ordered on their own.</p>
          {mix.sides.length === 0 ? (
            <p className={s.none}>No sides in this range.</p>
          ) : (
            <ul className={s.sides}>
              {mix.sides.slice(0, 14).map((x) => (
                <li key={x.name} className={s.side}>
                  <span className={s.sideMain}>
                    <span className={s.itemName}>{x.name}</span>
                    <span className={s.itemCat}>{x.top ? `most often with ${x.top}` : 'mostly ordered on its own'}</span>
                  </span>
                  <span className={s.num}>{x.n}</span>
                  <span className={s.pctSmall}>{pct(x.n, mix.ent)}%</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
