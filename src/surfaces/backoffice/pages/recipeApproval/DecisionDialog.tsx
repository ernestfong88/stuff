import { useState } from 'react';
import type { RecipeSubmission } from '../../../../store/recipeApprovals';
import { Button, Modal, TextArea } from '../../../../ui';
import { DECISIONS, type DecisionKind } from './decisions';
import s from './recipeApproval.module.css';

/**
 * Approve (comment optional), ask for changes or deny (a note to the sender
 * required); the community sees the decision and the note on the recipe.
 */
export function DecisionDialog({
  sub,
  kind,
  onClose,
  onDecide,
}: {
  sub: RecipeSubmission;
  kind: DecisionKind;
  onClose: () => void;
  onDecide: (comment: string) => void;
}) {
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const d = DECISIONS[kind];
  const Icon = d.icon;
  const missing = d.noteRequired && !text.trim();
  const submit = () => {
    setTried(true);
    if (!missing) onDecide(text.trim());
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={d.title}
      subtitle={`${sub.recipe.name} · ${sub.community}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={d.confirmVariant} icon={<Icon size={15} />} onClick={submit}>
            {d.confirm}
          </Button>
        </>
      }
    >
      <div className={s.dialog}>
        <p className={s.lead}>{d.lead(sub.community)}</p>
        <TextArea
          label={d.noteRequired ? `Note to ${sub.sentBy} (required)` : 'Comment (optional)'}
          hint={d.hint}
          rows={4}
          maxLength={500}
          value={text}
          data-autofocus
          aria-invalid={tried && missing}
          placeholder={d.placeholder}
          onChange={(e) => setText(e.target.value)}
        />
        {tried && missing && (
          <p className={s.error} role="alert">
            {d.missing}
          </p>
        )}
      </div>
    </Modal>
  );
}
