import { navigate, useRoute } from '../../../../shell/router';
import { useResidentRecords } from '../../kit';
import type { BoPageProps } from '../../nav';
import { ResidentDetail } from './ResidentDetail';
import { ResidentList } from './ResidentList';

/**
 * Dining Plans & Notes: each resident's meal plan, dining preferences and
 * kitchen notes. A resident opens at #/backoffice/residents/<id>, so the
 * browser's back button returns to the list.
 */
export default function DiningPlansPage({ goto }: BoPageProps) {
  const route = useRoute();
  const records = useResidentRecords();
  const selected = records.find((r) => r.id === route.path[1]);
  const open = (id: string | null) => navigate('backoffice', id ? ['residents', id] : ['residents']);
  return selected ? <ResidentDetail resident={selected} onBack={() => open(null)} goto={goto} /> : <ResidentList onOpen={open} />;
}
