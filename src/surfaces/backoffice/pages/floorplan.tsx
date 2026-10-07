import type { BoPageProps } from '../nav';
import { BoPage } from '../kit';
import { FloorPlanEditor } from '../../manager/floor/FloorPlanEditor';

/** Floor Plans: arrange the tables in each room. The host and manager floors use the saved layout. */
export default function Page(_props: BoPageProps) {
  return (
    <BoPage title="Floor Plans" sub="Arrange the tables in each room. The host floor, the manager floor and reservations use the saved layout.">
      <FloorPlanEditor />
    </BoPage>
  );
}
