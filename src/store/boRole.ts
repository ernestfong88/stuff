/**
 * Who is signed in to Back Office: a community user (the Culinary Director,
 * the default) or Home Office. Only Home Office sees HO Settings. A demo
 * control (screen menu, Demo box; Back Office account card) switches it, and
 * it is a setting of this device, so "Reset demo data" keeps it.
 */
import { createSharedStore, useShared } from '../lib/sharedStore';

export type BoRole = 'community' | 'homeOffice';

export const BO_ROLES: Array<{ id: BoRole; label: string }> = [
  { id: 'community', label: 'Community' },
  { id: 'homeOffice', label: 'Home Office' },
];

export const boRoleStore = createSharedStore<BoRole>('community', {
  persistKey: 'kisco_backoffice_role',
  channel: 'kisco-backoffice-role',
  deviceSetting: true,
});

export function setBoRole(role: BoRole): void {
  boRoleStore.set(role);
}

export function useBoRole(): BoRole {
  return useShared(boRoleStore);
}

export const isHomeOffice = (role: BoRole = boRoleStore.get()) => role === 'homeOffice';
