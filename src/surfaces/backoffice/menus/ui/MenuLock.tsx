/**
 * Lock in the menu builders. A locked menu opens read-only with a banner
 * saying so, and a button to unlock it.
 */
import { Lock, LockOpen } from 'lucide-react';
import type { BoMenu } from '../../../../store/menuEdits';
import { Button, toast, useConfirm } from '../../../../ui';
import { updateMenu } from '../menuActions';
import s from './MenuLock.module.css';

export function LockBanner({ menu }: { menu: BoMenu }) {
  const [ask, dialog] = useConfirm();
  const unlock = async () => {
    const ok = await ask({
      title: `Unlock ${menu.name}?`,
      message: 'Anyone with access to the menu builder can then change it.',
      confirmLabel: 'Unlock',
    });
    if (!ok) return;
    updateMenu(menu.id, { locked: false });
    toast(`${menu.name} unlocked`);
  };
  return (
    <div className={s.banner} role="note">
      <Lock size={18} className={s.icon} aria-hidden />
      <div className={s.text}>
        <b>This menu is locked.</b> You can look, print and open recipes, but nothing can be added, moved or removed.
      </div>
      <Button size="sm" icon={<LockOpen size={14} />} onClick={unlock}>
        Unlock to make changes
      </Button>
      {dialog}
    </div>
  );
}

export function LockButton({ menu }: { menu: BoMenu }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      icon={<Lock size={14} />}
      onClick={() => {
        updateMenu(menu.id, { locked: true });
        toast(`${menu.name} locked. Nobody can change it until it's unlocked.`);
      }}
    >
      Lock
    </Button>
  );
}
