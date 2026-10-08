import { cx } from '../../../../ui';
import { MeterBar } from '../../kit';
import { categoryHue } from '../../kit/charts/palette';
import { categoryName, isTextureVersion, type MixItem } from './mix';
import s from './pmix.module.css';

/** Top 10 entrées, specials beside à la carte, each bar against its list's best seller. */
export function TopTen({ items }: { items: MixItem[] }) {
  const entrees = items.filter((x) => x.r.cat === 'Entrees' && !isTextureVersion(x.r.name));
  const column = (key: 'sp' | 'al', title: string) => {
    const list = entrees
      .filter((x) => x[key] > 0)
      .map((x) => ({ r: x.r, n: x[key] }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 10);
    const max = list[0]?.n ?? 1;
    return (
      <div>
        <div className={s.mixHead}>
          <span className={cx(s.mark, key === 'al' && s.markOpen)} aria-hidden />
          <span className={s.mixTitle}>{title}</span>
        </div>
        {list.length === 0 ? (
          <div className={s.none}>None sold</div>
        ) : (
          <ol className={s.top}>
            {list.map((x, i) => (
              <li key={x.r.id} className={s.topRow}>
                <span className={s.rank}>{i + 1}</span>
                <span className={s.topMain}>
                  <span className={s.topName}>{x.r.name}</span>
                  <MeterBar value={x.n} max={max} color={categoryHue(categoryName(x.r.cat)).base} />
                </span>
                <span className={s.topN}>{x.n}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  };
  return (
    <section className={s.card} aria-label="Top 10 entrées">
      <h2 className={s.caption}>Top 10 entrées</h2>
      <div className={s.topCols}>
        {column('sp', 'Specials')}
        {column('al', 'À la carte')}
      </div>
    </section>
  );
}
