import { useRef, useState, type ReactNode } from 'react';
import { Star } from 'lucide-react';
import { getItem, useMenuVersion } from '../../../../data';
import { flag } from '../../../../domain/config';
import { hasFoodConflict } from '../../../../domain/allergens';
import { availableCount, findLine } from '../../../../domain/orders';
import type { Diner, MenuItem, ModSelection, Order, Resident } from '../../../../domain/types';
import { useConfig } from '../../../../store/config';
import { useDining } from '../../../../store/dining';
import { useAssocMenuSettings } from '../../../../store/assocMenu';
import { fewerLeft, limitLeft, ordersToday, use86 } from '../../../../store/eightySix';
import { isoDate } from '../../../../domain/pickup';
import { cx, SearchField } from '../../../../ui';
import { sideParentFor } from '../checkLines';
import { allergyPerson } from '../diners/allergyPerson';
import { assocSectionLeft, assocSections, todaysAssocMenu, type AssocSection } from './assocMenu';
import { DinerHead } from './DinerHead';
import s from './MenuPanel.module.css';
import {
  drinkGroups,
  effectiveDrinkGroup,
  menuSections,
  menuTabs,
  orderMenuDate,
  orderMenuRoom,
  type DrinkGroup,
  type MenuSection,
  type MenuTab,
} from './menuCatalog';
import { MenuTile } from './MenuTile';
import { ModifierEditor } from './ModifierEditor';
import { defaultMods, opensModifiers } from './modifiers';

const TAB_LABELS: Record<MenuTab, string> = {
  Drinks: 'Drinks',
  Specials: 'Specials',
  Starters: 'Starters',
  Entrees: 'Entrees',
  Sides: 'Sides',
  Desserts: 'Desserts',
};

/**
 * The menu for the selected diner: tabs, the day's items in groups, search,
 * and the Modify screen. The tile adds with one tap; an item with pinned
 * choices (build your own, the burger's temperature) is added and opens
 * Modify right away.
 */
export function MenuPanel({
  order: o,
  diner,
  tab,
  onTab,
  sideWait,
  onPicked,
  onProfile,
}: {
  order: Order;
  diner: Diner;
  tab: MenuTab;
  onTab: (t: MenuTab) => void;
  /** The diner whose entrée waits on an optional side. */
  sideWait: string | null;
  /** An item went on the check (moves the check on, see afterPick). */
  onPicked: (itemId: string) => void;
  onProfile: (residentId: string) => void;
}) {
  const cfg = useConfig();
  const dining = useDining();
  const [search, setSearch] = useState('');
  const [drinkGroup, setDrinkGroup] = useState<DrinkGroup>('Non-Alcoholic');
  const [modItem, setModItem] = useState<MenuItem | null>(null);
  const [pinnedLine, setPinnedLine] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  // A guest's diner points at the host, whose allergies are not the guest's.
  const person = allergyPerson(diner);
  // Re-render when Back Office changes the menu, so an open order shows the change at once.
  useMenuVersion();
  const room = orderMenuRoom(o);
  // A pick up or delivery booked for a later day orders from that day's menu.
  const date = orderMenuDate(o);
  const tabs = menuTabs(o.meal, room, date);
  const sections = menuSections(o.meal, tab, { drinkGroup, room, search, cfg, date });
  const isResident = diner.kind === 'resident' && !diner.isGuest;
  // An associate's meal is locked to the associate menu: the chef's special, the special of the week and the standing choices.
  const assocOnly = !!o.assoc || diner.kind === 'associate';
  useAssocMenuSettings();
  const assoc = assocOnly ? assocSections(todaysAssocMenu(o.meal, date ?? isoDate(0)), o.meal) : [];
  // The special's daily limit counts App meals and meals rung in here; one this diner already has stays theirs.
  const assocLeft = (sec: AssocSection) => {
    if (diner.items.some((l) => !l.cancelled && sec.items.some((i) => i.id === l.itemId))) return null;
    return assocSectionLeft(sec, dining.assocOrders, [...dining.orders, ...dining.history], date ?? isoDate(0));
  };
  // A count the manager set on the 86 list caps the menu's own limit. Both are today's: a later day's order ignores them.
  const marks = use86();
  const todays = ordersToday(dining.orders, dining.history);
  const left = (id: string) => (date ? null : fewerLeft(availableCount(id, dining.orders), limitLeft(marks, id, todays)));

  const add = (item: MenuItem, mods: ModSelection, note: string) => {
    dining.addItem(o.id, diner.id, item.id, mods, note, sideParentFor(item.id, diner));
    setModItem(null);
    if (flag(cfg, 'appToEntree') && tab === 'Starters' && !search.trim() && tabs.includes('Entrees')) onTab('Entrees');
    onPicked(item.id);
    setTimeout(() => tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };
  const tap = (item: MenuItem) => {
    if (!opensModifiers(item.id)) return add(item, defaultMods(item.id), '');
    const id = dining.addItem(o.id, diner.id, item.id, defaultMods(item.id), '', sideParentFor(item.id, diner));
    if (id) setPinnedLine(id);
  };

  const pinned = pinnedLine ? findLine(o, pinnedLine) : null;

  return (
    <div className={s.panel}>
      <DinerHead diner={diner} onProfile={onProfile} />
      {assocOnly && (
        <div className={s.assocNote}>
          <b>Associate menu.</b> Only the chef's special, the special of the week and the standing choices can be ordered for an associate.
        </div>
      )}
      {!assocOnly && <SearchField value={search} onChange={setSearch} placeholder={`Search ${o.meal.toLowerCase()} menu`} className={s.search} />}
      {!assocOnly && !search && (
        <div ref={tabsRef} className={s.tabs} role="tablist" aria-label="Menu">
          {tabs.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={cx(s.tab, tab === t && s.tabOn)} onClick={() => onTab(t)}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      )}
      {!assocOnly && !search && tab === 'Drinks' && (
        <div className={s.pills} role="group" aria-label="Drinks">
          {drinkGroups(o.meal, o.room, date).map(([g]) => {
            const on = effectiveDrinkGroup(o.meal, o.room, drinkGroup, date) === g;
            return (
              <button key={g} aria-pressed={on} className={cx(s.pill, on && s.pillOn)} onClick={() => setDrinkGroup(g)}>
                {g}
              </button>
            );
          })}
        </div>
      )}
      {assocOnly && (
        <div className={s.grid}>
          {assoc.map((sec) => (
            <SectionBlock key={sec.key} section={{ key: sec.key, kind: sec.special ? 'special' : 'everyday', label: sec.label, items: sec.items }}>
              {sec.items.map((it) => (
                <MenuTile
                  key={it.id}
                  item={it}
                  price={0}
                  special={sec.special}
                  allergic={hasFoodConflict(it, person)}
                  left={assocLeft(sec) ?? left(it.id)}
                  ahead={!!date}
                  onAdd={() => tap(it)}
                  onModify={() => setModItem(it)}
                />
              ))}
              {!sec.items.length && <div className={s.empty}>Not on the tablet menu at {o.meal.toLowerCase()}.</div>}
            </SectionBlock>
          ))}
          {!assoc.length && <div className={s.empty}>No associate menu is set for today.</div>}
        </div>
      )}
      {!assocOnly && (
        <div className={s.grid}>
          {tab === 'Sides' && !search && sideWait === diner.id && (
            <div className={s.sideNote}>This entree has no side. Adding one is optional: tap a side, another item, the next diner or Send.</div>
          )}
          {sections.map((sec) => (
            <SectionBlock key={sec.key} section={sec}>
              {sec.items.map((it) => (
                <MenuTile
                  key={it.id}
                  item={it}
                  price={isResident ? it.residentPrice : it.guestPrice}
                  special={it.day > 0 || !!it.special}
                  allergic={hasFoodConflict(it, person)}
                  left={left(it.id)}
                  ahead={!!date}
                  tint={sec.tint}
                  onAdd={() => tap(it)}
                  onModify={() => setModItem(it)}
                />
              ))}
            </SectionBlock>
          ))}
          {sections.length === 0 && (
            <div className={s.empty}>
              {search
                ? `No ${o.meal.toLowerCase()} items match “${search}”.`
                : `Nothing on ${date ? 'that day’s' : "today's"} menu in this category.`}
            </div>
          )}
        </div>
      )}
      {modItem && (
        <ModifierEditor
          item={modItem}
          diner={diner}
          person={person}
          initialMods={defaultMods(modItem.id)}
          onCancel={() => setModItem(null)}
          onConfirm={(mods, note) => add(modItem, mods, note)}
        />
      )}
      {pinned && (
        <PinnedEditor
          key={pinned.line.id}
          order={o}
          dinerRef={diner}
          lineId={pinned.line.id}
          person={person}
          onClose={() => setPinnedLine(null)}
          onDone={(itemId) => {
            setPinnedLine(null);
            onPicked(itemId);
          }}
        />
      )}
    </div>
  );
}

/** The Modify screen for an item just added because it has pinned choices; changes save as you go. */
function PinnedEditor({
  order,
  dinerRef,
  lineId,
  person,
  onClose,
  onDone,
}: {
  order: Order;
  dinerRef: Diner;
  lineId: string;
  person: Resident | undefined;
  onClose: () => void;
  onDone: (itemId: string) => void;
}) {
  const { updateItem } = useDining();
  const found = findLine(order, lineId);
  const item = found ? getItem(found.line.itemId) : undefined;
  if (!found || !item) return null;
  const save = (mods: ModSelection, note: string) => updateItem(order.id, dinerRef.id, lineId, mods, note);
  return (
    <ModifierEditor
      item={item}
      diner={dinerRef}
      person={person}
      initialMods={found.line.mods}
      initialNote={found.line.note}
      confirmLabel="Done"
      onAuto={save}
      onCancel={onClose}
      onConfirm={(mods, note) => {
        save(mods, note);
        onDone(item.id);
      }}
    />
  );
}

function SectionBlock({ section, children }: { section: MenuSection; children: ReactNode }) {
  const star = section.kind === 'specials' || section.kind === 'special' || section.kind === 'sideSpecial';
  return (
    <>
      {section.label && (
        <div
          className={cx(s.head, star && s.headSpecial, section.kind === 'everyday' && s.headPlain)}
          style={section.tint ? { color: section.tint[1] } : undefined}
        >
          {star && <Star size={11} strokeWidth={2.5} aria-hidden />}
          {section.tint && <span className={s.swatch} style={{ background: section.tint[0], boxShadow: `inset 0 0 0 1px ${section.tint[1]}66` }} />}
          {section.label}
          {section.kind !== 'specials' && section.kind !== 'everyday' && <span className={s.count}>{section.items.length}</span>}
        </div>
      )}
      {children}
    </>
  );
}
