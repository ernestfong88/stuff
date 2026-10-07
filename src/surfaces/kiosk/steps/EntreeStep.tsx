import { Check } from 'lucide-react';
import { getItem } from '../../../data';
import { defaultSides } from '../../../domain/menu';
import type { CatalogItem } from '../../../domain/types';
import { dishLongName, listWords, type KioskMenu } from '../model/menu';
import { DishPicture, DishTile } from '../ui/DishTile';
import { KButton } from '../ui/KButton';
import { Actions, GroupTitle, Panel, Question, TileGrid } from '../ui/Layout';
import type { KioskFlow } from '../useKioskFlow';
import s from './EntreeStep.module.css';

/** One special at a time: "Yes, I'd like this" or "No thanks" for the next. */
function SpecialOffer({ flow, menu, today }: { flow: KioskFlow; menu: KioskMenu; today: boolean }) {
  const i = flow.s.special;
  const it = menu.specials[i];
  const sides = defaultSides(it.id)
    .map((id) => getItem(id)?.name)
    .filter((n): n is string => !!n)
    .map(dishLongName);
  const count = menu.specials.length;
  return (
    <div>
      <Question title={`${today ? "Today's" : "Tomorrow's"} special${count > 1 ? ` · ${i + 1} of ${count}` : ''}`} />
      <Panel className={s.special}>
        <div className={s.specialPic}>
          <DishPicture item={it} />
        </div>
        <div className={s.specialText}>
          <h2 className={s.specialName}>{dishLongName(it.name)}</h2>
          {it.desc && <p className={s.specialDesc}>{it.desc}</p>}
          {sides.length > 0 && <p className={s.specialSides}>Comes with {listWords(sides)}</p>}
        </div>
      </Panel>
      <Actions className={s.offerActions}>
        <KButton
          look="primary"
          className={s.yes}
          icon={<Check size="1.1em" strokeWidth={3} aria-hidden />}
          onClick={() => flow.advance({ entree: it.id, side: 'keep', version: null })}
        >
          Yes, I&rsquo;d like this
        </KButton>
        <KButton className={s.no} onClick={() => flow.put(i + 1 < count ? { special: i + 1 } : { others: true })}>
          No thanks
        </KButton>
      </Actions>
    </div>
  );
}

/** Every other main dish: ready-made versions first, then by type. */
function OtherChoices({ flow, menu }: { flow: KioskFlow; menu: KioskMenu }) {
  const pick = (it: CatalogItem) =>
    flow.advance({ entree: it.id, side: 'keep', version: flow.s.entree === it.id ? flow.s.version : null });
  return (
    <div>
      <Question title="Other choices" sub="Tap the one you'd like." />
      {menu.buildYourOwn.length > 0 && (
        <Panel className={s.byo}>
          <h2 className={s.byoTitle}>Pizza, salads and more</h2>
          <p className={s.byoSub}>Tap one to see our versions.</p>
          <TileGrid columns={Math.min(menu.buildYourOwn.length, 4)} gap={14}>
            {menu.buildYourOwn.map((it) => (
              <KButton
                key={it.id}
                column
                look={flow.s.entree === it.id ? 'selected' : 'secondary'}
                className={s.byoTile}
                onClick={() => pick(it)}
              >
                <DishTile item={it} size={68} />
                <span>{it.name.replace(/^Build Your Own\s+/i, '')}</span>
              </KButton>
            ))}
          </TileGrid>
        </Panel>
      )}
      {menu.others.map(([label, items]) => (
        <section key={label} className={s.group}>
          <GroupTitle>{label}</GroupTitle>
          <TileGrid min={440} gap={14}>
            {items.map((it) => (
              <KButton key={it.id} start look={flow.s.entree === it.id ? 'selected' : 'secondary'} className={s.dish} onClick={() => pick(it)}>
                <DishTile item={it} size={80} />
                <span className={s.dishText}>
                  <span className={s.dishName}>{dishLongName(it.name)}</span>
                  {it.desc && <span className={s.dishDesc}>{it.desc}</span>}
                </span>
              </KButton>
            ))}
          </TileGrid>
        </section>
      ))}
      <Actions>
        {menu.specials.length > 0 && <KButton onClick={() => flow.put({ special: 0, others: false })}>See the specials again</KButton>}
        <KButton onClick={() => flow.advance({ entree: null, side: null })}>No main dish, thanks</KButton>
      </Actions>
    </div>
  );
}

/** The main dish: the specials one at a time, then everything else. */
export function EntreeStep({ flow, menu, today }: { flow: KioskFlow; menu: KioskMenu; today: boolean }) {
  return !flow.s.others && flow.s.special < menu.specials.length ? (
    <SpecialOffer flow={flow} menu={menu} today={today} />
  ) : (
    <OtherChoices flow={flow} menu={menu} />
  );
}
