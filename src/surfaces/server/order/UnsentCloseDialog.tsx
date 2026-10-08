import { Button, Modal } from '../../../ui';
import type { CloseCheck } from './checkLines';

export type UnsentChoice = 'send' | 'remove' | 'close';

const items = (n: number) => (n === 1 ? '1 item was' : `${n} items were`);
const plates = (n: number) => (n === 1 ? '1 plate is' : `${n} plates are`);

/**
 * Asked before Close & charge when the check still has work out: items that
 * were never sent ("send them, remove them, or close anyway"), or plates the
 * kitchen is still making, which closing takes off the kitchen screens.
 */
export function UnsentCloseDialog({ check, onChoose, onCancel }: { check: CloseCheck; onChoose: (c: UnsentChoice) => void; onCancel: () => void }) {
  const unsent = check.unsentItems > 0;
  return (
    <Modal
      open
      onClose={onCancel}
      width={480}
      title={unsent ? `${items(check.unsentItems)} never sent` : `${plates(check.inKitchen)} still in the kitchen`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onChoose('close')}>
            Close anyway
          </Button>
          {unsent && (
            <Button variant="softDanger" onClick={() => onChoose('remove')}>
              Remove them
            </Button>
          )}
          {unsent ? (
            <Button variant="primary" onClick={() => onChoose('send')} data-autofocus>
              Send them
            </Button>
          ) : (
            <Button variant="primary" onClick={onCancel} data-autofocus>
              Keep it open
            </Button>
          )}
        </>
      }
    >
      <div style={{ color: 'var(--s500)', fontSize: 14, lineHeight: 1.5 }}>
        {unsent
          ? 'The kitchen never got them. Send them now and keep the check open, take them off the check, or close anyway.'
          : 'Closing the check takes them off the kitchen screens before they reach the table.'}
        {unsent && check.inKitchen > 0 && ` ${plates(check.inKitchen)} also still in the kitchen.`}
      </div>
    </Modal>
  );
}
