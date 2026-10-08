import { useEffect, useMemo, useState } from 'react';
import { CircleHelp, Sparkles } from 'lucide-react';
import { getResident, getStaff } from '../../../../data';
import { isEmptyCheck } from '../../../../domain/seating';
import { serverName } from '../../../../domain/servers';
import { startOfToday, today } from '../../../../lib/clock';
import { formatDayLong } from '../../../../lib/format';
import { useShared } from '../../../../lib/sharedStore';
import { useConfig } from '../../../../store/config';
import { useDining } from '../../../../store/dining';
import { useNotes } from '../../../../store/notes';
import { useTriviaOn } from '../../../../store/trivia';
import { sideWorkDate } from '../../../../store/sideWork';
import { Chip, Tabs, toast, useNow } from '../../../../ui';
import { mealAt } from '../menu/menuSections';
import { printHtml } from '../shared/print';
import { useMyInitials } from '../shared/useShiftServers';
import { TriviaScoreboard } from '../trivia/TriviaScoreboard';
import { ChecksTab } from './ChecksTab';
import { checkInCount, closedThisShift, shiftTotals } from './closedChecks';
import { shiftReviewHtml } from './exportShift';
import { FeedbackTab } from './FeedbackTab';
import { PeopleNotesTab } from './PeopleNotesTab';
import { requestedTab, signOff, useSignedOffAt, type ShiftTab } from './shiftState';
import { SignOffCard } from './SignOffCard';
import { useTodaysFeedback } from './useTodaysFeedback';
import s from './ShiftReviewView.module.css';

/**
 * End of shift: checks and payments, people notes, dining feedback, trivia, sign off.
 * `server` lets a manager review someone else's shift; `onOpenCheck` opens a closed check.
 */
export function ShiftReviewView({ server, onOpenCheck }: { server?: string; onOpenCheck?: (orderId: string) => void } = {}) {
  const me = useMyInitials();
  const who = server ?? me;
  const whoName = getStaff(who)?.name ?? serverName(who);
  const { orders, history, closeOrder } = useDining();
  const cfg = useConfig();
  const notes = useNotes();
  const feedback = useTodaysFeedback();
  const t = useNow(30_000);
  const [picked, setTab] = useState<ShiftTab>(() => requestedTab.get() ?? 'checks');
  const trivia = useTriviaOn();
  // Back Office can turn trivia off while its tab is open.
  const tab = !trivia && picked === 'trivia' ? 'checks' : picked;
  const day = sideWorkDate();
  const signedAt = useSignedOffAt(who, day);

  // The points chip asks for People notes; follow it even when already here, then clear it.
  const pending = useShared(requestedTab);
  useEffect(() => {
    if (!pending) return;
    setTab(pending);
    requestedTab.set(null);
  }, [pending]);

  const rows = useMemo(() => closedThisShift(history, who, startOfToday(), cfg), [history, who, cfg]);
  const totals = shiftTotals(rows);
  const checkIns = checkInCount([...orders, ...history.filter((o) => (o.closedAt ?? 0) >= startOfToday())], who);
  const open = orders.filter((o) => o.server === who && !o.queueType).length;
  // Tables tapped by mistake: nobody on the check, so they can go without closing.
  const empty = orders.filter((o) => o.server === who && isEmptyCheck(o));
  const voidEmpty = () => {
    for (const o of empty) closeOrder(o.id);
    toast(`Voided ${empty.length === 1 ? 'the empty check' : `${empty.length} empty checks`}.`);
  };
  const meal = mealAt(today().getHours()).toLowerCase();
  const myNotes = notes.filter((n) => n.by === who);

  const exportCopy = () =>
    printHtml(
      shiftReviewHtml({
        who,
        whoName,
        at: t,
        meal,
        rows,
        totals,
        checkIns,
        openTables: open,
        notes: myNotes,
        residentName: (id) => getResident(id)?.name ?? '',
        signedAt,
      }),
    );

  return (
    <div className={s.page}>
      <header className={s.head}>
        <h1 className={s.title}>End of shift · {whoName}</h1>
        <span className={s.date}>
          {formatDayLong(t)} · {meal}
        </span>
        {open > 0 && (
          <Chip tone="danger" size="md" className={s.open}>
            {open} table{open === 1 ? '' : 's'} still open
          </Chip>
        )}
      </header>
      {/* Toned counts stay on idle tabs only: the kit's active pill keeps the tone's text colour on a dark fill. */}
      <Tabs
        className={s.tabs}
        aria-label="Shift review"
        value={tab}
        onChange={setTab}
        options={[
          { id: 'checks', label: 'Checks and payments' },
          {
            id: 'notes',
            label: 'People notes',
            icon: <Sparkles size={14} aria-hidden />,
            count: myNotes.length,
            countTone: tab === 'notes' ? undefined : 'plum',
          },
          { id: 'feedback', label: 'Dining feedback', count: feedback.length, countTone: tab === 'feedback' ? undefined : 'success' },
          ...(trivia ? [{ id: 'trivia' as const, label: 'Trivia scoreboard', icon: <CircleHelp size={15} aria-hidden /> }] : []),
        ]}
      />
      <div role="tabpanel" aria-label={tab}>
        {tab === 'checks' && (
          <>
            <ChecksTab rows={rows} totals={totals} checkIns={checkIns} who={who} locked={signedAt != null} onOpenCheck={onOpenCheck} />
            <SignOffCard
              who={who}
              whoName={whoName}
              openTables={open}
              emptyChecks={empty.length}
              onVoidEmpty={voidEmpty}
              signedAt={signedAt}
              onSign={() => signOff(who, day, t)}
              onExport={exportCopy}
            />
          </>
        )}
        {tab === 'notes' && <PeopleNotesTab who={who} locked={signedAt != null} />}
        {tab === 'feedback' && <FeedbackTab />}
        {tab === 'trivia' && <TriviaScoreboard who={who} />}
      </div>
    </div>
  );
}
