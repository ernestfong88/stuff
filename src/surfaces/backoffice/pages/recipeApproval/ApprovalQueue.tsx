import { ChevronRight } from 'lucide-react';
import { now } from '../../../../lib/clock';
import type { RecipeSubmission } from '../../../../store/recipeApprovals';
import { Chip, Tabs } from '../../../../ui';
import { BoPage, BoTable, type BoColumn } from '../../kit';
import { categoryLabel, normCategory } from '../../menus/model/categories';
import { previousApproved, queueCounts, queueOf, whenText, type QueueTab } from '../../menus/model/recipeApproval';
import { DishPic } from '../../menus/ui/DishPic';
import s from './recipeApproval.module.css';

const EMPTY: Record<QueueTab, string> = {
  waiting: 'Nothing waiting. Recipes the communities send for approval show here.',
  approved: 'No recipes approved yet.',
  denied: 'No recipes denied.',
};

/** The queue: Waiting, Approved and Denied, one row per recipe sent. */
export function ApprovalQueue({
  subs,
  tab,
  onTab,
  onOpen,
}: {
  subs: RecipeSubmission[];
  tab: QueueTab;
  onTab: (t: QueueTab) => void;
  onOpen: (sub: RecipeSubmission) => void;
}) {
  const n = queueCounts(subs);
  const rows = queueOf(subs, tab);
  const at = now();
  const columns: Array<BoColumn<RecipeSubmission>> = [
    {
      key: 'recipe',
      header: 'Recipe',
      render: (x) => (
        <div className={s.recipeCell}>
          <DishPic name={x.recipe.name} drink={x.recipe.cat === 'Drinks'} size={40} />
          <div className={s.recipeCol}>
            <button
              className={s.recipeName}
              onClick={(e) => {
                e.stopPropagation();
                onOpen(x);
              }}
            >
              {x.recipe.name}
            </button>
            <span className={s.recipeCat}>
              {[categoryLabel(normCategory(x.recipe.cat)), x.recipe.sub].filter(Boolean).join(' · ')}
              {x.status === 'waiting' && previousApproved(subs, x) && (
                <Chip tone="outline" size="xs">
                  Re-submitted
                </Chip>
              )}
            </span>
          </div>
        </div>
      ),
    },
    { key: 'from', header: 'Sent by', render: (x) => <SentBy sub={x} at={at} /> },
    {
      key: 'note',
      header: tab === 'waiting' ? 'Their note' : 'Decision',
      render: (x) =>
        tab === 'waiting' ? (
          x.note ? (
            <span className={s.note}>“{x.note}”</span>
          ) : (
            <span className={s.muted}>No note</span>
          )
        ) : (
          <span className={s.decision}>
            <span className={s.decisionWho}>
              {x.decidedBy} · {x.decidedAt ? whenText(x.decidedAt, at) : ''}
            </span>
            {x.comment ? <span className={s.note}>“{x.comment}”</span> : <span className={s.muted}>No comment</span>}
          </span>
        ),
    },
    { key: 'go', header: '', width: 32, render: () => <ChevronRight size={18} aria-hidden className={s.chev} /> },
  ];

  return (
    <BoPage
      title="Recipe Approval"
      sub="Recipes the communities send to Home Office. Open one to review it, then approve it or deny it with what to change."
    >
      <Tabs
        variant="underline"
        aria-label="Recipe approval queue"
        value={tab}
        onChange={onTab}
        options={[
          { id: 'waiting', label: 'Waiting', count: n.waiting, countTone: n.waiting ? 'info' : undefined },
          { id: 'approved', label: 'Approved', count: n.approved },
          { id: 'denied', label: 'Denied', count: n.denied },
        ]}
      />
      <BoTable caption={`Recipes ${tab}`} columns={columns} rows={rows} rowKey={(x) => x.id} onRowClick={onOpen} empty={EMPTY[tab]} />
    </BoPage>
  );
}

function SentBy({ sub, at }: { sub: RecipeSubmission; at: number }) {
  return (
    <span className={s.sentBy}>
      <span className={s.community}>{sub.community}</span>
      <span className={s.muted}>
        {sub.sentBy} · {whenText(sub.sentAt, at)}
      </span>
    </span>
  );
}
