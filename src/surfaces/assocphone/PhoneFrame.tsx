import type { ReactNode } from 'react';
import { ModeChip, TextZoom } from '../../shell/controls';
import s from './PhoneFrame.module.css';

/**
 * The Associate App runs on the associate's own phone. On a wider screen it
 * shows in a phone-sized column instead of stretching across.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className={s.backdrop}>
      <div className={s.phone}>
        <div className={s.bar}>
          <TextZoom />
          <ModeChip />
        </div>
        {children}
      </div>
    </div>
  );
}
