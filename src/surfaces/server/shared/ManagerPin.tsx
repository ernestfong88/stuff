import { useEffect, useState, type ReactNode } from 'react';
import { Delete } from 'lucide-react';
import { Button, cx, Modal } from '../../../ui';
import s from './ManagerPin.module.css';

/**
 * The demo manager PIN. The staff roster has no manager entry yet, so the
 * prototype's fixed PIN stands in until sign-in carries manager rights.
 */
export const MANAGER_PIN = '9999';

/**
 * Four-digit keypad; calls onOk once the manager PIN (or a PIN `accept`
 * takes) is entered. Digits can be typed too.
 */
export function PinPad({ onOk, accept = (pin) => pin === MANAGER_PIN }: { onOk: (pin: string) => void; accept?: (pin: string) => boolean }) {
  const [value, setValue] = useState('');
  const [bad, setBad] = useState(false);
  const press = (k: string) => {
    if (k === 'del') return setValue((x) => x.slice(0, -1));
    if (k === 'clr') return setValue('');
    const next = (value + k).slice(0, 4);
    setBad(false);
    setValue(next);
    if (next.length === 4) {
      if (accept(next)) onOk(next);
      else {
        setBad(true);
        setTimeout(() => setValue(''), 250);
      }
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div>
      <div className={s.dots} aria-label={`${value.length} of 4 digits entered`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cx(s.dot, i < value.length && s.dotOn)} />
        ))}
      </div>
      <div className={s.bad} role="alert">
        {bad ? "That PIN didn't match. Try again." : ''}
      </div>
      <div className={s.keys}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clr', '0', 'del'].map((k) => (
          <button
            key={k}
            className={cx(s.key, k.length > 1 && s.keyWord)}
            onClick={() => press(k)}
            aria-label={k === 'del' ? 'Delete' : k === 'clr' ? 'Clear' : k}
          >
            {k === 'del' ? <Delete size={20} aria-hidden /> : k === 'clr' ? 'Clear' : k}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Manager PIN in a dialog. */
export function ManagerPinDialog({
  title,
  sub,
  onOk,
  onClose,
}: {
  title: ReactNode;
  sub?: ReactNode;
  onOk: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open onClose={onClose} width={380} title={title} subtitle={sub}>
      <PinPad onOk={onOk} />
      <Button variant="ghost" block onClick={onClose} className={s.cancel}>
        Cancel
      </Button>
    </Modal>
  );
}

/** Comp reasons; some can be free (no PIN), e.g. hospice on a hospice delivery. */
export const COMP_REASONS = ['Sick', 'Hospice', 'Manager choice'] as const;

/** Pick a comp reason, then a manager enters their PIN (free reasons comp right away). */
export function CompDialog({
  title,
  free,
  onApprove,
  onClose,
}: {
  title: string;
  free?: string[] | null;
  onApprove: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const others = COMP_REASONS.filter((r) => !free?.includes(r));
  return (
    <Modal
      open
      onClose={onClose}
      width={380}
      title={title}
      subtitle={
        free?.length
          ? `${free.join(' or ')} comps right away. ${others.join(' or ')} needs a manager PIN.`
          : 'Pick the reason, then a manager enters their PIN.'
      }
    >
      <div className={s.reasons} role="group" aria-label="Reason">
        {COMP_REASONS.map((r) => (
          <button
            key={r}
            className={cx(s.reason, reason === r && s.reasonOn)}
            aria-pressed={reason === r}
            onClick={() => (free?.includes(r) ? onApprove(r) : setReason(r))}
          >
            {r}
          </button>
        ))}
      </div>
      {reason ? <PinPad key={reason} onOk={() => onApprove(reason)} /> : <p className={s.first}>Reason first</p>}
      <Button variant="ghost" block onClick={onClose} className={s.cancel}>
        Cancel
      </Button>
    </Modal>
  );
}
