/** The three decisions on a recipe sent for approval: their buttons, dialog wording and what the toast says. */
import { BadgeCheck, CircleX, MessageSquareWarning, type LucideIcon } from 'lucide-react';
import type { ButtonVariant } from '../../../../ui';

export type DecisionKind = 'approve' | 'changes' | 'deny';

interface Decision {
  /** On the review's action bar. */
  button: string;
  buttonVariant: ButtonVariant;
  icon: LucideIcon;
  title: string;
  confirm: string;
  confirmVariant: ButtonVariant;
  noteRequired: boolean;
  lead: (community: string) => string;
  hint?: string;
  placeholder: string;
  missing?: string;
  done: (name: string, community: string) => string;
}

export const DECISIONS: Record<DecisionKind, Decision> = {
  approve: {
    button: 'Approve',
    buttonVariant: 'success',
    icon: BadgeCheck,
    title: 'Approve recipe',
    confirm: 'Approve recipe',
    confirmVariant: 'success',
    noteRequired: false,
    lead: (c) => `${c} sees the approval, and your comment, on the recipe in their Recipe Book.`,
    placeholder: 'e.g. Approved as written. Nice plating notes.',
    done: (n, c) => `${n} approved. ${c} sees it on the recipe.`,
  },
  changes: {
    button: 'Ask for changes',
    buttonVariant: 'secondary',
    icon: MessageSquareWarning,
    title: 'Ask for changes',
    confirm: 'Send back for changes',
    confirmVariant: 'warning',
    noteRequired: true,
    lead: (c) => `Close, but not yet. ${c} sees your note on the recipe, makes the changes and sends it again.`,
    hint: 'Say what to change, so the next version can be approved.',
    placeholder: 'e.g. Tick Shellfish in the allergens, and add a hold temperature for the grits.',
    missing: 'Say what to change, so the team knows what to fix.',
    done: (n, c) => `Changes requested on ${n}. ${c} sees your note on the recipe.`,
  },
  deny: {
    button: 'Deny',
    buttonVariant: 'softDanger',
    icon: CircleX,
    title: 'Deny recipe',
    confirm: 'Deny recipe',
    confirmVariant: 'danger',
    noteRequired: true,
    lead: (c) => `Not right for the Kisco library as it stands. ${c} sees your reason on the recipe.`,
    hint: 'Say why, so the team understands the decision.',
    placeholder: 'e.g. Sodium is 1,450 mg a serving; the cap for an entrée is 900 mg.',
    missing: 'Give a reason, so the team knows why.',
    done: (n, c) => `${n} denied. ${c} sees your reason on the recipe.`,
  },
};

export const DECISION_ORDER: DecisionKind[] = ['deny', 'changes', 'approve'];
