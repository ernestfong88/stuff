import { MonitorPlay, Printer } from 'lucide-react';
import { printerMode, type KitchenMode } from '../../../domain/config';
import { updateConfig, useConfig } from '../../../store/config';
import { cx, toast } from '../../../ui';
import { BoSection } from '../kit';
import s from './KitchenModeSetting.module.css';

const CHOICES: Array<{ id: KitchenMode; title: string; icon: typeof Printer; lines: string[] }> = [
  {
    id: 'printers',
    title: 'Printers',
    icon: Printer,
    lines: [
      'The whole ticket prints when the server sends it, every course at once.',
      'No cooking, ready or served statuses on checks or My Tables.',
      'The Cook and Expo screens are off.',
    ],
  },
  {
    id: 'kds',
    title: 'Kitchen screens (KDS)',
    icon: MonitorPlay,
    lines: [
      'Orders go to the Cook and Expo screens, and courses fire in turn.',
      'Each plate shows Cooking, Ready and Served, on the check and on My Tables.',
    ],
  },
];

/** Printers or kitchen screens: how orders reach the kitchen, for every venue. */
export function KitchenModeSetting() {
  const cfg = useConfig();
  const current: KitchenMode = printerMode(cfg) ? 'printers' : 'kds';
  return (
    <BoSection title="How orders reach the kitchen" sub="For every venue. Checks already sent keep what they had; new sends follow this.">
      <div className={s.choices} role="radiogroup" aria-label="How orders reach the kitchen">
        {CHOICES.map((c) => {
          const on = c.id === current;
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              role="radio"
              aria-checked={on}
              className={cx(s.choice, on && s.on)}
              onClick={() => {
                if (on) return;
                updateConfig({ kitchenMode: c.id });
                toast(c.id === 'printers' ? 'Printer mode: tickets print whole and nothing is tracked' : 'Kitchen screens: orders go to Cook and Expo', {
                  tone: 'success',
                });
              }}
            >
              <span className={s.head}>
                <Icon size={18} aria-hidden />
                {c.title}
                {on && <span className={s.tag}>On</span>}
              </span>
              {c.lines.map((l) => (
                <span key={l} className={s.line}>
                  {l}
                </span>
              ))}
            </button>
          );
        })}
      </div>
    </BoSection>
  );
}
