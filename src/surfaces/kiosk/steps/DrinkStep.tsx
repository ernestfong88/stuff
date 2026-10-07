import { Beer, Check, Citrus, Coffee, CupSoda, GlassWater, Martini, Milk, Wine, type LucideIcon } from 'lucide-react';
import type { CatalogItem } from '../../../domain/types';
import { featuredOverride, useServiceSettings } from '../../pud/service/settings';
import {
  ALCOHOL_GROUPS,
  alcoholGroup,
  DRINK_GROUPS,
  drinkGroup,
  drinkName,
  FEATURED_DEFAULTS,
  groupItems,
  shortList,
  type KioskMenu,
} from '../model/menu';
import { useKioskPref } from '../model/prefs';
import { ChoiceGrid, ChoiceGroups } from '../ui/Choices';
import { KButton } from '../ui/KButton';
import { Actions, MoreButton, Panel, Question } from '../ui/Layout';
import type { KioskFlow } from '../useKioskFlow';
import s from './DrinkStep.module.css';

/** A picture for a drink, by what it is. */
export function drinkIcon(name: string): LucideIcon {
  const t = name.toLowerCase();
  if (/coffee|\btea\b|cocoa/.test(t)) return Coffee;
  if (/milk/.test(t)) return Milk;
  if (/water/.test(t)) return GlassWater;
  if (/juice|lemonade/.test(t)) return Citrus;
  if (/beer|ale|lager/.test(t)) return Beer;
  if (/wine|chardonnay|cabernet|merlot|pinot|blanc|grigio|mondavi/.test(t)) return Wine;
  if (/martini|margarita|mimosa|tonic|sour|rum|vodka|whiskey|scotch|tequila|gin\b/.test(t)) return Martini;
  return CupSoda;
}

/** "Coffee again?" for a regular, else the short list with More and Beer, wine & spirits. */
export function DrinkStep({ flow, menu }: { flow: KioskFlow; menu: KioskMenu }) {
  const svc = useServiceSettings();
  const st = flow.s;
  const pref = useKioskPref(st.resident?.id);
  const pick = (it: CatalogItem) => flow.advance({ drink: it.id });
  const all = [...menu.drinks, ...menu.alcohol];
  const again = !st.edit && !st.drinkList && !st.more && pref?.drink ? all.find((i) => drinkName(i) === pref.drink) : undefined;

  if (again) {
    const nm = drinkName(again);
    const Icon = drinkIcon(nm);
    return (
      <div>
        <Question title={`${nm} again?`} sub={`You had ${nm.toLowerCase()} last time.`} />
        <Panel className={s.again}>
          <span className={s.againIcon} aria-hidden>
            <Icon size="56%" strokeWidth={1.7} />
          </span>
          <span className={s.againName}>{nm}</span>
        </Panel>
        <Actions className={s.answers}>
          <KButton look="primary" className={s.yes} icon={<Check size="1.1em" strokeWidth={3} aria-hidden />} onClick={() => pick(again)}>
            Yes, please
          </KButton>
          <KButton className={s.other} onClick={() => flow.put({ drinkList: true })}>
            Something else
          </KButton>
        </Actions>
      </div>
    );
  }

  if (st.more === 'drinks' || st.more === 'alcohol') {
    const alcohol = st.more === 'alcohol';
    return (
      <div>
        <Question title={alcohol ? 'Beer, wine & spirits' : 'More drinks'} sub="Tap the one you'd like, or Back for the short list." />
        <ChoiceGroups
          groups={alcohol ? groupItems(menu.alcohol, alcoholGroup, ALCOHOL_GROUPS) : groupItems(menu.drinks, drinkGroup, DRINK_GROUPS)}
          min={240}
          selectedId={st.drink}
          label={drinkName}
          onPick={pick}
        />
      </div>
    );
  }

  const list = shortList(featuredOverride(svc, 'drinks') ?? FEATURED_DEFAULTS.drinks, menu.drinks, menu.drinks.some((d) => d.id === st.drink) ? st.drink : null);
  const alcoholPicked = menu.alcohol.find((i) => i.id === st.drink);
  return (
    <div>
      <Question title="Would you like a drink?" />
      <KButton block className={s.none} onClick={() => flow.advance({ drink: null })}>
        No drink, thanks
      </KButton>
      <ChoiceGrid items={list} selectedId={st.drink} label={drinkName} onPick={pick} />
      <div className={s.moreRow}>
        {menu.drinks.length > list.length && <MoreButton label="More drinks" onClick={() => flow.put({ more: 'drinks' })} />}
        {menu.alcohol.length > 0 && (
          <MoreButton label="Beer, wine & spirits" current={alcoholPicked ? drinkName(alcoholPicked) : null} onClick={() => flow.put({ more: 'alcohol' })} />
        )}
      </div>
    </div>
  );
}
