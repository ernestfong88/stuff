import { useState } from 'react';
import { BadgeCheck, CircleX } from 'lucide-react';
import type { RecipeSubmission } from '../../../../store/recipeApprovals';
import { Button, Modal, TextArea } from '../../../../ui';
import s from './recipeApproval.module.css';

/** Approve (comment optional) or deny (reason required); both are shown to the community on the recipe. */
export function DecisionDialog({
  sub,
  kind,
  onClose,
  onDecide,
}: {
  sub: RecipeSubmission;
  kind: 'approve' | 'deny';
  onClose: () => void;
  onDecide: (comment: string) => void;
}) {
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const deny = kind === 'deny';
  const missing = deny && !text.trim();
  const submit = () => {
    setTried(true);
    if (!missing) onDecide(text.trim());
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={deny ? 'Deny / request changes' : 'Approve recipe'}
      subtitle={`${sub.recipe.name} · ${sub.community}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={deny ? 'danger' : 'success'} icon={deny ? <CircleX size={15} /> : <BadgeCheck size={15} />} onClick={submit}>
            {deny ? 'Deny recipe' : 'Approve recipe'}
          </Button>
        </>
      }
    >
      <div className={s.dialog}>
        <p className={s.lead}>
          {deny
            ? `${sub.community} sees your reason on the recipe and can send it again once it is changed.`
            : `${sub.community} sees the approval, and your comment, on the recipe in their Recipe Book.`}
        </p>
        <TextArea
          label={deny ? 'Reason (required)' : 'Comment (optional)'}
          hint={deny ? 'Say what to change, so the next version can be approved.' : undefined}
          rows={4}
          maxLength={500}
          value={text}
          data-autofocus
          aria-invalid={tried && missing}
          placeholder={deny ? 'e.g. Sodium is 1,450 mg a serving; the cap for an entrée is 900 mg.' : 'e.g. Approved as written. Nice plating notes.'}
          onChange={(e) => setText(e.target.value)}
        />
        {tried && missing && (
          <p className={s.error} role="alert">
            Give a reason, so the team knows what to change.
          </p>
        )}
      </div>
    </Modal>
  );
}
