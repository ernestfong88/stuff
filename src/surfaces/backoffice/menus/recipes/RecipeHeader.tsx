import { Send, Sparkles } from 'lucide-react';
import { inferAllergens } from '../../../../domain/allergens';
import { useConfig } from '../../../../store/config';
import { Button, Chip, toast } from '../../../../ui';
import { useBo } from '../data';
import { categoryLabel, normCategory, proteinLabel, proteinOf, subOf } from '../model/categories';
import { choiceWords, minutesText } from '../model/recipeDraft';
import { defaultShort, sameShortAs } from '../model/shortNames';
import { now } from '../../../../lib/clock';
import { DishPic } from '../ui/DishPic';
import { ScoreChip } from '../ui/recipeBits';
import type { RecipeFormProps } from './RecipeForm';
import s from './RecipeHeader.module.css';

/** The top of a recipe: photo, name, what the menu says, the KDS name and the numbers at a glance. */
export function RecipeHeader({ r, update, rename, short, onShort, readOnly, global, draft, page, score, busy, onAi, onSeeFeedback }: RecipeFormProps) {
  const bo = useBo();
  const cfg = useConfig();
  const cat = normCategory(r.cat);
  const desc = r.menuDescriptor ?? r.desc ?? '';
  const pinned = bo.modGroups.filter((g) => g.active && g.pinned.includes(r.id));
  const choice = /^build your own\b/i.test(r.name) ? null : choiceWords(desc);
  const dups = r.name ? sameShortAs({ name: r.name, shortDefault: short || r.shortDefault }, bo.recipes, cfg).filter((n) => n !== r.name) : [];
  const nutrition = r.nutrition ?? {};
  // No allergens recorded: show what the recipe's words suggest, marked so a chef confirms them.
  const suggested = (r.allergens ?? []).length ? [] : inferAllergens(r);
  const total = (r.prepMin ?? 0) + (r.cookMin ?? 0);
  const line = [categoryLabel(cat), subOf(r), cat === 'Entrees' ? proteinLabel(proteinOf(r), true) : ''].filter(Boolean).join(' · ');

  const num = (label: string, value: number | undefined, set: (v: number | undefined) => void) => (
    <label className={s.stat}>
      <span className={s.statLabel}>{label}</span>
      <span className={s.numRow}>
        <input
          className={s.num}
          type="number"
          min={0}
          disabled={readOnly}
          value={value ?? ''}
          placeholder="–"
          onChange={(e) => set(e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)))}
        />
        <span className={s.unit}>min</span>
      </span>
    </label>
  );

  return (
    <section className={s.header}>
      <div className={s.top}>
        <DishPic name={r.name} drink={cat === 'Drinks'} size={160} className={s.pic} />
        <div className={s.main}>
          <div className={s.kicker}>{line}</div>
          <input
            className={s.title}
            disabled={readOnly}
            value={r.name}
            aria-label="Menu name"
            placeholder="Recipe name"
            onChange={(e) => rename(e.target.value)}
          />
          <label className={s.field}>
            <span className={s.label}>Description</span>
            <textarea
              className={s.desc}
              disabled={readOnly}
              value={desc}
              rows={2}
              aria-label="Menu descriptor"
              placeholder="What residents read on the menu, and how it comes"
              onChange={(e) => {
                const v = e.target.value;
                // The short description follows the menu text until a chef sets it apart.
                update({ menuDescriptor: v, ...(!r.desc || r.desc === desc ? { desc: v } : {}) });
              }}
            />
          </label>
          {choice && (
            <p className={s.choice} role="note">
              “{choice}” sounds like a choice. Name the default here,{' '}
              {pinned.length
                ? `and let the ${pinned.map((g) => g.name).join(', ')} group${pinned.length > 1 ? 's' : ''} hold the options.`
                : 'and pin a modifier group in KDS settings for the options.'}
            </p>
          )}
          {((r.allergens ?? []).length > 0 || suggested.length > 0 || (r.dietFlags ?? []).length > 0) && (
            <div className={s.tags}>
              {(r.allergens ?? []).map((a) => (
                <Chip key={'a' + a} tone="warning" size="xs">
                  {a}
                </Chip>
              ))}
              {suggested.map((a) => (
                <Chip key={'s' + a} tone="neutral" size="xs">
                  {a} (suggested)
                </Chip>
              ))}
              {(r.dietFlags ?? []).map((d) => (
                <Chip key={'d' + d} tone="success" size="xs">
                  {d}
                </Chip>
              ))}
            </div>
          )}
          <div className={s.kds}>
            <span className={s.label}>KDS name</span>
            <input
              className={s.kdsInput}
              disabled={readOnly}
              value={short}
              placeholder={defaultShort(r)}
              aria-label="KDS name"
              title={`What servers and the kitchen see. Leave it blank to use ${defaultShort(r)}.`}
              onChange={(e) => onShort(e.target.value)}
            />
            {dups.length > 0 && (
              <Chip tone="warning" size="xs" title="Servers and the kitchen will not be able to tell these apart. Give one a different short name.">
                Same short name as {dups.slice(0, 2).join(', ')}
                {dups.length > 2 ? ` +${dups.length - 2}` : ''}
              </Chip>
            )}
          </div>
        </div>
        <div className={s.side}>
          {global ? (
            <Chip tone="info">Kisco recipe · Home Office manages it</Chip>
          ) : r.scope === 'linked' ? (
            <Chip tone="outline">Linked to a Kisco recipe</Chip>
          ) : r.submittedToHO ? (
            <Chip tone="info" icon={<Send size={11} />}>
              Submitted to Home Office
            </Chip>
          ) : null}
          <Button variant="primary" icon={<Sparkles size={15} />} disabled={busy || readOnly} onClick={onAi}>
            {busy ? 'Drafting…' : 'AI Autofill'}
          </Button>
          {!readOnly && !draft && !r.submittedToHO && (
            <Button
              onClick={() => {
                update({ submittedToHO: now() });
                toast('Sent to Home Office for review. If approved it joins the Kisco library with your community credited.', { tone: 'success' });
              }}
            >
              Submit to Home Office
            </Button>
          )}
        </div>
      </div>
      <div className={s.stats}>
        <div className={s.stat}>
          <span className={s.statLabel}>Yield</span>
          <span className={s.statValue}>1 serving</span>
        </div>
        <label className={s.stat}>
          <span className={s.statLabel}>Portion</span>
          <input
            className={s.portion}
            disabled={readOnly}
            value={r.servingDesc ?? r.servingSize ?? ''}
            placeholder="e.g. 6 oz"
            title={r.servingDesc ?? ''}
            onChange={(e) => update({ servingDesc: e.target.value })}
          />
        </label>
        {num('Prep', r.prepMin, (v) => update({ prepMin: v }))}
        {num('Cook', r.cookMin, (v) => update({ cookMin: v }))}
        <div className={s.stat}>
          <span className={s.statLabel}>Total</span>
          <span className={s.statValue}>{minutesText(total)}</span>
        </div>
        <div className={s.stat}>
          <span className={s.statLabel}>Calories</span>
          <span className={s.statValue}>{nutrition.calories ?? '–'}</span>
          {nutrition.calories != null && <span className={s.statSub}>per serving</span>}
        </div>
      </div>
      {page && score && (
        <div className={s.scoreBar}>
          <span className={s.scoreLabel}>Recipe score</span>
          <ScoreChip sc={score} />
          <span className={s.scoreText}>
            {(score.n
              ? `${score.n} resident ${score.n === 1 ? 'comment' : 'comments'}: ${score.pos} positive, ${score.neg} negative`
              : 'No resident comments yet') + (score.sales ? ` · ${score.sales.orders} sold` : '')}
          </span>
          {score.n > 0 && onSeeFeedback && (
            <button className={s.scoreLink} onClick={onSeeFeedback}>
              See what residents said
            </button>
          )}
        </div>
      )}
    </section>
  );
}
