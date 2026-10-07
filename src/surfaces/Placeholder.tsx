import { CornerControls } from '../shell/controls';
import type { Mode } from '../shell/modes';
import { EmptyState } from '../ui';

/** Temporary stand-in while a surface is being built. */
export function Placeholder({ mode }: { mode: Mode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center' }}>
      <CornerControls />
      <EmptyState title={mode.label}>{mode.blurb}</EmptyState>
    </div>
  );
}
