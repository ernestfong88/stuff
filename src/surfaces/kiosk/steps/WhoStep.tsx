import { residents } from '../../../data';
import { Avatar } from '../../../ui';
import { findResidents } from '../model/residents';
import { KButton } from '../ui/KButton';
import { Actions, Question, TileGrid } from '../ui/Layout';
import { useKioskUnit } from '../ui/unit';
import type { KioskFlow } from '../useKioskFlow';
import s from './WhoStep.module.css';

/**
 * "Is this you?" with their picture, or "Who are you?" when an apartment has
 * two residents. "Not me" goes back to the pad with it cleared.
 */
export function WhoStep({ flow }: { flow: KioskFlow }) {
  const k = useKioskUnit();
  const { by, typed } = flow.s;
  const found = findResidents(residents, by, typed);
  const where = by === 'apt' ? `Apartment ${found[0]?.apt ?? typed}` : `Phone ending in ${typed}`;
  const notMe = () => {
    flow.back();
    flow.put({ typed: '', miss: false });
  };
  return (
    <div>
      <Question title={found.length > 1 ? 'Who are you?' : 'Is this you?'} sub={found.length > 1 ? `${where} · tap your picture` : where} />
      <TileGrid min={280} gap={24}>
        {found.map((r) => (
          <KButton key={r.id} column className={s.person} onClick={() => flow.advance({ resident: r })}>
            <Avatar person={r} size={Math.round(160 * k)} />
            <span className={s.first}>{r.name.split(' ')[0]}</span>
            <span className={s.full}>{r.name}</span>
          </KButton>
        ))}
      </TileGrid>
      <Actions className={s.answers}>
        {found.length === 1 && (
          <KButton look="primary" className={s.yes} onClick={() => flow.advance({ resident: found[0] })}>
            Yes, that&rsquo;s me
          </KButton>
        )}
        <KButton onClick={notMe}>
          {found.length === 1 ? 'No, that’s not me' : 'None of these is me'}
        </KButton>
      </Actions>
    </div>
  );
}
