import { useState, type ReactNode } from 'react';
import { Button, type ButtonVariant } from './Button';
import { Modal } from './Overlay';

export interface ConfirmProps {
  open: boolean;
  title: ReactNode;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ButtonVariant;
  onConfirm: () => void;
  onCancel: () => void;
}

/** "Are you sure?" dialog for destructive or hard-to-undo actions. */
export function Confirm({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'primary', onConfirm, onCancel }: ConfirmProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width={440}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={onConfirm} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message && <div style={{ color: 'var(--s500)', fontSize: 14, lineHeight: 1.5 }}>{message}</div>}
    </Modal>
  );
}

/** Hook form: const [ask, dialog] = useConfirm(); ask({...}).then(ok => ...) */
export function useConfirm(): [(opts: Omit<ConfirmProps, 'open' | 'onConfirm' | 'onCancel'>) => Promise<boolean>, ReactNode] {
  const [state, setState] = useState<(Omit<ConfirmProps, 'open' | 'onConfirm' | 'onCancel'> & { resolve: (v: boolean) => void }) | null>(null);
  const ask = (opts: Omit<ConfirmProps, 'open' | 'onConfirm' | 'onCancel'>) =>
    new Promise<boolean>((resolve) => setState({ ...opts, resolve }));
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  const dialog = state ? <Confirm open {...state} onConfirm={() => close(true)} onCancel={() => close(false)} /> : null;
  return [ask, dialog];
}
