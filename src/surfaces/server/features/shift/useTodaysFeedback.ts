import { useMemo } from 'react';
import { getResident } from '../../../../data';
import { startOfToday } from '../../../../lib/clock';
import { useDiningHistory, useDiningOrders } from '../../../../store/dining';
import { useNotes } from '../../../../store/notes';
import { feedbackItems, type FeedbackItem } from '../shared/feedback';

/** Today's dining feedback from every server, each comment tied to a dish where one fits. */
export function useTodaysFeedback(): FeedbackItem[] {
  const notes = useNotes();
  const orders = useDiningOrders();
  const history = useDiningHistory();
  return useMemo(() => feedbackItems(notes, startOfToday(), [...orders, ...history], (rid) => getResident(rid)?.name ?? ''), [notes, orders, history]);
}
