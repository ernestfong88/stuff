/**
 * Lock and approval in the menu builders. A locked menu opens read-only
 * with a banner saying so; unlocking an approved menu warns that changes
 * need approving again.
 */
import { Check, Clock, Lock, LockOpen, Send } from 'lucide-react';
import type { BoMenu } from '../../../../store/menuEdits';
import { Button, cx, toast, useConfirm } from '../../../../ui';
import { updateMenu } from '../menuActions';
import { approvalOf, REQUEST_APPROVAL } from '../model/approval';
import s from './MenuLock.module.css';

export function LockBanner({ menu }: { menu: BoMenu }) {
  const [ask, dialog] = useConfirm();
  const ap = approvalOf(menu);
  const unlock = async () => {
    const ok = await ask({
      title: `Unlock ${menu.name}?`,
      message:
        ap.step === 'approved'
          ? 'The dietitian approved this version. If you change it, send it for approval again.'
          : 'Anyone with access to the menu builder can then change it.',
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

/** "Approved · Dana Whitfield, RD · Sep 30", "Waiting for the dietitian", or a button to send it. */
export function ApprovalStatus({ menu }: { menu: BoMenu }) {
  const ap = approvalOf(menu);
  if (ap.step === 'none')
    return (
      <button
        className={s.send}
        onClick={() => {
          updateMenu(menu.id, REQUEST_APPROVAL);
          toast(`${menu.name} sent to the dietitian to approve`, {
            tone: 'success',
          });
        }}
      >
        <Send size={13} aria-hidden /> Send for approval
      </button>
    );
  return (
    <span className={cx(s.status, ap.step === 'approved' ? s.approved : s.waiting)}>
      {ap.step === 'approved' ? <Check size={13} strokeWidth={3} aria-hidden /> : <Clock size={13} aria-hidden />}
      {ap.label}
      {ap.detail && <span className={s.detail}>· {ap.detail}</span>}
    </span>
  );
}
