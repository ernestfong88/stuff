import { cx } from '../../ui';
import s from './ManagerTabs.module.css';

export type ManagerTab = 'triage' | 'tables' | 'metrics' | 'shift' | 'associates' | '86';

export const MANAGER_TABS: ReadonlyArray<{ id: ManagerTab; label: string }> = [
  { id: 'triage', label: 'Triage' },
  { id: 'tables', label: 'Tables' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'shift', label: 'Closing report' },
  { id: 'associates', label: 'Associates' },
  { id: '86', label: '86 list' },
];

/** __KMgrTabs: the manager's six views. */
export function ManagerTabs({ value, onChange }: { value: ManagerTab | null; onChange: (tab: ManagerTab) => void }) {
  return (
    <div className={s.bar}>
      <div role="tablist" aria-label="Manager views" className={s.tabs}>
        {MANAGER_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={value === t.id}
            className={cx(s.tab, value === t.id && s.on)}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
