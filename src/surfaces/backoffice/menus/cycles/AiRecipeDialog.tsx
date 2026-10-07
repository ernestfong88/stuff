import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { Recipe, RecipeCategory } from '../../../../store/menuEdits';
import { Button, Modal, TextArea, cx, toast } from '../../../../ui';
import { CATEGORIES, guessCategory, normCategory, subcategoryGroups } from '../model/categories';
import { autofill, ingredientsFromAbout } from '../model/recipeDraft';
import { defaultShort } from '../model/shortNames';
import { createRecipe, setRecipeShort } from '../recipeActions';
import { Field, Input, MoneyInput, Select } from '../ui/controls';
import s from './AiRecipeDialog.module.css';

const DIET_NOTES = ['Vegetarian', 'Gluten-Friendly', 'Heart-Healthy', 'No Salt Added', 'Lactose Intolerant'];
const AI_MS = 1400;

/**
 * AI Assist · New recipe. A few answers about the dish; AI drafts the
 * ingredients, method, nutrition and menu description, then the recipe is
 * placed and opens for review before anything prints.
 */
export function AiRecipeDialog({ name, cat, onClose, onCreated }: { name: string; cat?: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [d, setD] = useState(() => {
    const c = cat ? normCategory(cat) : guessCategory(name);
    return {
      name: name === name.toLowerCase() ? name.replace(/\b[a-z]/g, (x) => x.toUpperCase()) : name,
      short: '',
      cat: c,
      sub: '',
      about: '',
      price: null as number | null,
      diet: [] as string[],
    };
  });
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const groups = subcategoryGroups(d.cat);

  const make = () => {
    if (!d.name.trim() || busy) return;
    setBusy(true);
    timer.current = window.setTimeout(() => {
      const about = d.about.trim();
      const base: Recipe = {
        id: '',
        name: d.name.trim(),
        cat: d.cat,
        desc: about ? about.split(/[.!?](\s|$)/)[0].slice(0, 90) : '',
        menuDescriptor: about || undefined,
        dietFlags: d.diet,
        price: d.price ?? undefined,
        sub: d.sub || undefined,
      };
      const { patch } = autofill(base);
      const parts = ingredientsFromAbout(about);
      const { id: _id, name: nm, ...rest } = { ...base, ...patch, ...(parts.length > 1 ? { ingredients: parts } : {}) };
      const id = createRecipe(nm, { ...rest, aiDrafted: [...new Set([...(patch.aiDrafted ?? []), 'ingredients'])] });
      if (d.short.trim()) setRecipeShort({ name: nm }, d.short);
      toast(`AI drafted “${nm}”. Review it before it prints.`, { tone: 'success' });
      onCreated(id);
    }, AI_MS);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="AI Assist · New recipe"
      width={600}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Sparkles size={14} />} disabled={busy || !d.name.trim()} onClick={make}>
            {busy ? 'AI is drafting…' : 'Create with AI'}
          </Button>
        </>
      }
    >
      <div className={s.form}>
        <p className={s.intro}>
          Tell AI a little about the dish. It drafts the ingredients, method, nutrition and menu description, then you review the recipe before anything prints.
        </p>
        <div className={s.row}>
          <Field label="Menu name" className={s.wide}>
            <Input value={d.name} autoFocus onChange={(e) => setD({ ...d, name: e.target.value })} />
          </Field>
          <Field label="Short name" hint="Server tablet and tickets">
            <Input value={d.short} placeholder={defaultShort({ name: d.name.trim() })} onChange={(e) => setD({ ...d, short: e.target.value })} />
          </Field>
        </div>
        <div className={s.row}>
          <Field label="Category">
            <Select
              value={d.cat}
              onChange={(v) => setD({ ...d, cat: v as RecipeCategory, sub: '' })}
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </Field>
          {groups.length > 0 && (
            <Field label="Subcategory">
              <Select
                value={d.sub}
                placeholder="Let AI pick"
                onChange={(sub) => setD({ ...d, sub })}
                groups={groups.map(([g, list]) => [g, list.map((x) => ({ value: x, label: x }))])}
              />
            </Field>
          )}
          <Field label="Guest price">
            <MoneyInput value={d.price} placeholder="0" onChange={(price) => setD({ ...d, price })} width={110} />
          </Field>
        </div>
        <Field label="What should AI know about it?" hint="What's in it, how it's cooked and served, anything to call out.">
          <TextArea
            rows={3}
            value={d.about}
            placeholder="e.g. Pan-seared salmon over lemon orzo with asparagus and a dill cream sauce. Mild, no heat."
            onChange={(e) => setD({ ...d, about: e.target.value })}
          />
        </Field>
        <Field label="Diet notes">
          <div className={s.chips}>
            {DIET_NOTES.map((t) => {
              const on = d.diet.includes(t);
              return (
                <button
                  key={t}
                  aria-pressed={on}
                  className={cx(s.chip, on && s.chipOn)}
                  onClick={() => setD({ ...d, diet: on ? d.diet.filter((x) => x !== t) : [...d.diet, t] })}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </Field>
        {busy && (
          <p className={s.busy}>
            <Sparkles size={14} aria-hidden /> Drafting ingredients, method, nutrition and the menu description…
          </p>
        )}
      </div>
    </Modal>
  );
}
