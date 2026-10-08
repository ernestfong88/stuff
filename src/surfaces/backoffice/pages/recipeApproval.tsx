/**
 * Recipe Approval (HO Settings): recipes the communities send to Home
 * Office. Open one to read it, see what changed since the version approved
 * before, and approve it or deny it with what to change. The community
 * sees the decision and the comment on the recipe in its Recipe Book.
 */
import { useState } from 'react';
import { navigate, useRoute } from '../../../shell/router';
import { useSubmissions } from '../menus/approvals';
import type { QueueTab } from '../menus/model/recipeApproval';
import type { BoPageProps } from '../nav';
import { ApprovalQueue } from './recipeApproval/ApprovalQueue';
import { ReviewRecipe } from './recipeApproval/ReviewRecipe';

export default function Page(_props: BoPageProps) {
  const subs = useSubmissions();
  const { path } = useRoute();
  const [tab, setTab] = useState<QueueTab>('waiting');
  const open = subs.find((x) => x.id === path[1]);
  const back = () => navigate('backoffice', ['recipeApproval']);
  if (open) return <ReviewRecipe sub={open} subs={subs} onBack={back} />;
  return <ApprovalQueue subs={subs} tab={tab} onTab={setTab} onOpen={(sub) => navigate('backoffice', ['recipeApproval', sub.id])} />;
}
