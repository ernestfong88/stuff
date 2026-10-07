/**
 * Back office resident records (meal plan, start days, kitchen notes),
 * editable on Dining Plans & Notes and read by Charge Approval.
 */
import { createSharedStore, useShared } from '../../../lib/sharedStore';
import { seedBoResidents, type BoResident } from '../seed/residents';

export const residentRecordsStore = createSharedStore<BoResident[]>(seedBoResidents, {
  persistKey: 'kisco_backoffice_residents_v1',
  channel: 'kisco-backoffice-residents',
});

export function useResidentRecords(): BoResident[] {
  return useShared(residentRecordsStore);
}

export function updateResidentRecord(id: string, patch: Partial<BoResident>): void {
  residentRecordsStore.set((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
}
