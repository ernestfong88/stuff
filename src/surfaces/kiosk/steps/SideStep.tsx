import { Check } from 'lucide-react';
import { getItem } from '../../../data';
import { defaultSides } from '../../../domain/menu';
import type { CatalogItem } from '../../../domain/types';
import { featuredOverride, useServiceSettings } from '../../../domain/pickupService/settings';
import { dishLongName, FEATURED_DEFAULTS, groupItems, listWords, shortList, SIDE_GROUPS, sideGroup, type KioskMenu } from '../../../domain/kioskMenu';
import { ChoiceGrid, ChoiceGroups } from '../ui/Choices';
import { KButton } from '../ui/KButton';
import { MoreButton, Question } from '../ui/Layout';
import type { KioskFlow } from '../useKioskFlow';
import s from './SideStep.module.css';

const name = (it: CatalogItem) => dishLongName(it.name);

/** Keep the side the dish comes with, choose another, or none. */
export function SideStep({ flow, menu }: { flow: KioskFlow; menu: KioskMenu }) {
  const svc = useServiceSettings();
  const st = flow.s;
  const comesWith = st.entree ? defaultSides(st.entree).map((id) => getItem(id)).filter((i): i is CatalogItem => !!i) : [];
  const picking = st.pickSide || !comesWith.length;
  const selected = st.side && st.side !== 'keep' && st.side !== 'none' ? st.side : null;
  const pick = (it: CatalogItem) => flow.advance({ side: it.id, pickSide: false });
  const none = (
    <KButton block className={s.none} onClick={() => flow.advance({ side: 'none', pickSide: false })}>
      No side, thanks
    </KButton>
  );

  if (picking && st.more === 'sides') {
    return (
      <div>
        <Question title="More sides" sub="Tap the one you'd like, or Back for the short list." />
        <ChoiceGroups groups={groupItems(menu.sides, sideGroup, SIDE_GROUPS)} min={230} selectedId={selected} label={name} onPick={pick} />
      </div>
    );
  }
  if (picking) {
    const list = shortList(featuredOverride(svc, 'sides') ?? FEATURED_DEFAULTS.sides, menu.sides, selected);
    return (
      <div>
        <Question title="Choose a side" />
        {none}
        <ChoiceGrid items={list} selectedId={selected} label={name} onPick={pick} />
        {menu.sides.length > list.length && (
          <div className={s.moreRow}>
            <MoreButton label="More sides" onClick={() => flow.put({ more: 'sides' })} />
          </div>
        )}
      </div>
    );
  }
  return (
    <div>
      <Question title={`Your meal comes with ${listWords(comesWith.map(name))}.`} sub="Would you like to keep it?" />
      <div className={s.stack}>
        <KButton look="primary" className={s.keep} icon={<Check size="1.1em" strokeWidth={3} aria-hidden />} onClick={() => flow.advance({ side: 'keep', pickSide: false })}>
          Keep it
        </KButton>
        <KButton onClick={() => flow.put({ pickSide: true })}>Choose a different side</KButton>
        <KButton onClick={() => flow.advance({ side: 'none', pickSide: false })}>No side, thanks</KButton>
      </div>
    </div>
  );
}
