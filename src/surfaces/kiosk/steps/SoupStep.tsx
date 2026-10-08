import { Soup } from 'lucide-react';
import { dishLongName, type KioskMenu } from '../../../domain/kioskMenu';
import { KButton } from '../ui/KButton';
import { Question, TileGrid } from '../ui/Layout';
import type { KioskFlow } from '../useKioskFlow';
import s from './SoupStep.module.css';

export function SoupStep({ flow, menu }: { flow: KioskFlow; menu: KioskMenu }) {
  const current = flow.s.edit ? flow.s.soup : null;
  return (
    <div>
      <Question title="Would you like soup?" />
      <TileGrid min={340} gap={18}>
        {menu.soups.map((it) => (
          <KButton key={it.id} column look={current === it.id ? 'selected' : 'secondary'} className={s.soup} onClick={() => flow.advance({ soup: it.id })}>
            <Soup className={s.icon} strokeWidth={1.8} aria-hidden />
            <span className={s.kind}>{it.special ? 'Soup of the Day' : 'Soup of the Week'}</span>
            <span className={s.name}>{dishLongName(it.name)}</span>
          </KButton>
        ))}
        <KButton className={s.soup} onClick={() => flow.advance({ soup: null })}>
          No soup, thanks
        </KButton>
      </TileGrid>
    </div>
  );
}
