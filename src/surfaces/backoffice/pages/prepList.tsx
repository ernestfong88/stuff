/**
 * Prep Checklist: each venue's subcategories and items, in the order
 * Production Prep shows them below the specials, with B, L and D for the
 * meals that show each one. Names save when the box loses focus. Deletes
 * can be undone from the toast.
 */
import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { uid } from '../../../lib/id';
import {
  PREP_MEALS,
  PRODUCTION_VENUES,
  checklistFor,
  getProductionVenue,
  isChecklistEdited,
  setChecklist,
  useProduction,
  type ChecklistGroup,
  type ChecklistItem,
  type PrepMeal,
} from '../../../store/production';
import { Button, Tabs, TextField, Toggle, cx, toast, useConfirm } from '../../../ui';
import { BoPage, BoSection } from '../kit';
import type { BoPageProps } from '../nav';
import s from './prepList.module.css';

/** Move the entry at i by d places (−1 up, +1 down); unchanged at the ends. */
function move<T>(list: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = list.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Text box that saves its value when it loses focus (or on Enter); a blank value puts the old one back. */
function NameBox({ value, label, onSave, bold }: { value: string; label: string; onSave: (v: string) => void; bold?: boolean }) {
  return (
    <TextField
      key={value}
      defaultValue={value}
      aria-label={label}
      className={cx(s.nameBox, bold && s.nameBold)}
      onBlur={(e) => {
        const t = e.target.value.trim();
        if (t && t !== value) onSave(t);
        else e.target.value = value;
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

export default function Page(_props: BoPageProps) {
  const state = useProduction();
  const [venueId, setVenueId] = useState(PRODUCTION_VENUES[0].id);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newGroup, setNewGroup] = useState('');
  const [ask, dialog] = useConfirm();
  const venue = getProductionVenue(venueId);
  const groups = checklistFor(state, venueId);
  const save = (next: ChecklistGroup[]) => setChecklist(venueId, next);
  const updateGroup = (id: string, f: (g: ChecklistGroup) => ChecklistGroup) => save(groups.map((g) => (g.id === id ? f(g) : g)));
  const updateItem = (gid: string, iid: string, f: (it: ChecklistItem) => ChecklistItem) =>
    updateGroup(gid, (g) => ({ ...g, items: g.items.map((it) => (it.id === iid ? f(it) : it)) }));

  const addItem = (g: ChecklistGroup) => {
    const text = (drafts[g.id] ?? '').trim();
    if (!text) return;
    // A new item shows at the meals the subcategory already uses.
    const used = PREP_MEALS.filter((m) => g.items.some((it) => it.meals.includes(m)));
    updateGroup(g.id, (x) => ({ ...x, items: [...x.items, { id: uid('pi'), text, meals: used.length ? used : ['Lunch', 'Dinner'], stock: false }] }));
    setDrafts({ ...drafts, [g.id]: '' });
    toast(`${text} added to ${g.name}`, { tone: 'success' });
  };

  const addGroup = () => {
    const name = newGroup.trim();
    if (!name) return;
    save([...groups, { id: uid('pg'), name, items: [] }]);
    setNewGroup('');
    toast(`${name} added`, { tone: 'success' });
  };

  const toggleMeal = (it: ChecklistItem, m: PrepMeal): PrepMeal[] =>
    it.meals.includes(m) ? it.meals.filter((x) => x !== m) : PREP_MEALS.filter((x) => x === m || it.meals.includes(x));

  return (
    <BoPage
      title="Prep Checklist"
      sub="What the Production Prep tablet checks off below the specials, for each venue. Checks start fresh each day and meal."
      actions={
        isChecklistEdited(state, venueId) && (
          <Button
            onClick={async () => {
              const ok = await ask({
                title: 'Reset to the starter list?',
                message: `${venue.name}'s own subcategories and items are replaced by the starter checklist.`,
                confirmLabel: 'Reset',
                tone: 'danger',
              });
              if (!ok) return;
              setChecklist(venueId, null);
              toast(`${venue.name} is back to the starter checklist`);
            }}
          >
            Reset to the starter list
          </Button>
        )
      }
    >
      <Tabs
        variant="segmented"
        aria-label="Venue"
        value={venueId}
        onChange={setVenueId}
        options={PRODUCTION_VENUES.map((v) => ({ id: v.id, label: v.name }))}
        className={s.venues}
      />
      <p className={s.howTo}>
        <span className={s.legend} aria-hidden>
          <span className={cx(s.meal, s.meal_Breakfast)}>B</span>
          <span className={cx(s.meal, s.meal_Lunch)}>L</span>
          <span className={cx(s.meal, s.meal_Dinner)}>D</span>
        </span>
        <span>
          Tap B, L or D to choose the meals that show an item. Turn on <strong>Stock check</strong> when the cook should mark it Stocked or Made a backup
          instead of a plain tick.
        </span>
      </p>

      {groups.map((g, gi) => (
        <BoSection
          key={g.id}
          title={<NameBox value={g.name} label="Subcategory name" bold onSave={(name) => updateGroup(g.id, (x) => ({ ...x, name }))} />}
          actions={
            <>
              <Button
                size="sm"
                variant="ghost"
                iconOnly
                icon={<ArrowUp size={15} />}
                disabled={gi === 0}
                onClick={() => save(move(groups, gi, -1))}
                aria-label={`Move ${g.name} up`}
              />
              <Button
                size="sm"
                variant="ghost"
                iconOnly
                icon={<ArrowDown size={15} />}
                disabled={gi === groups.length - 1}
                onClick={() => save(move(groups, gi, 1))}
                aria-label={`Move ${g.name} down`}
              />
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 size={14} />}
                aria-label={`Delete ${g.name}`}
                onClick={() => {
                  save(groups.filter((x) => x.id !== g.id));
                  toast(`${g.name} deleted${g.items.length ? ` with its ${g.items.length} ${g.items.length === 1 ? 'item' : 'items'}` : ''}`, {
                    action: { label: 'Undo', onClick: () => save(groups) },
                  });
                }}
              >
                Delete
              </Button>
            </>
          }
        >
          {!g.items.length && <p className={s.empty}>No items yet.</p>}
          {g.items.map((it, ii) => (
            <div key={it.id} className={s.item}>
              <NameBox value={it.text} label="Item" onSave={(text) => updateItem(g.id, it.id, (x) => ({ ...x, text }))} />
              {!it.meals.length && <span className={s.hidden}>Not shown at any meal</span>}
              <span className={s.controls}>
                <span className={s.meals} role="group" aria-label={`Meals for ${it.text}`}>
                  {PREP_MEALS.map((m) => {
                    const on = it.meals.includes(m);
                    return (
                      <button
                        key={m}
                        aria-pressed={on}
                        aria-label={m}
                        title={m}
                        className={cx(s.meal, on && s[`meal_${m}`])}
                        onClick={() => updateItem(g.id, it.id, (x) => ({ ...x, meals: toggleMeal(x, m) }))}
                      >
                        {m[0]}
                      </button>
                    );
                  })}
                </span>
                <span className={s.stock}>
                  <Toggle checked={it.stock} onChange={(stock) => updateItem(g.id, it.id, (x) => ({ ...x, stock }))} label="Stock check" />
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  iconOnly
                  icon={<ArrowUp size={15} />}
                  aria-label={`Move ${it.text} up`}
                  disabled={ii === 0}
                  onClick={() => updateGroup(g.id, (x) => ({ ...x, items: move(x.items, ii, -1) }))}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  iconOnly
                  icon={<ArrowDown size={15} />}
                  aria-label={`Move ${it.text} down`}
                  disabled={ii === g.items.length - 1}
                  onClick={() => updateGroup(g.id, (x) => ({ ...x, items: move(x.items, ii, 1) }))}
                />
                <Button
                  size="sm"
                  variant="softDanger"
                  iconOnly
                  icon={<Trash2 size={14} />}
                  aria-label={`Delete ${it.text}`}
                  onClick={() => {
                    updateGroup(g.id, (x) => ({ ...x, items: x.items.filter((y) => y.id !== it.id) }));
                    toast(`${it.text} deleted`, { action: { label: 'Undo', onClick: () => save(groups) } });
                  }}
                />
              </span>
            </div>
          ))}
          <form
            className={s.add}
            onSubmit={(e) => {
              e.preventDefault();
              addItem(g);
            }}
          >
            <TextField
              className={s.addInput}
              value={drafts[g.id] ?? ''}
              onChange={(e) => setDrafts({ ...drafts, [g.id]: e.target.value })}
              placeholder={`Add an item to ${g.name}`}
              aria-label={`Add an item to ${g.name}`}
            />
            <Button type="submit" variant="ghost" icon={<Plus size={15} />} disabled={!(drafts[g.id] ?? '').trim()}>
              Add item
            </Button>
          </form>
        </BoSection>
      ))}

      <BoSection>
        <form
          className={s.add}
          onSubmit={(e) => {
            e.preventDefault();
            addGroup();
          }}
        >
          <TextField className={s.addInput} value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="New subcategory, e.g. Salad bar" aria-label="New subcategory" />
          <Button type="submit" variant="primary" icon={<Plus size={15} />} disabled={!newGroup.trim()}>
            Add subcategory
          </Button>
        </form>
      </BoSection>
      {dialog}
    </BoPage>
  );
}
