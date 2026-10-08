import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { inferAllergens } from '../../../../domain/allergens';
import type { Ingredient, Nutrition, RecipeCategory } from '../../../../store/menuEdits';
import { Button, cx, toast } from '../../../../ui';
import { updateBo, useBo } from '../data';
import { categoryLabel, ALLERGENS, CATEGORIES, DIETS, PROTEINS, categoryCourse, guessProtein, normCategory, subcategoryGroups, subOf } from '../model/categories';
import { qtyUnit } from '../model/recipeDraft';
import { Field, Input, Select } from '../ui/controls';
import { useDraft } from '../ui/useDraft';
import type { RecipeFormProps } from './RecipeForm';
import { AiTag, RecipeSection } from './RecipeSection';
import s from './recipeSections.module.css';

type P = RecipeFormProps;

const NUTRIENTS: Array<[keyof Nutrition, string, string]> = [
  ['calories', 'Calories', ''],
  ['protein', 'Protein', 'g'],
  ['carbs', 'Carbs', 'g'],
  ['fat', 'Fat', 'g'],
  ['sodium', 'Sodium', 'mg'],
  ['fiber', 'Fiber', 'g'],
  ['calcium', 'Calcium', 'mg'],
];

/** One step's text area; what is typed is saved when typing pauses (useDraft). */
function StepText({
  value,
  label,
  readOnly,
  draftKey,
  immediate,
  onCommit,
}: {
  value: string;
  label: string;
  readOnly: boolean;
  draftKey: string;
  immediate: boolean;
  onCommit: (v: string) => void;
}) {
  const field = useDraft(value, onCommit, draftKey, immediate);
  return (
    <textarea
      className={s.stepText}
      disabled={readOnly}
      aria-label={label}
      rows={Math.max(1, Math.ceil((field.value || '').length / 80))}
      {...field}
    />
  );
}

/** Numbered steps, each a small text area, with remove and add. */
function StepList({
  steps,
  readOnly,
  onChange,
  addLabel,
  empty,
  tone,
  label,
  draftKey,
  immediate,
}: {
  steps: string[];
  readOnly: boolean;
  onChange: (v: string[]) => void;
  addLabel: string;
  empty: string;
  tone: 'ink' | 'clay';
  label: string;
  /** The recipe being edited (see useDraft). */
  draftKey: string;
  /** Save every key at once (the dialog's draft). */
  immediate: boolean;
}) {
  return (
    <div className={s.steps}>
      {steps.map((t, i) => (
        <div key={i} className={s.step}>
          <span className={cx(s.stepNo, tone === 'clay' && s.stepNoClay)}>{i + 1}</span>
          <StepText
            value={t}
            label={`${label} ${i + 1}`}
            readOnly={readOnly}
            draftKey={draftKey}
            immediate={immediate}
            onCommit={(v) => onChange(steps.map((x, j) => (j === i ? v : x)))}
          />
          {!readOnly && (
            <button className={s.x} aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} onClick={() => onChange(steps.filter((_, j) => j !== i))}>
              <X size={13} />
            </button>
          )}
        </div>
      ))}
      {!steps.length && <span className={s.muted}>{empty}</span>}
      {!readOnly && (
        <div>
          <Button size="sm" icon={<Plus size={13} />} onClick={() => onChange([...steps, ''])}>
            {addLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

function ToggleChips({
  all,
  on,
  readOnly,
  onChange,
  tone,
}: {
  all: string[];
  on: string[];
  readOnly: boolean;
  onChange: (v: string[]) => void;
  tone: 'warn' | 'good';
}) {
  return (
    <div className={s.chips}>
      {all.map((x) => {
        const sel = on.includes(x);
        return (
          <button
            key={x}
            type="button"
            disabled={readOnly}
            aria-pressed={sel}
            className={cx(s.chip, sel && (tone === 'warn' ? s.chipWarn : s.chipGood))}
            onClick={() => onChange(sel ? on.filter((y) => y !== x) : [...on, x])}
          >
            {x}
          </button>
        );
      })}
    </div>
  );
}

export function IngredientsSection({ r, update, readOnly, scale, setScale }: P & { scale: number | null; setScale: (v: number | null) => void }) {
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');
  const [name, setName] = useState('');
  const mul = scale ?? 1;
  const list = r.ingredients ?? [];
  const add = () => {
    if (!name.trim() || !qty) return;
    update({ ingredients: [...list, { qty: Number(qty), unit: unit.trim(), name: name.trim() } satisfies Ingredient] });
    setQty('');
    setUnit('');
    setName('');
  };
  return (
    <RecipeSection
      title="Ingredients"
      right={
        <span className={s.scale}>
          <AiTag r={r} part="ingredients" />
          Scale to
          <input
            type="number"
            min={1}
            className={s.scaleInput}
            value={mul}
            aria-label="Scale to servings"
            onChange={(e) => setScale(Math.max(1, Number(e.target.value) || 1))}
          />
          servings
          {scale != null && scale !== 1 && (
            <button className={s.link} onClick={() => setScale(null)}>
              Reset
            </button>
          )}
        </span>
      }
    >
      <div className={s.ingredients}>
        {list.map((h, i) => (
          <div key={i} className={s.ing}>
            <span className={s.qty}>{h.qty ? qtyUnit(h.qty * mul, h.unit, mul !== 1) : h.unit}</span>
            <span className={s.ingName}>{h.name}</span>
            {!readOnly && (
              <button className={s.x} aria-label={`Remove ${h.name}`} onClick={() => update({ ingredients: list.filter((_, j) => j !== i) })}>
                <X size={12} />
              </button>
            )}
          </div>
        ))}
        {!list.length && <span className={s.muted}>None yet. Add them below, or let AI Autofill draft a starting point.</span>}
        {!readOnly && mul === 1 && (
          <div className={s.addIng}>
            <Input
              size="sm"
              type="number"
              min={0}
              step="any"
              placeholder="Qty"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className={s.qtyIn}
              aria-label="Quantity"
            />
            <Input size="sm" placeholder="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} className={s.unitIn} aria-label="Unit" />
            <Input
              size="sm"
              placeholder="Ingredient"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              className={s.grow}
              aria-label="Ingredient"
            />
            <Button size="sm" iconOnly icon={<Plus size={14} />} aria-label="Add ingredient" disabled={!name.trim() || !qty} onClick={add} />
          </div>
        )}
        {mul !== 1 && <p className={s.muted}>Amounts shown for {mul} servings. Reset to edit the one-serving recipe.</p>}
      </div>
    </RecipeSection>
  );
}

export function MethodSection({ r, update, readOnly, draft }: P) {
  const [eq, setEq] = useState('');
  const equipment = r.equipment ?? [];
  return (
    <RecipeSection title="Method" right={<AiTag r={r} part="method" />}>
      <StepList
        steps={r.method ?? []}
        readOnly={readOnly}
        onChange={(method) => update({ method })}
        draftKey={r.id}
        immediate={!!draft}
        addLabel="Add step"
        empty="No steps yet. Add them here, or let AI Autofill draft a starting point."
        tone="ink"
        label="Step"
      />
      <Field label="Equipment">
        <div className={s.chips}>
          {equipment.map((x, i) => (
            <span key={i} className={s.tag}>
              {x}
              {!readOnly && (
                <button aria-label={`Remove ${x}`} onClick={() => update({ equipment: equipment.filter((_, j) => j !== i) })}>
                  <X size={11} />
                </button>
              )}
            </span>
          ))}
          {!readOnly && (
            <Input
              size="sm"
              value={eq}
              placeholder="+ Add equipment"
              aria-label="Add equipment"
              className={s.eqIn}
              onChange={(e) => setEq(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && eq.trim()) {
                  update({ equipment: [...equipment, eq.trim()] });
                  setEq('');
                }
              }}
            />
          )}
          {readOnly && !equipment.length && <span className={s.muted}>None listed.</span>}
        </div>
      </Field>
    </RecipeSection>
  );
}

export function PlatingSection({ r, update, readOnly, draft }: P) {
  const portion = useDraft(r.servingDesc ?? r.servingSize ?? '', (v) => update({ servingDesc: v }), r.id, !!draft);
  const garnish = useDraft(r.garnish ?? '', (v) => update({ garnish: v }), r.id, !!draft);
  const cookNotes = useDraft(r.cookNotes ?? '', (v) => update({ cookNotes: v }), r.id, !!draft);
  return (
    <RecipeSection id="plating" title="Plating and presentation" hint="How it should look when it reaches the resident.">
      <div className={s.grid}>
        <Field label="Portion">
          <Input disabled={readOnly} placeholder="e.g. 6 oz fillet, or 1 cup (8 fl oz)" {...portion} />
        </Field>
        <Field label="Garnish">
          <Input disabled={readOnly} placeholder="e.g. Thyme sprig and sliced peaches" {...garnish} />
        </Field>
      </div>
      <Field label="Plating steps">
        <StepList
          steps={r.plating ?? []}
          readOnly={readOnly}
          onChange={(plating) => update({ plating })}
          draftKey={r.id}
          immediate={!!draft}
          addLabel="Add plating step"
          empty="No plating steps yet."
          tone="clay"
          label="Plating step"
        />
      </Field>
      <Field label="Cook notes" hint="The cook line sees these with the photo.">
        <textarea
          className={s.area}
          disabled={readOnly}
          rows={2}
          placeholder="e.g. Rest 4 min. Sauce under, not over."
          {...cookNotes}
        />
      </Field>
    </RecipeSection>
  );
}

/** A nutrition number, saved when typing pauses (useDraft). */
function NutrientInput({
  value,
  readOnly,
  draftKey,
  immediate,
  onCommit,
}: {
  value: number | undefined;
  readOnly: boolean;
  draftKey: string;
  immediate: boolean;
  onCommit: (v: number | undefined) => void;
}) {
  const field = useDraft(value == null ? '' : String(value), (v) => onCommit(v === '' ? undefined : Number(v)), draftKey, immediate);
  return <input type="number" className={s.nutIn} disabled={readOnly} placeholder="—" {...field} />;
}

export function NutritionSection({ r, update, readOnly, draft }: P) {
  const n = r.nutrition ?? {};
  // No allergens recorded: suggest them from the recipe's words so a chef can confirm.
  const suggested = (r.allergens ?? []).length ? [] : inferAllergens(r);
  return (
    <RecipeSection
      id="nutrition"
      title="Nutrition facts and diet information"
      hint="Allergens, diets, and nutrition per serving. AI Autofill drafts the nutrition; check it before you publish."
      right={<AiTag r={r} part="nutrition" />}
    >
      <Field label="Allergens" hint="Servers see these on the tablet and the kitchen ticket warns when a resident's allergy matches.">
        <ToggleChips all={ALLERGENS} on={r.allergens ?? []} readOnly={readOnly} onChange={(allergens) => update({ allergens })} tone="warn" />
        {suggested.length > 0 && (
          <p className={s.suggested} role="note">
            <strong>Suggested: {suggested.join(', ')}.</strong> Read from the name, description and ingredients; none are confirmed yet. Until you
            confirm, servers see “may contain” and allergy warnings use these.{' '}
            {!readOnly && (
              <button type="button" className={s.link} onClick={() => update({ allergens: [...suggested] })}>
                Confirm suggested
              </button>
            )}
          </p>
        )}
      </Field>
      <Field label="Diet indicators">
        <ToggleChips all={DIETS} on={r.dietFlags ?? []} readOnly={readOnly} onChange={(dietFlags) => update({ dietFlags })} tone="good" />
      </Field>
      <Field label="Nutrition facts · per serving">
        <div className={s.nutrition}>
          {NUTRIENTS.map(([k, label, unit]) => (
            <label key={k} className={s.nut}>
              <span className={s.nutLabel}>{label}</span>
              <span className={s.nutRow}>
                <NutrientInput value={n[k]} readOnly={readOnly} draftKey={r.id} immediate={!!draft} onCommit={(v) => update({ nutrition: { ...n, [k]: v } })} />
                <span className={s.nutUnit}>{unit}</span>
              </span>
            </label>
          ))}
        </div>
      </Field>
    </RecipeSection>
  );
}

export function SettingsSection({ r, update, readOnly, draft }: P) {
  const bo = useBo();
  const cat = normCategory(r.cat);
  const groups = subcategoryGroups(cat);
  const course = categoryCourse(cat);
  const pinned = bo.modGroups.filter((g) => g.active && g.pinned.includes(r.id));
  const unpinned = bo.modGroups.filter((g) => g.active && !g.pinned.includes(r.id));
  const saved = bo.recipes.some((x) => x.id === r.id);
  const pin = (gid: string, on: boolean) =>
    updateBo((st) => ({
      modGroups: st.modGroups.map((g) => (g.id === gid ? { ...g, pinned: on ? [...g.pinned, r.id] : g.pinned.filter((x) => x !== r.id) } : g)),
    }));
  const route = r.route ?? 'kds';
  return (
    <RecipeSection id="menu" title="KDS & Recipe Book Settings">
      <div className={s.grid}>
        <Field label="Category">
          <Select
            disabled={readOnly}
            value={cat}
            onChange={(v) => update({ cat: v as RecipeCategory, ...(draft ? { sub: undefined } : {}) })}
            options={CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) }))}
            aria-label="Category"
          />
        </Field>
        {groups.length > 0 && (
          <Field label="Subcategory">
            <Select
              disabled={readOnly}
              value={subOf(r)}
              onChange={(sub) => update({ sub })}
              groups={groups.map(([g, subs]) => [g, subs.map((x) => ({ value: x, label: x }))])}
              aria-label="Subcategory"
            />
          </Field>
        )}
        {cat === 'Entrees' && (
          <Field label="Protein" hint="Entrees are grouped by protein so the menu can be balanced.">
            <Select
              disabled={readOnly}
              value={r.protein ?? ''}
              onChange={(v) => update({ protein: v && v !== guessProtein(r.name) ? v : undefined })}
              placeholder={'Protein · ' + (PROTEINS.find((p) => p.id === guessProtein(r.name))?.label ?? 'Other')}
              options={PROTEINS.map((p) => ({ value: p.id, label: p.label }))}
              aria-label="Protein"
            />
          </Field>
        )}
        <Field label="Course">
          <span className={s.pill} title="The course comes from the category">
            {course ? `Course ${course} · from the category` : cat === 'Snacks' ? "Not on the server's menu" : 'No course · rings in when sent'}
          </span>
        </Field>
      </div>
      {cat === 'Snacks' ? (
        <p className={s.muted}>Snacks are for the menu builder only. They never show on the server&apos;s order screen.</p>
      ) : cat === 'Drinks' ? (
        <p className={s.muted}>Drinks go to the server, or to the bar where there is one.</p>
      ) : (
        <Field label="Who makes it">
          <div className={s.seg} role="radiogroup" aria-label="Who makes it">
            {(
              [
                ['kds', 'Cook line'],
                ['expo', 'Server makes it'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={route === k}
                disabled={readOnly}
                className={cx(s.segBtn, route === k && s.segOn)}
                onClick={() => update({ route: k })}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
      )}
      <Field label="Pinned modifier groups">
        {saved ? (
          <div className={s.chips}>
            {pinned.map((g) => (
              <span key={g.id} className={s.tag}>
                {g.name}
                {!readOnly && (
                  <button aria-label={`Unpin ${g.name}`} onClick={() => pin(g.id, false)}>
                    <X size={11} />
                  </button>
                )}
              </span>
            ))}
            {!readOnly && (
              <Select
                size="sm"
                value=""
                onChange={(v) => v && pin(v, true)}
                placeholder="+ Pin a group…"
                options={unpinned.map((g) => ({ value: g.id, label: g.name }))}
                aria-label="Pin a modifier group"
              />
            )}
            {readOnly && !pinned.length && <span className={s.muted}>Communities pin their own groups to this recipe.</span>}
          </div>
        ) : (
          <span className={s.muted}>Save the recipe first, then pin groups to it.</span>
        )}
      </Field>
      <Reminders r={r} update={update} readOnly={readOnly} />
    </RecipeSection>
  );
}

/** "Don't forget" items: Expo and the server see them like a modifier; the cook never does. */
function Reminders({ r, update, readOnly }: Pick<P, 'r' | 'update' | 'readOnly'>) {
  const [t, setT] = useState('');
  const list = r.reminders ?? [];
  const add = () => {
    const v = t.trim().slice(0, 40);
    if (v && !list.includes(v)) update({ reminders: [...list, v] });
    setT('');
  };
  return (
    <Field
      label="Don't forget"
      hint="Shows on the Expo ticket and the server's run step like a modifier. It never goes to the cook and has no price. The server can remove it for a guest."
    >
      <div className={s.chips}>
        {list.map((x) => (
          <span key={x} className={s.tag}>
            {x}
            {!readOnly && (
              <button aria-label={`Remove ${x}`} onClick={() => update({ reminders: list.filter((y) => y !== x) })}>
                <X size={11} />
              </button>
            )}
          </span>
        ))}
      </div>
      {!readOnly && (
        <div className={s.addIng}>
          <Input
            size="sm"
            className={s.grow}
            value={t}
            maxLength={40}
            placeholder="e.g. Steak knife, Extra lemon"
            aria-label="Add a reminder"
            onChange={(e) => setT(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <Button size="sm" variant="ghost" onClick={add} disabled={!t.trim()}>
            Add
          </Button>
        </div>
      )}
    </Field>
  );
}

export function NotesSection({ r, update, readOnly, draft }: P) {
  const variations = useDraft(r.variations ?? '', (v) => update({ variations: v }), r.id, !!draft);
  return (
    <RecipeSection id="notes" title="Variations and chef's notes" hint="Diet versions, swaps, and anything the next chef should know.">
      <textarea
        className={s.area}
        rows={3}
        disabled={readOnly}
        aria-label="Variations and chef's notes"
        placeholder="e.g. Mechanical altered: dice to 1/2 inch, sauce on the side."
        {...variations}
      />
    </RecipeSection>
  );
}

export function SharingSection({ r, readOnly, global }: P) {
  const [sug, setSug] = useState('');
  const linked = r.scope === 'linked';
  if (!(global || linked || r.importedFrom || r.sourceFile)) return null;
  return (
    <RecipeSection title="Sharing" hint="Where this recipe comes from and who else uses it.">
      <div className={s.sharing}>
        {global && <span>This is a Kisco recipe. Home Office manages it, and their updates reach every community that uses it.</span>}
        {linked && <span>Linked to a Kisco recipe. When Home Office updates it, the change shows here too.</span>}
        {r.sourceFile ? (
          <span>Imported from {r.sourceFile}. Review every line before publishing.</span>
        ) : (
          r.importedFrom && <span>Drafted from {r.importedFrom === 'photo' ? 'your photo' : 'your text'}. Review every line before publishing.</span>
        )}
      </div>
      {readOnly && (
        <Field label="Suggest a change to Home Office" hint="The recipe owner sees it on the recipe.">
          <div className={s.addIng}>
            <Input
              size="sm"
              className={s.grow}
              value={sug}
              placeholder="e.g. use a cup of milk instead of three tablespoons"
              onChange={(e) => setSug(e.target.value)}
              aria-label="Suggested change"
            />
            <Button
              size="sm"
              variant="primary"
              disabled={!sug.trim()}
              onClick={() => {
                setSug('');
                toast('Suggestion sent to the recipe owner', { tone: 'success' });
              }}
            >
              Send
            </Button>
          </div>
        </Field>
      )}
    </RecipeSection>
  );
}
