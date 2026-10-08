import { Check } from 'lucide-react';
import { useKioskPref } from '../model/prefs';
import { KButton } from '../ui/KButton';
import { Question, TileGrid } from '../ui/Layout';
import type { KioskFlow } from '../useKioskFlow';
import s from './UtensilsStep.module.css';

/** "Utensils and a napkin, like last time?" for a regular, else the plain question. */
export function UtensilsStep({ flow }: { flow: KioskFlow }) {
  const st = flow.s;
  const pref = useKioskPref(st.resident?.id);
  const last = typeof pref?.utensils === 'boolean' ? pref.utensils : null;

  if (last !== null && !st.edit && !st.changeUtensils) {
    return (
      <div>
        <Question title={last ? 'Utensils and a napkin, like last time?' : 'No utensils or napkin, like last time?'} />
        <TileGrid min={320} gap={24}>
          <KButton look="primary" className={s.answer} icon={<Check size="1em" strokeWidth={3} aria-hidden />} onClick={() => flow.advance({ utensils: last })}>
            Yes
          </KButton>
          <KButton className={s.answer} onClick={() => flow.put({ changeUtensils: true })}>
            Change
          </KButton>
        </TileGrid>
      </div>
    );
  }
  const current = st.edit ? st.utensils : null;
  return (
    <div>
      <Question title="Would you like utensils and a napkin?" />
      <TileGrid min={320} gap={24}>
        {([
          [true, 'Yes, please'],
          [false, 'No, thanks'],
        ] as const).map(([v, label]) => (
          <KButton
            key={label}
            look={current === v ? 'selected' : current === null && v ? 'primary' : 'secondary'}
            className={s.answer}
            onClick={() => flow.advance({ utensils: v })}
          >
            {label}
          </KButton>
        ))}
      </TileGrid>
    </div>
  );
}
