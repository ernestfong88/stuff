/**
 * Featured on Kiosk: the order the kiosk's short lists of drinks and sides
 * follow, and the kiosk's quarter turn for a landscape mount. Lists are kept
 * by name, not id, so one list covers every meal's menu; only a changed
 * list is saved, and Reset goes back to the standard picks.
 */
import { useState } from 'react';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { setSetting } from '../../../store/serviceConfig';
import { Button, Tabs, cx, toast } from '../../../ui';
import { FEATURED_COUNT, FEATURED_DEFAULTS, kioskMenu } from '../../kiosk/model/menu';
import { MEALS } from '../../pud/service/meals';
import { featuredOverride, kioskRotation, useServiceSettings, type FeaturedList } from '../../pud/service/settings';
import { BoPage, BoRow, BoSection } from '../kit';
import type { BoPageProps } from '../nav';
import s from './svcKiosk.module.css';

interface PoolEntry {
  name: string;
  meals: string[];
  /** Sits behind Beer, wine & spirits on the kiosk. */
  alcohol: boolean;
}

/** Every drink or side on any meal's menu, by name, with the meals it's on. */
function menuPool(list: FeaturedList): Map<string, PoolEntry> {
  const pool = new Map<string, PoolEntry>();
  for (const meal of MEALS) {
    const m = kioskMenu(meal, () => false);
    const items = list === 'drinks' ? [...m.drinks.map((i) => [i, false] as const), ...m.alcohol.map((i) => [i, true] as const)] : m.sides.map((i) => [i, false] as const);
    for (const [it, alcohol] of items) {
      const e = pool.get(it.name) ?? { name: it.name, meals: [], alcohol };
      if (!e.meals.includes(meal)) e.meals.push(meal);
      pool.set(it.name, e);
    }
  }
  return pool;
}

const ROTATIONS = [
  { id: '0', label: 'Off' },
  { id: '90', label: 'Clockwise' },
  { id: '-90', label: 'Counter-clockwise' },
] as const;

/** Turn the portrait kiosk a quarter turn for a tablet mounted in landscape. */
function Rotation() {
  const turn = kioskRotation(useServiceSettings());
  return (
    <BoSection
      title="Rotate 90°"
      sub="For a kiosk tablet mounted in landscape, or one that can't hold itself in portrait (iPads can't). The portrait kiosk turns a quarter turn to fill the whole screen. Off keeps it upright, using the landscape layout."
    >
      <BoRow label="Rotate the kiosk" hint={turn ? 'The kiosk tablet holds itself in landscape in full screen' : 'The kiosk tablet holds itself in portrait in full screen'}>
        <Tabs
          aria-label="Rotate the kiosk"
          variant="segmented"
          size="sm"
          value={String(turn) as (typeof ROTATIONS)[number]['id']}
          options={[...ROTATIONS]}
          onChange={(id) => {
            const v = Number(id);
            setSetting('kioskRotate', v || undefined);
            toast(v ? `The kiosk turns ${v > 0 ? 'clockwise' : 'counter-clockwise'} to fill a landscape screen` : 'The kiosk is upright again');
          }}
        />
      </BoRow>
      <p className={s.help}>
        Try Clockwise first. If the kiosk is upside down, pick Counter-clockwise. To set one tablet only, open the kiosk at <code>#/kiosk?rotate=90</code> (clockwise),{' '}
        <code>rotate=-90</code> (counter-clockwise) or <code>rotate=0</code> (off). The address wins over this setting.
      </p>
    </BoSection>
  );
}

/** One short list: featured names in order, with Up, Down, Remove and Add. */
function FeaturedCard({ list, title, sub }: { list: FeaturedList; title: string; sub: string }) {
  const svc = useServiceSettings();
  const [adding, setAdding] = useState('');
  const pool = menuPool(list);
  const own = featuredOverride(svc, list);
  const current = (own ?? FEATURED_DEFAULTS[list]).filter((n) => pool.has(n));
  const save = (names: string[]) => setSetting(`kioskFeat.${list}`, names);
  const move = (i: number, d: number) => {
    const next = current.slice();
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };
  const rest = [...pool.keys()].filter((n) => !current.includes(n)).sort();
  return (
    <BoSection
      title={title}
      sub={sub}
      actions={
        own && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSetting(`kioskFeat.${list}`, undefined);
              toast(`${title} are back to the standard picks`);
            }}
          >
            Reset to standard picks
          </Button>
        )
      }
    >
      <ol className={s.list}>
        {current.map((name, i) => {
          const e = pool.get(name)!;
          const shown = i < FEATURED_COUNT;
          return (
            <li key={name} className={s.item}>
              <span className={cx(s.rank, !shown && s.faint)}>{i + 1}</span>
              <div className={cx(s.itemText, !shown && s.faint)}>
                <div className={s.itemName}>
                  {name}
                  {e.alcohol && ' · behind Beer, wine & spirits'}
                </div>
                <div className={s.itemHint}>
                  {shown ? '' : "Only when one above isn't on that meal's menu · "}
                  On {e.meals.join(', ').toLowerCase()}
                </div>
              </div>
              <Button variant="ghost" size="sm" iconOnly icon={<ArrowUp size={15} />} aria-label={`Move ${name} up`} disabled={i === 0} onClick={() => move(i, -1)} />
              <Button variant="ghost" size="sm" iconOnly icon={<ArrowDown size={15} />} aria-label={`Move ${name} down`} disabled={i === current.length - 1} onClick={() => move(i, 1)} />
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon={<X size={15} />}
                aria-label={`Remove ${name}`}
                onClick={() => {
                  save(current.filter((n) => n !== name));
                  toast(`${name} is no longer featured`);
                }}
              />
            </li>
          );
        })}
      </ol>
      <div className={s.add}>
        <select className={s.select} value={adding} onChange={(e) => setAdding(e.target.value)} aria-label={`Add to featured ${list}`}>
          <option value="">Add one from the menus…</option>
          {rest.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          disabled={!adding}
          onClick={() => {
            save([...current, adding]);
            toast(`${adding} added to featured ${list}`);
            setAdding('');
          }}
        >
          Add
        </Button>
      </div>
    </BoSection>
  );
}

/** Featured on Kiosk: The drinks and sides residents see first at the lobby kiosk. */
export default function Page(_props: BoPageProps) {
  return (
    <BoPage
      title="Featured on Kiosk"
      sub={`What residents see first at the lobby kiosk. The kiosk shows the first ${FEATURED_COUNT} that are on that meal's menu, in this order, fills any gap from the menu, and puts everything else behind a More button.`}
    >
      <Rotation />
      <FeaturedCard list="drinks" title="Drinks" sub="Beer, wine and spirits always sit behind their own button on the kiosk, even when listed here." />
      <FeaturedCard list="sides" title="Sides" sub="“No side, thanks” always comes first, above these." />
    </BoPage>
  );
}
