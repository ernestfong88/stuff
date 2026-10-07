import { createSharedStore } from '../../../../lib/sharedStore';

/**
 * Which resident Conversation Profiles should open on, set by Resident
 * Profiles' "Edit story & notes" just before it navigates there.
 */
export const storyPick = createSharedStore<string | null>(null);
