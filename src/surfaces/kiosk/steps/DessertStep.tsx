import { Check } from 'lucide-react';
import { dishLongName, type KioskMenu } from '../model/menu';
import { DishPicture } from '../ui/DishTile';
import { KButton } from '../ui/KButton';
import { Actions, Panel, Question, TileGrid } from '../ui/Layout';
import type { KioskFlow } from '../useKioskFlow';
import s from './DessertStep.module.css';

/** The special dessert first ("Would you like the Pineapple Trifle?"), then the list. */
export function DessertStep({ flow, menu, today }: { flow: KioskFlow; menu: KioskMenu; today: boolean }) {
  const special = menu.desserts.find((i) => i.special);
  if (special && !flow.s.moreDessert) {
    return (
      <div>
        <Question title={`Would you like the ${dishLongName(special.name)}?`} sub={`${today ? "Today's" : "Tomorrow's"} special dessert`} />
        <Panel className={s.special}>
          <div className={s.pic}>
            <DishPicture item={special} />
          </div>
          <p className={s.desc}>{special.desc || dishLongName(special.name)}</p>
        </Panel>
        <Actions className={s.answers}>
          <KButton look="primary" className={s.answer} icon={<Check size="1.1em" strokeWidth={3} aria-hidden />} onClick={() => flow.advance({ dessert: special.id, moreDessert: false })}>
            Yes, please
          </KButton>
          <KButton className={s.answer} onClick={() => flow.advance({ dessert: null, moreDessert: false })}>
            No thanks
          </KButton>
          <KButton className={s.answer} onClick={() => flow.put({ moreDessert: true })}>
            Something else
          </KButton>
        </Actions>
      </div>
    );
  }
  return (
    <div>
      <Question title="Choose a dessert" />
      <TileGrid min={300} gap={14}>
        {menu.desserts
          .filter((i) => i !== special)
          .map((it) => (
            <KButton key={it.id} look={flow.s.dessert === it.id ? 'selected' : 'secondary'} className={s.dessert} onClick={() => flow.advance({ dessert: it.id, moreDessert: false })}>
              {dishLongName(it.name)}
            </KButton>
          ))}
      </TileGrid>
      <KButton block className={s.noDessert} onClick={() => flow.advance({ dessert: null, moreDessert: false })}>
        No dessert, thanks
      </KButton>
    </div>
  );
}
