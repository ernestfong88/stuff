import { useState } from 'react';
import { CheckCircle2, Printer } from 'lucide-react';
import { formatTime } from '../../../../lib/format';
import { Button, cx } from '../../../../ui';
import { SideWorkNudge } from '../sidework/SideWorkNudge';
import { SignaturePad } from './SignaturePad';
import s from './SignOffCard.module.css';

/**
 * Sign off on the shift. Signing saves the review to the shift record so a
 * manager can pull it later; any table still open has to be closed first.
 * Open side work is a reminder, never a block.
 */
export function SignOffCard({
  who,
  whoName,
  openTables,
  signedAt,
  onSign,
  onExport,
}: {
  who: string;
  whoName: string;
  openTables: number;
  signedAt?: number;
  onSign: () => void;
  onExport: () => void;
}) {
  const [signing, setSigning] = useState(false);
  const signed = signedAt != null;
  return (
    <section className={cx(s.card, signed && s.signed)}>
      <h3 className={s.title}>{signed ? 'Shift signed off' : 'Sign off on this shift'}</h3>
      <p className={s.text}>
        {signed
          ? 'This review is saved to the shift record. A manager can pull it later with every charge, comp and card settlement listed above.'
          : 'Check the totals above. Signing off saves this review to the shift record so a manager can pull it later. Any table still open has to be closed first.'}
      </p>
      {signed ? (
        <div className={s.done}>
          <span className={s.by}>
            <CheckCircle2 size={17} aria-hidden /> Signed by {whoName} at {formatTime(signedAt)}
          </span>
          <Button icon={<Printer size={15} />} onClick={onExport}>
            Export a copy
          </Button>
        </div>
      ) : (
        <>
          <div className={s.buttons}>
            <Button variant="dark" size="lg" onClick={() => setSigning(true)} disabled={signing || openTables > 0}>
              Sign off and end shift
            </Button>
            <Button size="lg" icon={<Printer size={16} />} onClick={onExport}>
              Export a copy
            </Button>
          </div>
          {openTables > 0 && (
            <p className={s.open} role="status">
              {openTables} table{openTables === 1 ? ' is' : 's are'} still open. Close {openTables === 1 ? 'it' : 'them'} and sign off unlocks.
            </p>
          )}
          {signing && (
            <>
              <SideWorkNudge who={who} />
              <SignaturePad
                name={whoName}
                disabled={openTables > 0}
                onCancel={() => setSigning(false)}
                onSign={() => {
                  setSigning(false);
                  onSign();
                }}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}
