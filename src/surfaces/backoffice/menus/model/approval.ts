/**
 * Where a menu is in the dietitian's sign-off, in plain words: not sent
 * yet, waiting for the dietitian, or approved (by whom and when).
 */
import type { BoMenu } from '../../../../store/menuEdits';

export type ApprovalStep = 'none' | 'waiting' | 'approved';

export interface ApprovalInfo {
  step: ApprovalStep;
  label: string;
  /** Who signed and when, for an approved menu. */
  detail?: string;
}

const date = (t?: number | null) => (t ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

export function approvalOf(m: Pick<BoMenu, 'approval' | 'approveReq' | 'signedBy' | 'signedAt'>): ApprovalInfo {
  if (m.approval === 'Approved') {
    const who = [m.signedBy, date(m.signedAt)].filter(Boolean).join(' · ');
    return { step: 'approved', label: 'Approved', detail: who || undefined };
  }
  if (m.approveReq) return { step: 'waiting', label: 'Waiting for the dietitian' };
  return { step: 'none', label: 'Not sent for approval' };
}

/** Send a menu to the dietitian. */
export const REQUEST_APPROVAL: Partial<BoMenu> = { approveReq: true, approval: 'Pending signature' };
