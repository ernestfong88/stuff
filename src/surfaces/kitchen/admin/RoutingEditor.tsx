import { useMemo, useState } from 'react';
import { setItemRoute, updateConfig, useConfig } from '../../../store/config';
import { setSetting, useSetting } from '../../../store/serviceConfig';
import { Button, SearchField, Toggle, cx } from '../../../ui';
import {
  canonicalItemId,
  ENTREE_TYPES,
  entreeTypeById,
  entreeTypeChosen,
  entreeTypeOf,
  recipeItemIds,
  suggestedEntreeType,
  type EntreeTypeId,
  type SubcategoryChoices,
} from '../subcategories';
import { currentRoute, defaultRoute, routableItems, routingView, type RouteChoice, type RoutedItem } from './routingList';
import s from './RoutingEditor.module.css';

const ROUTE_LABEL: Record<RouteChoice, string> = { kds: 'Cook line', expo: 'Server makes it', server: 'Server makes it', bar: 'Bar' };
const NO_CHOICES: SubcategoryChoices = {};

/** Point every meal's copy of the recipe at a route; its default clears the override. */
function setRoute(it: RoutedItem, room: string, route: RouteChoice) {
  const fallback = defaultRoute(it, room);
  for (const id of recipeItemIds(it.item.id)) setItemRoute(room, id, route === fallback ? null : route);
}

/** Choose an entree type by hand, or with null go back to the suggestion. */
function setEntreeType(it: RoutedItem, type: EntreeTypeId | null) {
  const path = 'csub.' + canonicalItemId(it.item.id);
  setSetting(path, type && type !== suggestedEntreeType(it.item.name) ? entreeTypeById(type).label : undefined);
}

/** Everything goes to the cook line unless it is marked here, per kitchen. */
export function RoutingEditor({ room }: { room: string }) {
  const cfg = useConfig();
  const choices = useSetting<SubcategoryChoices | undefined>('csub') ?? NO_CHOICES;
  const items = useMemo(routableItems, []);
  const [query, setQuery] = useState('');
  const [picking, setPicking] = useState<string | null>(null);
  const view = routingView(items, room, cfg, query);

  return (
    <div className={s.editor}>
      <p className={s.intro}>
        Everything goes to the cook line unless it is marked here. What the server makes, like house salad, soup, soft drinks or a plated dessert,
        skips the cook. It still shows on Expo and the server&apos;s tablet and is ready the moment it is sent, so a course only waits on what the
        cook makes. Drinks go to the server, or to the bar where there is one. Search for an item to change it. Each entree also has a subcategory,
        which sets its colour and group on the server&apos;s menu; tap it to choose a different one.
      </p>
      <div className={s.sides}>
        <Toggle
          checked={cfg.defaultSidesOnLine}
          onChange={(v) => updateConfig({ defaultSidesOnLine: v })}
          label={
            <span>
              <b>Show default sides on the cook line</b>
              <span className={s.sidesHint}> Turn this off where the cook already knows the plate.</span>
            </span>
          }
        />
      </div>
      <SearchField value={query} onChange={setQuery} placeholder="Search the menu to change where an item goes" className={s.search} />
      {view.length === 0 && <p className={s.none}>{query.trim() ? 'Nothing on the menu matches.' : 'Everything goes to the cook line.'}</p>}
      {view.map((group) => (
        <section key={group.title} className={s.group}>
          <h3 className={s.groupTitle}>
            {group.title} · {group.items.length}
          </h3>
          <ul className={s.list}>
            {group.items.map((it) => {
              const route = currentRoute(it, room, cfg);
              const overridden = route !== defaultRoute(it, room);
              const open = it.main && picking === it.item.id;
              const type = entreeTypeById(entreeTypeOf(it.item.id, choices));
              const chosen = entreeTypeChosen(it.item.id, choices);
              const options: RouteChoice[] = it.drink ? ['server', 'bar'] : ['kds', 'expo'];
              return (
                <li key={it.item.id} className={cx(s.item, open && s.itemOpen)}>
                  <div className={s.itemRow}>
                    {it.main && (
                      <button
                        className={s.type}
                        style={{ background: type.bg, color: type.fg, boxShadow: `inset 0 0 0 ${open ? 2 : 1}px ${open ? type.fg : type.fg + '33'}` }}
                        onClick={() => setPicking(open ? null : it.item.id)}
                        aria-expanded={open}
                        title="Choose the entree type for this recipe"
                      >
                        <span className={s.typeName}>{type.label}</span>
                        <span className={cx(s.typeHow, chosen && s.typeChosen)}>{chosen ? 'Chosen' : 'Suggested'}</span>
                      </button>
                    )}
                    <div className={s.name}>
                      <div className={s.itemName}>{it.item.name}</div>
                      {overridden && <div className={s.overridden}>Overridden here</div>}
                    </div>
                    <div className={s.routes} role="group" aria-label={`Where ${it.item.name} goes`}>
                      {options.map((r) => (
                        <button key={r} className={cx(s.route, route === r && s[`route_${r}`])} aria-pressed={route === r} onClick={() => setRoute(it, room, r)}>
                          {ROUTE_LABEL[r]}
                        </button>
                      ))}
                    </div>
                  </div>
                  {open && (
                    <div className={s.picker}>
                      <p className={s.pickerHint}>
                        {chosen
                          ? `Chosen by hand. The suggestion was ${entreeTypeById(suggestedEntreeType(it.item.name)).label}.`
                          : 'Suggested automatically from the recipe name. Pick another to override it; the menu regroups straight away.'}
                      </p>
                      <div className={s.types}>
                        {ENTREE_TYPES.map((t) => {
                          const on = t.id === type.id;
                          return (
                            <button
                              key={t.id}
                              className={s.typeOption}
                              style={{ background: on ? t.fg : t.bg, color: on ? '#fff' : t.fg }}
                              aria-pressed={on}
                              onClick={() => setEntreeType(it, t.id)}
                            >
                              <span className={s.typeOptionName}>{t.label}</span>
                              {t.id === suggestedEntreeType(it.item.name) && <span className={s.typeOptionHint}>Suggested</span>}
                            </button>
                          );
                        })}
                      </div>
                      {chosen && (
                        <Button size="sm" variant="soft" className={s.useSuggestion} onClick={() => setEntreeType(it, null)}>
                          Use the suggestion
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Has anything been changed from the recipes' own routing? */
export function routingEdited(cfg: { route: Record<string, string>; defaultSidesOnLine: boolean }): boolean {
  return Object.keys(cfg.route).length > 0 || !cfg.defaultSidesOnLine;
}

export function resetRouting(): void {
  updateConfig({ route: {}, defaultSidesOnLine: true });
}
