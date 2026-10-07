import { RotateCcw } from 'lucide-react';
import { resetSettingsSection } from '../../../store/serviceConfig';
import { Button, toast, useConfirm } from '../../../ui';

/**
 * "Reset to defaults" for a settings page, with an "Are you sure?" first.
 * The kit's ResetButton resets on the first click, which is easy to hit by
 * accident on a page full of settings.
 */
export function ConfirmReset({
  title,
  message,
  done,
  sections = [],
  onReset,
  label = 'Reset to defaults',
}: {
  /** The question, e.g. "Put every alert back to the default?". */
  title: string;
  /** What will change, in a sentence. */
  message: string;
  /** Toast once it is done. */
  done: string;
  sections?: string[];
  onReset?: () => void;
  label?: string;
}) {
  const [ask, dialog] = useConfirm();
  return (
    <>
      <Button
        icon={<RotateCcw size={14} />}
        onClick={async () => {
          if (!(await ask({ title, message, confirmLabel: label, tone: 'danger' }))) return;
          sections.forEach(resetSettingsSection);
          onReset?.();
          toast(done, { tone: 'success' });
        }}
      >
        {label}
      </Button>
      {dialog}
    </>
  );
}
