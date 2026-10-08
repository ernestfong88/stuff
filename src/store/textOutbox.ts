/**
 * Every text goes through sendText(). There is no texting service yet, so
 * the transport only records the message as "simulated" in an outbox that
 * Back Office > Text Messages shows. A real provider replaces `deliver`
 * with a call to the community's own server, which holds the provider
 * account and sends; no provider key belongs in the browser.
 */
import { now } from '../lib/clock';
import { uid } from '../lib/id';
import { createSharedStore, useShared } from '../lib/sharedStore';
import type { TextKey } from '../domain/pickupService/texts';

export interface OutgoingText {
  /** Mobile number, digits only. */
  to: string;
  body: string;
  kind: TextKey;
  /** Order (or other record) the text is about. */
  ref?: string;
  /** Who it goes to, for the outbox list. */
  name?: string;
}

export interface SentText extends OutgoingText {
  id: string;
  at: number;
  status: 'sending' | 'simulated' | 'sent' | 'failed';
}

const KEEP = 50;

export const outbox = createSharedStore<SentText[]>([], {
  persistKey: 'kisco_texts_outbox_v1',
  channel: 'kisco-texts-outbox',
});

/** Hand a message to the transport. The demo transport only keeps it. */
async function deliver(_m: OutgoingText): Promise<{ status: SentText['status'] }> {
  return { status: 'simulated' };
}

export function sendText(m: OutgoingText): void {
  const rec: SentText = { ...m, id: uid('tx'), at: now(), status: 'sending' };
  outbox.set((list) => [rec, ...list].slice(0, KEEP));
  const settle = (status: SentText['status']) =>
    outbox.set((list) => list.map((x) => (x.id === rec.id ? { ...x, status } : x)));
  deliver(m).then(
    (r) => settle(r.status),
    () => settle('failed'),
  );
}

export function useOutbox(): SentText[] {
  return useShared(outbox);
}
