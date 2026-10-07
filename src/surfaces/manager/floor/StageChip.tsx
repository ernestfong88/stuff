import { cx } from '../../../ui';
import { STAGE_WORDS, type FloorKey } from './floorState';
import type { StageKey } from './stage';
import s from './StageChip.module.css';

/** The floor colour a stage shows in; ordering and seated tables are "Open". */
export function stageColorKey(stage: StageKey): FloorKey {
  return stage === 'order' || stage === 'seat' ? 'idle' : stage;
}

/** Small solid label with the table's stage in its floor colour. */
export function StageChip({ stage }: { stage: StageKey }) {
  return <span className={cx(s.chip, s[stageColorKey(stage)])}>{STAGE_WORDS[stage]}</span>;
}
