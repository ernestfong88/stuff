import type { BoPageProps } from '../nav';
import { BoPage } from '../kit';
import { SideWorkAssign } from '../../server/features/sidework/SideWorkAssign';

/** Assign Side Work: Today's side work for everyone on shift. */
export default function Page(_props: BoPageProps) {
  return (
    <BoPage
      title="Assign Side Work"
    >
      <SideWorkAssign />
    </BoPage>
  );
}
