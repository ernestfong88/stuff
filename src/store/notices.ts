/**
 * Notices (broadcasts) from Back Office or the home office, with per-staff
 * acknowledgements.
 *
 * Servers no longer get a banner: a Notices button shows how many live
 * notices they have not seen, and each is acknowledged with "Got it" so the
 * office can see who has read it. Back Office hands its list over with
 * setNoticeList; until it does, the seed list stands.
 */
import { seedBroadcasts } from '../data';
import type { Broadcast } from '../domain/types';
import { MINUTE, now } from '../lib/clock';
import { createSharedStore, useShared } from '../lib/sharedStore';

export interface NoticesState {
  /** Back Office's list; null until it has been handed over (the seed is used). */
  list: Broadcast[] | null;
  /** Notice id → staff initials → when they acknowledged it. */
  acks: Record<string, Record<string, number>>;
}

function seedNotices(): NoticesState {
  const t = now();
  return {
    list: null,
    acks: {
      bc3: { MG: t - 50 * MINUTE, RJ: t - 38 * MINUTE },
      bc1: { MG: t - 20 * MINUTE },
    },
  };
}

export const noticesStore = createSharedStore<NoticesState>(seedNotices, {
  persistKey: 'kisco.notices.v1',
  channel: 'kisco-notices',
});

const seedList = seedBroadcasts();

/** Every notice (Back Office's list, or the seed). */
export function allNotices(s: NoticesState): Broadcast[] {
  return s.list ?? seedList;
}

/** Notices running at `at` (default now). */
export function liveNotices(s: NoticesState, at: number = now()): Broadcast[] {
  return allNotices(s).filter((b) => b.startDt <= at && b.endDt >= at);
}

/** When `who` acknowledged the notice, if they have. */
export function ackedAt(s: NoticesState, noticeId: string, who: string): number | undefined {
  return s.acks[noticeId]?.[who];
}

/** Live notices `who` has not acknowledged yet. */
export function unseenNotices(s: NoticesState, who: string): Broadcast[] {
  return liveNotices(s).filter((b) => !ackedAt(s, b.id, who));
}

/** Notices `who` has acknowledged, most recent acknowledgement first ("Past notices"). */
export function pastNotices(s: NoticesState, who: string): Broadcast[] {
  return allNotices(s)
    .filter((b) => ackedAt(s, b.id, who))
    .sort((a, b) => ackedAt(s, b.id, who)! - ackedAt(s, a.id, who)!);
}

/** `who` tapped Got it. */
export function ackNotice(noticeId: string, who: string): void {
  noticesStore.set((s) => ({ ...s, acks: { ...s.acks, [noticeId]: { ...s.acks[noticeId], [who]: now() } } }));
}

/** Back Office hands over its current list. */
export function setNoticeList(list: Broadcast[]): void {
  noticesStore.set((s) => (s.list === list ? s : { ...s, list }));
}

/** Read the notices state in a component (pair with the selectors above). */
export function useNotices(): NoticesState {
  return useShared(noticesStore);
}
