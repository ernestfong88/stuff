import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import type { Recipe } from '../../../../store/menuEdits';
import { cx } from '../../../../ui';
import s from './RecipeSection.module.css';

/** A titled card in the recipe form; `id` makes it a jump target. */
export function RecipeSection({ id, title, hint, right, children, className }: { id?: string; title: ReactNode; hint?: ReactNode; right?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section id={id ? 'recipe-sec-' + id : undefined} className={cx(s.sec, id && s.anchor, className)}>
      <div className={s.head}>
        <div className={s.titles}>
          <h3 className={s.title}>{title}</h3>
          {hint && <p className={s.hint}>{hint}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

/** "AI filled · review" tag for a part AI drafted. */
export function AiTag({ r, part }: { r: Recipe; part: string }) {
  return (r.aiDrafted ?? []).includes(part) ? (
    <span className={s.aiTag}>
      <Sparkles size={10} aria-hidden /> AI filled · review
    </span>
  ) : null;
}
