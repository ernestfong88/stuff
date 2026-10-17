import { useState, type ReactNode } from 'react';
import { ChevronLeft, RotateCcw, X } from 'lucide-react';
import { now } from '../../../../lib/clock';
import type { Recipe } from '../../../../store/menuEdits';
import type { RecipeSnapshot, RecipeSubmission } from '../../../../store/recipeApprovals';
import { Button, Chip, cx, toast } from '../../../../ui';
import { BoCallout } from '../../kit';
import { approveSubmission, askForChanges, denySubmission, reopenSubmission } from '../../menus/approvals';
import { categoryLabel, normCategory } from '../../menus/model/categories';
import { minutesText } from '../../menus/model/recipeDraft';
import {
  changedKeys,
  changedParts,
  previousApproved,
  recipeChanges,
  whenText,
  type FieldChange,
  type ReviewPart,
} from '../../menus/model/recipeApproval';
import type { RecipeFormProps } from '../../menus/recipes/RecipeForm';
import { RecipeSection } from '../../menus/recipes/RecipeSection';
import { IngredientsSection, MethodSection, NutritionSection, PlatingSection } from '../../menus/recipes/recipeSections';
import { DishPic } from '../../menus/ui/DishPic';
import { DecisionDialog } from './DecisionDialog';
import { DECISION_ORDER, DECISIONS, type DecisionKind } from './decisions';
import s from './recipeApproval.module.css';

export const STATUS = {
  waiting: { label: 'Waiting for review', tone: 'info' },
  approved: { label: 'Approved', tone: 'success' },
  changes: { label: 'Changes requested', tone: 'warning' },
  denied: { label: 'Denied', tone: 'danger' },
} as const;

const DECIDED_TONE = { approved: 'success', changes: 'warning', denied: 'danger' } as const;

const noop = () => {};

/** The Recipe Book's own sections show the recipe that was sent, read-only. */
function readOnlyProps(id: string, r: RecipeSnapshot): RecipeFormProps {
  const recipe: Recipe = { id: 'review-' + id, ...r };
  return { r: recipe, update: noop, rename: noop, short: '', onShort: noop, readOnly: true, global: false, busy: false, onAi: noop };
}

/**
 * One recipe sent for approval, all of it read-only: who sent it and why,
 * the numbers, ingredients, method, plating, allergens and nutrition, what
 * changed since the version approved before, and the decision buttons in a
 * bar that stays in view while reading. `pane`: beside the queue on a wide
 * screen, so it closes instead of going back.
 */
export function ReviewRecipe({
  sub,
  subs,
  pane,
  onBack,
  onDecided,
}: {
  sub: RecipeSubmission;
  subs: RecipeSubmission[];
  pane?: boolean;
  /** Back to the queue (Close beside it); none when the pane shows the first recipe by itself. */
  onBack?: () => void;
  /** After a decision: the next recipe, or back to the queue. */
  onDecided: () => void;
}) {
  const [deciding, setDeciding] = useState<DecisionKind | null>(null);
  const [scale, setScale] = useState<number | null>(null);
  const r = sub.recipe;
  const at = now();
  const prev = previousApproved(subs, sub);
  const changes = prev ? recipeChanges(prev.recipe, r) : [];
  const parts = changedParts(prev?.recipe, r);
  const keys = new Set<string>(prev ? changedKeys(prev.recipe, r) : []);
  const st = STATUS[sub.status];
  const p = readOnlyProps(sub.id, r);
  const n = r.nutrition ?? {};
  const total = (r.prepMin ?? 0) + (r.cookMin ?? 0);

  const decide = (kind: DecisionKind, comment: string) => {
    if (kind === 'approve') approveSubmission(sub.id, comment);
    else if (kind === 'changes') askForChanges(sub.id, comment);
    else denySubmission(sub.id, comment);
    setDeciding(null);
    onDecided();
    toast(DECISIONS[kind].done(r.name, sub.community), {
      tone: kind === 'approve' ? 'success' : undefined,
      action: { label: 'Undo', onClick: () => reopenSubmission(sub.id) },
    });
  };

  const part = (k: ReviewPart, node: ReactNode) => (
    <Part key={k} changed={parts.has(k)}>
      {node}
    </Part>
  );

  return (
    <article className={s.review} aria-label={`Review: ${r.name}`}>
      <div className={s.barWrap}>
        <div className={s.bar}>
          {onBack && (
            <button className={s.back} onClick={onBack}>
              {pane ? <X size={16} aria-hidden /> : <ChevronLeft size={16} aria-hidden />}
              {pane ? 'Close' : 'Recipe Approval'}
            </button>
          )}
          <span className={s.barTitle}>
            <strong>{r.name}</strong>
            <span className={s.barFrom}>{sub.community}</span>
          </span>
          <span className={s.barEnd}>
            {sub.status === 'waiting' ? (
              DECISION_ORDER.map((k) => {
                const d = DECISIONS[k];
                const Icon = d.icon;
                return (
                  <Button key={k} variant={d.buttonVariant} icon={<Icon size={15} />} onClick={() => setDeciding(k)}>
                    {d.button}
                  </Button>
                );
              })
            ) : (
              <>
                <Chip tone={st.tone}>{st.label}</Chip>
                <Button
                  icon={<RotateCcw size={14} />}
                  onClick={() => {
                    reopenSubmission(sub.id);
                    toast(`${r.name} is back in Waiting.`);
                  }}
                >
                  Reopen
                </Button>
              </>
            )}
          </span>
        </div>
      </div>

      {part(
        'about',
        <section className={s.head}>
          <DishPic name={r.name} drink={r.cat === 'Drinks'} size={132} className={s.pic} />
          <div className={s.headMain}>
            <div className={s.kicker}>{[categoryLabel(normCategory(r.cat)), r.sub].filter(Boolean).join(' · ')}</div>
            <h2 className={s.title}>{r.name}</h2>
            {(r.menuDescriptor || r.desc) && <p className={s.desc}>{r.menuDescriptor || r.desc}</p>}
            <div className={s.meta}>
              <Chip tone={st.tone}>{st.label}</Chip>
              <Chip tone="outline">{prev ? 'Change to an approved recipe' : 'New recipe'}</Chip>
              <span>
                From <strong>{sub.community}</strong> · sent by {sub.sentBy} on {dateText(sub.sentAt)} ({whenText(sub.sentAt, at)})
              </span>
            </div>
            <blockquote className={s.quote}>
              <span className={s.quoteLabel}>Their note: what changed and why</span>
              {sub.note ? `“${sub.note}”` : <span className={s.muted}>No note sent with it.</span>}
            </blockquote>
          </div>
        </section>,
      )}

      {sub.status !== 'waiting' && (
        <BoCallout
          tone={DECIDED_TONE[sub.status]}
          title={`${st.label} by ${sub.decidedBy ?? 'Home Office'} ${sub.decidedAt ? whenText(sub.decidedAt, at) : ''}`}
        >
          {sub.comment ? `“${sub.comment}”` : 'No comment.'}
        </BoCallout>
      )}

      {prev && (
        <RecipeSection
          className={s.whatChanged}
          title={`What changed since the version approved ${prev.decidedAt ? whenText(prev.decidedAt, at) : ''}`}
          hint={
            changes.length
              ? `${changes.length} ${changes.length === 1 ? 'change' : 'changes'}. Changed parts are marked below.`
              : 'Nothing changed in the recipe itself.'
          }
        >
          {changes.length > 0 && (
            <ul className={s.changes}>
              {changes.map((c) => (
                <Change key={c.label} c={c} />
              ))}
            </ul>
          )}
        </RecipeSection>
      )}

      {part(
        'numbers',
        <section className={s.stats} aria-label="At a glance">
          <Stat label="Yield" value="1 serving" />
          <Stat label="Portion" value={r.servingDesc || '–'} changed={keys.has('servingDesc')} />
          <Stat label="Prep" value={r.prepMin != null ? minutesText(r.prepMin) : '–'} changed={keys.has('prepMin')} />
          <Stat label="Cook" value={r.cookMin != null ? minutesText(r.cookMin) : '–'} changed={keys.has('cookMin')} />
          <Stat label="Total" value={total ? minutesText(total) : '–'} />
          <Stat label="Calories" value={n.calories != null ? String(n.calories) : '–'} sub="per serving" />
          <Stat label="Sodium" value={n.sodium != null ? `${n.sodium} mg` : '–'} sub="per serving" />
        </section>,
      )}

      <div className={s.twoCol}>
        {part('ingredients', <IngredientsSection {...p} scale={scale} setScale={setScale} />)}
        {part('method', <MethodSection {...p} />)}
      </div>
      <div className={s.twoCol}>
        {part('plating', <PlatingSection {...p} />)}
        {part('nutrition', <NutritionSection {...p} />)}
      </div>

      {r.variations &&
        part(
          'notes',
          <RecipeSection title="Variations and chef's notes">
            <p className={s.line}>{r.variations}</p>
          </RecipeSection>,
        )}

      {deciding && <DecisionDialog sub={sub} kind={deciding} onClose={() => setDeciding(null)} onDecide={(c) => decide(deciding, c)} />}
    </article>
  );
}

const dateText = (ts: number) => new Date(ts).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/** A part of the recipe, marked when it changed since the version approved before. */
function Part({ changed, children }: { changed: boolean; children: ReactNode }) {
  if (!changed) return <>{children}</>;
  return (
    <div className={s.changedPart}>
      <span className={s.changedTag}>Changed</span>
      {children}
    </div>
  );
}

function Stat({ label, value, sub, changed }: { label: string; value: string; sub?: string; changed?: boolean }) {
  return (
    <div className={cx(s.stat, changed && s.statChanged)}>
      <span className={s.statLabel}>
        {label}
        {changed && <span className="sr-only"> (changed)</span>}
      </span>
      <span className={s.statValue}>{value}</span>
      {sub && <span className={s.statSub}>{sub}</span>}
    </div>
  );
}

function Change({ c }: { c: FieldChange }) {
  return (
    <li className={s.change}>
      <span className={s.changeLabel}>{c.label}</span>
      <span className={s.changeBody}>
        {c.added || c.removed ? (
          <>
            {c.removed?.map((l) => (
              <span key={'-' + l} className={s.removed}>
                <span aria-hidden>− </span>
                <span className="sr-only">Removed: </span>
                {l}
              </span>
            ))}
            {c.added?.map((l) => (
              <span key={'+' + l} className={s.added}>
                <span aria-hidden>+ </span>
                <span className="sr-only">Added: </span>
                {l}
              </span>
            ))}
          </>
        ) : (
          <span>
            {c.before ? <span className={s.was}>{c.before}</span> : <span className={s.muted}>none</span>} → <strong>{c.after || 'none'}</strong>
          </span>
        )}
      </span>
    </li>
  );
}
