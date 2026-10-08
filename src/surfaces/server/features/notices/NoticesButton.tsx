import { useState } from 'react';
import { Megaphone } from 'lucide-react';
import { unseenNotices, useNotices } from '../../../../store/notices';
import { useNow } from '../../../../ui';
import { RailButton } from '../shared/RailButton';
import { useMyInitials } from '../shared/useShiftServers';
import { NoticesSheet } from './NoticesSheet';

/**
 * Rail button with the unread notices count; opens notices to acknowledge.
 * Servers no longer get a banner: the button rings while something is
 * waiting and goes quiet once everything has been seen. What they
 * acknowledged stays under Past notices inside the sheet.
 */
export function NoticesButton() {
  const me = useMyInitials();
  const state = useNotices();
  useNow(60_000);
  const [open, setOpen] = useState(false);
  const unseen = unseenNotices(state, me).length;
  return (
    <>
      <RailButton
        icon={<Megaphone size={24} strokeWidth={2} aria-hidden />}
        label="Notices"
        tone={unseen ? 'amber' : 'quiet'}
        pulse={unseen > 0}
        badge={unseen}
        onClick={() => setOpen(true)}
        title={unseen ? `${unseen} new notice${unseen === 1 ? '' : 's'} from the office` : 'Notices from the office'}
        ariaLabel={unseen ? `Notices, ${unseen} new` : 'Notices'}
      />
      {open && <NoticesSheet who={me} open onClose={() => setOpen(false)} initialTab={unseen ? 'new' : 'past'} />}
    </>
  );
}
