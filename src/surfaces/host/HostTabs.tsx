import { Tabs } from '../../ui';

export type HostTab = 'floor' | 'reservations';

/** __KHostTabs: Floor and Reservations, with the parties still to come today. */
export function HostTabs({ value, onChange, due }: { value: HostTab; onChange: (t: HostTab) => void; due: number }) {
  return (
    <Tabs<HostTab>
      variant="segmented"
      size="md"
      value={value}
      onChange={onChange}
      aria-label="Host view"
      options={[
        { id: 'floor', label: 'Floor' },
        { id: 'reservations', label: 'Reservations', count: due > 0 ? due : undefined, countTone: 'info' },
      ]}
    />
  );
}
