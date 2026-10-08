import { useState, type ReactNode } from 'react';
import { BadgeCheck, ChevronLeft, CircleX, RotateCcw } from 'lucide-react';
import { now } from '../../../../lib/clock';
import type { RecipeSubmission } from '../../../../store/recipeApprovals';
import { Button, Chip, toast } from '../../../../ui';
import { BoCallout } from '../../kit';
import { approveSubmission, denySubmission, reopenSubmission } from '../../menus/approvals';
import { categoryLabel, normCategory } from '../../menus/model/categories';
import { minutesText, qtyUnit } from '../../menus/model/recipeDraft';
import { NUTRIENT_UNITS, previousApproved, recipeChanges, whenText, type FieldChange } from '../../menus/model/recipeApproval';
import { RecipeSection } from '../../menus/recipes/RecipeSection';
import { DishPic } from '../../menus/ui/DishPic';
import { DecisionDialog } from './DecisionDialog';
import s from './recipeApproval.module.css';

const STATUS = {
  waiting: { label: 'Waiting for review', tone: 'info' },
  approved: { label: 'Approved', tone: 'success' },
  denied: { label: 'Denied', tone: 'danger' },
} as const;

/** One recipe sent for approval, read-only, with what changed and the Approve / Deny actions. */
export function ReviewRecipe({ sub, subs, onBack }: { sub: RecipeSubmission; subs: RecipeSubmission[]; onBack: () => void }) {
  const [deciding, setDeciding] = useState<'approve' | 'deny' | null>(null);
  const r = sub.recipe;
  const at = now();
  const prev = previousApproved(subs, sub);
  const changes = prev ? recipeChanges(prev.recipe, r) : [];
  const n = r.nutrition ?? {};
  const st = STATUS[sub.status];

  const decide = (kind: 'approve' | 'deny', comment: string) => {
    if (kind === 'approve') approveSubmission(sub.id, comment);
    else denySubmission(sub.id, comment);
    setDeciding(null);
    onBack();
    toast(
      kind === 'approve'
        ? `${r.name} approved. ${sub.community} sees it on the recipe.`
        : `${r.name} denied. ${sub.community} sees your reason on the recipe.`,
      {
        tone: kind === 'approve' ? 'success' : undefined,
        action: { label: 'Undo', onClick: () => reopenSubmission(sub.id) },
      },
    );
  };

  return (
    <div className={s.review}>
      <div className={s.bar}>
        <button className={s.back} onClick={onBack}>
          <ChevronLeft size={16} aria-hidden /> Recipe Approval
        </button>
        <span className={s.barEnd}>
          {sub.status === 'waiting' ? (
            <>
              <Button variant="softDanger" icon={<CircleX size={15} />} onClick={() => setDeciding('deny')}>
                Deny
              </Button>
              <Button variant="success" icon={<BadgeCheck size={15} />} onClick={() => setDeciding('approve')}>
                Approve
              </Button>
            </>
          ) : (
            <Button
              icon={<RotateCcw size={14} />}
              onClick={() => {
                reopenSubmission(sub.id);
                toast(`${r.name} is back in Waiting.`);
              }}
            >
              Reopen
            </Button>
          )}
        </span>
      </div>

      <section className={s.head}>
        <DishPic name={r.name} drink={r.cat === 'Drinks'} size={132} className={s.pic} />
        <div className={s.headMain}>
          <div className={s.kicker}>{[categoryLabel(normCategory(r.cat)), r.sub].filter(Boolean).join(' · ')}</div>
          <h2 className={s.title}>{r.name}</h2>
          {(r.menuDescriptor || r.desc) && <p className={s.desc}>{r.menuDescriptor || r.desc}</p>}
          <div className={s.meta}>
            <Chip tone={st.tone}>{st.label}</Chip>
            {prev && <Chip tone="outline">Re-submitted</Chip>}
            <span>
              From <strong>{sub.community}</strong> · sent by {sub.sentBy} {whenText(sub.sentAt, at)}
            </span>
          </div>
          {sub.note && (
            <blockquote className={s.quote}>
              <span className={s.quoteLabel}>What changed / why</span>“{sub.note}”
            </blockquote>
          )}
        </div>
      </section>

      {sub.status !== 'waiting' && (
        <BoCallout
          tone={sub.status === 'approved' ? 'success' : 'danger'}
          title={`${st.label} by ${sub.decidedBy} ${sub.decidedAt ? whenText(sub.decidedAt, at) : ''}`}
        >
          {sub.comment ? `“${sub.comment}”` : 'No comment.'}
        </BoCallout>
      )}

      {prev && (
        <RecipeSection
          title={`What changed since the version approved ${prev.decidedAt ? whenText(prev.decidedAt, at) : ''}`}
          hint={changes.length ? `${changes.length} ${changes.length === 1 ? 'change' : 'changes'}` : 'Nothing changed in the recipe itself.'}
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

      <section className={s.stats} aria-label="At a glance">
        <Stat label="Portion" value={r.servingDesc || '–'} />
        <Stat label="Prep" value={r.prepMin != null ? minutesText(r.prepMin) : '–'} />
        <Stat label="Cook" value={r.cookMin != null ? minutesText(r.cookMin) : '–'} />
        <Stat label="Calories" value={n.calories != null ? String(n.calories) : '–'} />
        <Stat label="Sodium" value={n.sodium != null ? `${n.sodium} mg` : '–'} />
      </section>

      <RecipeSection title="Allergens and diets">
        <div className={s.chips}>
          {(r.allergens ?? []).map((a) => (
            <Chip key={a} tone="warning" size="xs">
              {a}
            </Chip>
          ))}
          {!(r.allergens ?? []).length && <span className={s.muted}>No allergens listed.</span>}
          {(r.dietFlags ?? []).map((d) => (
            <Chip key={d} tone="success" size="xs">
              {d}
            </Chip>
          ))}
        </div>
      </RecipeSection>

      <div className={s.twoCol}>
        <RecipeSection title="Ingredients" hint="Per serving">
          <List
            empty="No ingredients listed."
            items={(r.ingredients ?? []).map((i, k) => (
              <div key={k} className={s.ing}>
                <span className={s.qty}>{qtyUnit(i.qty, i.unit, false)}</span>
                <span>{i.name}</span>
              </div>
            ))}
          />
        </RecipeSection>
        <RecipeSection title="Method">
          <Steps steps={r.method ?? []} empty="No steps listed." />
          {(r.equipment ?? []).length > 0 && <p className={s.equipment}>Equipment: {r.equipment!.join(', ')}</p>}
        </RecipeSection>
      </div>

      <RecipeSection title="Plating and presentation">
        {r.garnish && (
          <p className={s.line}>
            <span className={s.lineLabel}>Garnish</span>
            {r.garnish}
          </p>
        )}
        <Steps steps={r.plating ?? []} empty="No plating steps." clay />
        {r.cookNotes && (
          <p className={s.line}>
            <span className={s.lineLabel}>Cook notes</span>
            {r.cookNotes}
          </p>
        )}
      </RecipeSection>

      <RecipeSection title="Nutrition facts" hint="Per serving">
        <div className={s.nutrition}>
          {NUTRIENT_UNITS.map(([k, label, unit]) => {
            const v = (n as Record<string, number | undefined>)[k];
            return (
              <div key={k} className={s.nut}>
                <span className={s.nutLabel}>{label}</span>
                <span className={s.nutValue}>{v != null ? `${v}${unit ? ' ' + unit : ''}` : '—'}</span>
              </div>
            );
          })}
        </div>
      </RecipeSection>

      {r.variations && (
        <RecipeSection title="Variations and chef's notes">
          <p className={s.line}>{r.variations}</p>
        </RecipeSection>
      )}

      {deciding && <DecisionDialog sub={sub} kind={deciding} onClose={() => setDeciding(null)} onDecide={(c) => decide(deciding, c)} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.stat}>
      <span className={s.statLabel}>{label}</span>
      <span className={s.statValue}>{value}</span>
    </div>
  );
}

function List({ items, empty }: { items: ReactNode[]; empty: string }) {
  return items.length ? <div className={s.list}>{items}</div> : <span className={s.muted}>{empty}</span>;
}

function Steps({ steps, empty, clay }: { steps: string[]; empty: string; clay?: boolean }) {
  if (!steps.length) return <span className={s.muted}>{empty}</span>;
  return (
    <ol className={s.steps}>
      {steps.map((t, i) => (
        <li key={i} className={s.step}>
          <span className={clay ? s.stepNoClay : s.stepNo}>{i + 1}</span>
          <span>{t}</span>
        </li>
      ))}
    </ol>
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
