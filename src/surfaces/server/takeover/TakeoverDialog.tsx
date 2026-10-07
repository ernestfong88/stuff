import { useDining } from '../../../store/dining';
import { Button, Modal } from '../../../ui';
import s from './TakeoverDialog.module.css';

/**
 * Asks before a server changes another server's check. The change waits in
 * the store until they confirm; the check then becomes theirs.
 */
export function TakeoverDialog() {
  const { pendingTakeover, confirmTakeover, cancelTakeover } = useDining();
  if (!pendingTakeover) return null;
  const from = pendingTakeover.from;
  return (
    <Modal
      open
      onClose={cancelTakeover}
      width={420}
      hideClose
      title={`You're taking over this check from ${from}`}
      footer={
        <>
          <Button size="lg" className={s.grow} onClick={cancelTakeover}>
            Cancel
          </Button>
          <Button size="lg" variant="primary" className={s.grow} onClick={confirmTakeover} data-autofocus>
            Take over
          </Button>
        </>
      }
    >
      <p className={s.body}>
        It becomes your table and counts in your shift numbers. {from} will no longer see it.
      </p>
    </Modal>
  );
}
