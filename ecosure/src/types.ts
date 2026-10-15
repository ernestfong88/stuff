/** Stored records. Everything the site knows is one of these, plus Settings. */

export type Crit = 'Critical' | 'Major' | 'Minor' | 'Unrated';

/** One violation cited in an EcoSure report. */
export interface Item {
  cid: string; // EcoSure client id, e.g. 6.6.5 ('' when unknown)
  section: string;
  subsection: string;
  question: string;
  short: string;
  criticality: Crit;
  points: number;
  comment: string;
  findings: string[];
  photos: string[]; // photo refs (see store.photoUrl)
}

/** One EcoSure food safety report for one kitchen on one day. */
export interface Report {
  kind: 'report';
  id: string;
  community: string;
  kitchen: string;
  city: string;
  date: string; // YYYY-MM-DD
  score: number | null;
  manager: string;
  hdDate: string;
  hdResult: string;
  positive: string[];
  items: Item[];
  file: string;
  fileRef?: string; // stored original PDF, when the backend keeps files
  source: 'pdf' | 'legacy' | 'manual';
  warnings: string[];
  importedAt: string;
  deleted?: boolean;
}

/** One line of a Corrective Action Plan. */
export interface CapItem {
  cid: string;
  question: string;
  action: string;
  update: string;
  owner: string;
  due: string; // YYYY-MM-DD or ''
  touch: string;
  comment: string;
  subs: string[];
  photos: string[];
}

export type CapStatus = 'Initiated' | 'Pending' | 'Submitted' | 'Approved' | 'Completed' | 'Rejected' | string;

/** One Corrective Action Plan for one kitchen audit. */
export interface Cap {
  kind: 'cap';
  id: string;
  community: string;
  kitchen: string;
  auditDate: string; // YYYY-MM-DD of the audit it answers ('' when unknown)
  status: CapStatus;
  submitted: string;
  approved: string;
  completed: string;
  items: CapItem[];
  file: string;
  fileRef?: string;
  source: 'pdf' | 'legacy' | 'manual';
  warnings: string[];
  importedAt: string;
  deleted?: boolean;
}

export type SelfResult = 'pass' | 'fail' | 'na';

/** A community's own walk-through against the readiness checklist. */
export interface SelfAudit {
  kind: 'self';
  id: string;
  community: string;
  kitchen: string;
  date: string;
  by: string; // name typed by the person submitting
  results: Record<string, { r: SelfResult; note?: string }>; // by standard short label
  importedAt: string;
  deleted?: boolean;
}

export type Rec = Report | Cap | SelfAudit;
/** Records that come from EcoSure files. */
export type FileRec = Report | Cap;

export interface Community {
  name: string; // exactly as EcoSure prints it (without " - Kitchen #n")
  short: string;
  city: string;
  kitchens: string[]; // 'Main Kitchen' or 'Kitchen 1', 'Kitchen 2' ...
  active: boolean;
  note: string; // e.g. "Audited Sep 25, report not yet received"
  aliases: string[];
  region?: string;
}

export interface Round {
  name: string;
  start: string;
  end: string;
}

export interface Settings {
  roster: Community[];
  rounds: Round[];
  capDueDays: number; // days after the audit a CAP should be submitted
  cycleDays: number; // a community is overdue for an audit after this many days
  selfAuditDays?: number; // a self-audit is expected this often
  mitigated?: string[]; // findings ("<audit key>|<standard>") whose immediate risk was remediated while the full solution is in progress
  updatedAt: string;
}
