import { useState } from 'react';
import { CheckCircle2, Lock, Sparkles } from 'lucide-react';
import type { Recipe } from '../../../../store/menuEdits';
import { cx } from '../../../../ui';
import { BoCallout } from '../../kit';
import type { RecipeScore } from '../model/score';
import { ApprovalBanner, canSubmit, useApproval } from './ApprovalBits';
import { RecipeHeader } from './RecipeHeader';
import { IngredientsSection, MethodSection, NotesSection, NutritionSection, PlatingSection, SettingsSection, SharingSection } from './recipeSections';
import s from './RecipeForm.module.css';

export interface RecipeFormProps {
  r: Recipe;
  /** Change fields of the recipe (saved at once on the page, kept as a draft in the dialog). */
  update: (patch: Partial<Recipe>) => void;
  /** Rename (on the page this also moves the recipe's short name). */
  rename: (name: string) => void;
  short: string;
  onShort: (v: string) => void;
  readOnly: boolean;
  /** A Home Office recipe from the Global Library. */
  global: boolean;
  /** The dialog keeps a draft until Save. */
  draft?: boolean;
  /** The full recipe page: adds the jump bar and the score. */
  page?: boolean;
  score?: RecipeScore | null;
  busy: boolean;
  onAi: () => void;
  onSeeFeedback?: () => void;
}

const JUMPS: Array<[string, string]> = [
  ['recipe', 'Recipe'],
  ['plating', 'Plating'],
  ['nutrition', 'Nutrition and diet'],
  ['menu', 'KDS & Recipe Book'],
  ['notes', 'Notes'],
];

/**
 * The recipe form, in the order a chef fills it in: what it is, what the
 * menu says, what the kitchen needs, then the detail. One layout for the
 * full recipe page and the recipe dialog.
 */
export function RecipeForm(p: RecipeFormProps) {
  const { r, readOnly, page } = p;
  const [scale, setScale] = useState<number | null>(null);
  const drafted = r.aiDrafted ?? [];
  const approval = useApproval(r);
  const go = (k: string) =>
    document
      .getElementById('recipe-sec-' + k)
      ?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });

  return (
    <div className={s.form}>
      <RecipeHeader {...p} />
      {page && !readOnly && !p.global && canSubmit(r) && <ApprovalBanner r={r} info={approval} />}
      {readOnly && (
        <BoCallout tone="info">
          <span className={s.calloutRow}>
            <Lock size={14} aria-hidden /> Managed by Home Office, so it is read-only here. Suggest a change at the bottom, or copy it from the Recipes list to
            make your own.
          </span>
        </BoCallout>
      )}
      {drafted.length > 0 && (
        <BoCallout tone="warning">
          <span className={s.calloutRow}>
            <Sparkles size={14} aria-hidden /> AI drafted the {drafted.join(', ')} from what was filled in. Review it before publishing.
            {!readOnly && (
              <button className={s.reviewed} onClick={() => p.update({ aiDrafted: undefined })}>
                <CheckCircle2 size={14} aria-hidden /> Mark as reviewed
              </button>
            )}
          </span>
        </BoCallout>
      )}
      {page && (
        <nav className={s.jumps} aria-label="Recipe sections">
          {JUMPS.map(([k, label]) => (
            <button key={k} className={s.jump} onClick={() => go(k)}>
              {label}
            </button>
          ))}
        </nav>
      )}
      <div id="recipe-sec-recipe" className={cx(s.twoCol, s.anchor)}>
        <IngredientsSection {...p} scale={scale} setScale={setScale} />
        <MethodSection {...p} />
      </div>
      <PlatingSection {...p} />
      <NutritionSection {...p} />
      <SettingsSection {...p} />
      <NotesSection {...p} />
      <SharingSection {...p} />
    </div>
  );
}
