import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { FloorTable } from '../../../domain/types';
import { useDining } from '../../../store/dining';
import { useConfirm } from '../../../ui';
import { currentMeal } from '../shared/meal';
import { FloorPicker } from './FloorPicker';
import { myChecksAt, pickerTable } from './floorTables';
import { NewCheckAsk } from './NewCheckAsk';
import s from './NewCheckView.module.css';

/** Pick a table for a new check. A table where I already have a check asks first. */
export function NewCheckView({ room, me, onBack, onOpen }: { room: string; me: string; onBack: () => void; onOpen: (orderId: string) => void }) {
  const { orders, openOrder, newCheck } = useDining();
  const [ask, setAsk] = useState<{ table: FloorTable; mine: ReturnType<typeof myChecksAt> } | null>(null);

  const [confirm, confirmDialog] = useConfirm();

  const pick = async (table: FloorTable) => {
    const mine = myChecksAt(orders, table.id, me);
    if (mine.length) {
      setAsk({ table, mine });
      return;
    }
    // Another server's table: say so, rather than quietly starting a second check there.
    const others = pickerTable(table, orders, me).others;
    if (others.length) {
      const who = others.join(' and ');
      const ok = await confirm({
        title: `${who} ${others.length === 1 ? 'has' : 'have'} a check at ${table.label}`,
        message: `Start your own check here for someone who sits down with them? It gets its own diners and timer. To work on ${who}'s check, open it from their tables on My tables.`,
        confirmLabel: 'Start my check',
      });
      if (!ok) return;
    }
    const id = openOrder(table.id, room, currentMeal(), me);
    if (id) onOpen(id);
  };

  return (
    <div className={s.view}>
      <div className={s.head}>
        <button className={s.back} onClick={onBack}>
          <ChevronLeft size={18} strokeWidth={2.5} aria-hidden />
          My tables
        </button>
        <h1 className={s.title}>Pick a table for the new check</h1>
        <p className={s.legend}>
          White is open. Blue is your check. Yellow outline is another server’s check, with their name. Full means every seat is taken.
        </p>
      </div>
      <FloorPicker room={room} me={me} onPick={pick} />
      {confirmDialog}
      {ask && (
        <NewCheckAsk
          table={ask.table}
          mine={ask.mine}
          onClose={() => setAsk(null)}
          onOpen={(id) => {
            setAsk(null);
            onOpen(id);
          }}
          onNew={() => {
            const id = newCheck(ask.table.id, room, currentMeal(), me);
            setAsk(null);
            if (id) onOpen(id);
          }}
        />
      )}
    </div>
  );
}
