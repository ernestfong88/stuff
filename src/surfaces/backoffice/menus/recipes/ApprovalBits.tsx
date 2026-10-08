/**
 * Recipe Approval in the Recipe Book: the status chip, the "Send to Home
 * Office" dialog, and the note on the recipe page saying where it stands.
 */
import { useState } from 'react';
import { BadgeCheck, CircleAlert, Clock, PencilLine, Send, Undo2 } from 'lucide-react';
import { now } from '../../../../lib/clock';
import type { Recipe } from '../../../../store/menuEdits';
import { Button, Chip, Modal, TextArea, toast } from '../../../../ui';
import { BoCallout } from '../../kit';
import { RECIPE_BOOK_COMMUNITY, restoreSubmission, sendRecipe, useSubmissions, withdrawSubmission } from '../approvals';
import { approvalStatus, whenText, type RecipeApprovalInfo, type RecipeApprovalStep } from '../model/recipeApproval';
import s from './ApprovalBits.module.css';

/** Only the community's own recipes go to Home Office; linked and Global Library ones are Home Office's. */
export const canSubmit = (r: Recipe) => !r.scope || r.scope === 'mine';

/** Where this community's recipe stands with Home Office. */
export function useApproval(r: Recipe): RecipeApprovalInfo {
  return approvalStatus(useSubmissions(), RECIPE_BOOK_COMMUNITY, r);
}

const ICONS: Record<Exclude<RecipeApprovalStep, 'none'>, typeof Clock> = {
  waiting: Clock,
  approved: BadgeCheck,
  edited: PencilLine,
  denied: CircleAlert,
};

/** "Pending approval", "Approved", "Edited since approval" or "Denied"; nothing for a recipe never sent. */
export function ApprovalChip({ info, size = 'sm' }: { info: RecipeApprovalInfo; size?: 'xs' | 'sm' }) {
  if (info.step === 'none') return null;
  const Icon = ICONS[info.step];
  return (
    <Chip tone={info.tone} size={size} icon={<Icon size={11} aria-hidden />} title={info.sub?.comment}>
      {info.label}
    </Chip>
  );
}

/** Take a recipe back from Home Office, with Undo. */
export function withdrawWithUndo(info: RecipeApprovalInfo) {
  const sub = info.sub;
  if (!sub || sub.status !== 'waiting') return;
  withdrawSubmission(sub.id);
  toast('Withdrawn. Home Office no longer sees it.', { action: { label: 'Undo', onClick: () => restoreSubmission(sub) } });
}

/** "What changed / why", then send. */
export function SendForApprovalDialog({ r, info, onClose }: { r: Recipe; info: RecipeApprovalInfo; onClose: () => void }) {
  const [note, setNote] = useState('');
  const again = info.step === 'edited' || info.step === 'denied';
  const send = () => {
    sendRecipe(r, note);
    toast(`${r.name} sent to Home Office. It shows as Pending approval until they decide.`, { tone: 'success' });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Send to Home Office for approval"
      subtitle={r.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Send size={14} />} onClick={send} data-autofocus>
            {again ? 'Send again' : 'Send for approval'}
          </Button>
        </>
      }
    >
      <div className={s.dialog}>
        <p className={s.lead}>
          Home Office reviews the recipe as it is now and approves it or asks for changes. You can keep using it meanwhile, and withdraw it until they
          decide.
        </p>
        {info.step === 'denied' && info.sub?.comment && (
          <BoCallout tone="danger" title="Home Office asked for">
            {info.sub.comment}
          </BoCallout>
        )}
        <TextArea
          label="What changed / why (optional)"
          hint="Home Office reads this first."
          rows={3}
          value={note}
          maxLength={400}
          placeholder={again ? 'e.g. Cut the sodium to 780 mg with low-sodium stock' : 'e.g. New fall soup; residents loved it at the tasting'}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </Modal>
  );
}

/** On the recipe page: who sent it and when, and Home Office's decision with their comment. */
export function ApprovalBanner({ r, info }: { r: Recipe; info: RecipeApprovalInfo }) {
  const [sending, setSending] = useState(false);
  const sub = info.sub;
  if (!sub) return null;
  const at = now();
  const sent = `Sent by ${sub.sentBy} ${whenText(sub.sentAt, at)}`;
  const decided = sub.decidedAt ? `${sub.decidedBy ?? 'Home Office'}, ${whenText(sub.decidedAt, at)}` : '';
  const sendBtn = (
    <Button size="sm" variant="primary" icon={<Send size={13} />} onClick={() => setSending(true)}>
      Send again
    </Button>
  );
  return (
    <>
      {info.step === 'waiting' && (
        <BoCallout tone="info" title="Pending approval at Home Office">
          <div className={s.banner}>
            <span>
              {sent}.{sub.note && <> Your note: “{sub.note}”</>}
              {info.editedSinceSent && (
                <> You changed it since: Home Office reviews the copy you sent. Withdraw and send again to include the changes.</>
              )}
            </span>
            <Button size="sm" icon={<Undo2 size={13} />} onClick={() => withdrawWithUndo(info)}>
              Withdraw
            </Button>
          </div>
        </BoCallout>
      )}
      {info.step === 'approved' && (
        <BoCallout tone="success" title={`Approved by ${decided}`}>
          {sub.comment ? <span>“{sub.comment}”</span> : <span>{sent}.</span>}
        </BoCallout>
      )}
      {info.step === 'edited' && (
        <BoCallout tone="warning" title="Edited since approval">
          <div className={s.banner}>
            <span>Approved by {decided}, then changed here. Send it again so Home Office can approve the new version.</span>
            {sendBtn}
          </div>
        </BoCallout>
      )}
      {info.step === 'denied' && (
        <BoCallout tone="danger" title={`Denied by ${decided}`}>
          <div className={s.banner}>
            <span>“{sub.comment}” Make the changes, then send it again.</span>
            {sendBtn}
          </div>
        </BoCallout>
      )}
      {sending && <SendForApprovalDialog r={r} info={info} onClose={() => setSending(false)} />}
    </>
  );
}
