/**
 * Recipe Approval (HO Settings): recipes the communities send to Home
 * Office. Open one to read all of it (the Recipe Book's own sections,
 * read-only), see what changed since the version approved before, and
 * approve it, ask for changes, or deny it; asking for changes and denying
 * need a note to the sender. The community sees the decision and the note on
 * the recipe in its Recipe Book.
 *
 * 1200px and up: the queue on the left and the recipe beside it. Narrower:
 * the queue, and the recipe full page.
 */
import { useState } from 'react';
import { navigate, useRoute } from '../../../shell/router';
import type { RecipeSubmission } from '../../../store/recipeApprovals';
import { useViewportWidth } from '../../../ui';
import { getSubmissions, useSubmissions } from '../menus/approvals';
import { queueOf, type QueueTab } from '../menus/model/recipeApproval';
import type { BoPageProps } from '../nav';
import { ApprovalQueue, ApprovalSplit } from './recipeApproval/ApprovalQueue';
import { ReviewRecipe } from './recipeApproval/ReviewRecipe';
import s from './recipeApproval/recipeApproval.module.css';

const SPLIT_FROM = 1200;

export default function Page(_props: BoPageProps) {
  const subs = useSubmissions();
  const { path } = useRoute();
  const open = subs.find((x) => x.id === path[1]);
  // Opened from an address: start on that recipe's tab.
  const [tab, setTab] = useState<QueueTab>(() => open?.status ?? 'waiting');
  const split = useViewportWidth() >= SPLIT_FROM;
  const back = () => navigate('backoffice', ['recipeApproval']);
  const openSub = (sub: RecipeSubmission) => navigate('backoffice', ['recipeApproval', sub.id], { replace: !!open });
  const onTab = (t: QueueTab) => {
    setTab(t);
    if (open) back();
  };

  if (!split) {
    if (open) return <ReviewRecipe sub={open} subs={subs} onBack={back} onDecided={back} />;
    return <ApprovalQueue subs={subs} tab={tab} onTab={onTab} onOpen={openSub} />;
  }

  // Beside the queue, the first recipe in the tab shows until another is picked.
  const shown = open ?? queueOf(subs, tab)[0];
  // After a decision, the next recipe waiting (oldest first) opens, so the reviewer can carry on.
  const next = () => {
    const after = queueOf(getSubmissions(), tab).find((x) => x.id !== shown?.id);
    if (after) navigate('backoffice', ['recipeApproval', after.id], { replace: true });
    else back();
  };
  return (
    <ApprovalSplit subs={subs} tab={tab} onTab={onTab} openId={shown?.id} onOpen={openSub}>
      {shown ? (
        <ReviewRecipe key={shown.id} sub={shown} subs={subs} pane onBack={open ? back : undefined} onDecided={next} />
      ) : (
        <p className={s.paneEmpty}>Pick a recipe on the left to read it here.</p>
      )}
    </ApprovalSplit>
  );
}
