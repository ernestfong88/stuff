import { residents } from '../../../data';
import { Avatar } from '../../../ui';
import { findResidents } from '../model/residents';
import { KButton } from '../ui/KButton';
import { Question, TileGrid } from '../ui/Layout';
import { useKioskUnit } from '../ui/unit';
import type { KioskFlow } from '../useKioskFlow';
import s from './WhoStep.module.css';

/** "Is this you?" with their picture, or "Who are you?" when an apartment has two residents. */
export function WhoStep({ flow }: { flow: KioskFlow }) {
  const k = useKioskUnit();
  const { by, typed } = flow.s;
  const found = findResidents(residents, by, typed);
  const where = by === 'apt' ? `Apartment ${found[0]?.apt ?? typed}` : `Phone ending in ${typed}`;
  return (
    <div>
      <Question title={found.length > 1 ? 'Who are you?' : 'Is this you?'} sub={`${where} · tap your picture`} />
      <TileGrid min={280} gap={24}>
        {found.map((r) => (
          <KButton key={r.id} column className={s.person} onClick={() => flow.advance({ resident: r })}>
            <Avatar person={r} size={Math.round(160 * k)} />
            <span className={s.first}>{r.name.split(' ')[0]}</span>
            <span className={s.full}>{r.name}</span>
          </KButton>
        ))}
      </TileGrid>
      {found.length === 1 && (
        <KButton look="primary" block className={s.yes} onClick={() => flow.advance({ resident: found[0] })}>
          Yes, that&rsquo;s me
        </KButton>
      )}
    </div>
  );
}
