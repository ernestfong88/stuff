import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { now } from '../../../../lib/clock';
import type { RecipeSubmission } from '../../../../store/recipeApprovals';
import { Chip, Tabs, cx } from '../../../../ui';
import { BoPage, BoTable, type BoColumn } from '../../kit';
import { categoryLabel, normCategory } from '../../menus/model/categories';
import { previousApproved, queueCounts, queueOf, whenText, type QueueTab } from '../../menus/model/recipeApproval';
import { DishPic } from '../../menus/ui/DishPic';
import s from './recipeApproval.module.css';

const EMPTY: Record<QueueTab, string> = {
  waiting: 'Nothing waiting. Recipes the communities send for approval show here.',
  approved: 'No recipes approved yet.',
  changes: 'No recipes waiting on changes.',
  denied: 'No recipes denied.',
};

const SUB = 'Recipes the communities send to Home Office. Open one to read all of it, then approve it, ask for changes, or deny it.';

/** Waiting, Changes requested, Approved and Denied, with counts. */
function QueueTabs({ subs, tab, onTab }: { subs: RecipeSubmission[]; tab: QueueTab; onTab: (t: QueueTab) => void }) {
  const n = queueCounts(subs);
  return (
    <Tabs
      variant="underline"
      aria-label="Recipe approval queue"
      value={tab}
      onChange={onTab}
      options={[
        { id: 'waiting', label: 'Waiting', count: n.waiting, countTone: n.waiting ? 'info' : undefined },
        { id: 'changes', label: 'Changes requested', count: n.changes },
        { id: 'approved', label: 'Approved', count: n.approved },
        { id: 'denied', label: 'Denied', count: n.denied },
      ]}
    />
  );
}

/** The queue on a narrow screen: one row per recipe sent; opening one shows it full page. */
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
    <BoPage title="Recipe Approval" sub={SUB}>
      <QueueTabs subs={subs} tab={tab} onTab={onTab} />
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

/**
 * A wide screen (1200px and up): the queue on the left stays in view and the
 * open recipe reads beside it, so a reviewer can go down the list without
 * leaving it.
 */
export function ApprovalSplit({
  subs,
  tab,
  onTab,
  openId,
  onOpen,
  children,
}: {
  subs: RecipeSubmission[];
  tab: QueueTab;
  onTab: (t: QueueTab) => void;
  openId: string | undefined;
  onOpen: (sub: RecipeSubmission) => void;
  children: ReactNode;
}) {
  const rows = queueOf(subs, tab);
  const at = now();
  return (
    <BoPage title="Recipe Approval" sub={SUB} wide>
      <QueueTabs subs={subs} tab={tab} onTab={onTab} />
      <div className={s.split}>
        <nav className={s.master} aria-label={`Recipes ${tab}`}>
          {rows.length ? (
            <ul className={s.queueList}>
              {rows.map((x) => (
                <li key={x.id}>
                  <button
                    className={cx(s.queueItem, x.id === openId && s.queueItemOn)}
                    aria-current={x.id === openId || undefined}
                    onClick={() => onOpen(x)}
                  >
                    <DishPic name={x.recipe.name} drink={x.recipe.cat === 'Drinks'} size={44} />
                    <span className={s.recipeCol}>
                      <span className={s.queueName}>{x.recipe.name}</span>
                      <span className={s.recipeCat}>
                        {[categoryLabel(normCategory(x.recipe.cat)), x.recipe.sub].filter(Boolean).join(' · ')}
                        {x.status === 'waiting' && previousApproved(subs, x) && (
                          <Chip tone="outline" size="xs">
                            Re-submitted
                          </Chip>
                        )}
                      </span>
                      <span className={s.queueFrom}>
                        <strong>{x.community}</strong> · {x.sentBy} · {whenText(x.sentAt, at)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.queueEmpty}>{EMPTY[tab]}</p>
          )}
        </nav>
        <div className={s.detail}>{children}</div>
      </div>
    </BoPage>
  );
}
