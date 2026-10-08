import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { residentPills } from '../../../../domain/residents';
import type { Resident } from '../../../../domain/types';
import { Avatar, Chip } from '../../../../ui';
import { tagLabel } from '../../../backoffice/pages/residents/dietTags';
import { planStatus } from './residentInfo';
import s from './ResidentCard.module.css';

/**
 * Allergy and diet tags, allergies first, as the kitchen ticket shows them.
 * plain: allergies red, diets and textures neutral, the ticket's shorthand
 * spelled out ("GF" is "Gluten-free"), as on the Residents list.
 */
export function ResidentPills({ resident, size = 'xs', plain }: { resident: Resident; size?: 'xs' | 'sm' | 'md'; plain?: boolean }) {
  const pills = residentPills(resident);
  if (!pills.length) return null;
  return (
    <span className={s.pills}>
      {pills.map((p) => (
        <Chip
          key={p.kind + p.text}
          size={size}
          tone={p.kind === 'allergy' ? 'danger' : plain ? 'neutral' : 'success'}
          title={plain && tagLabel(p.text) !== p.text ? `On the ticket: ${p.text}` : undefined}
        >
          {plain ? tagLabel(p.text) : p.text}
        </Chip>
      ))}
    </span>
  );
}

/** One resident in a list: face, name, apartment, level, meals left and tags. */
export function ResidentCard({ resident, onOpen, tag }: { resident: Resident; onOpen: () => void; tag?: ReactNode }) {
  const { plan, left } = planStatus(resident);
  const unit = left === 1 ? (plan.unit ?? 'meals').replace(/s$/, '') : (plan.unit ?? 'meals');
  return (
    <button type="button" className={s.card} onClick={onOpen}>
      <Avatar person={resident} size={44} />
      <span className={s.text}>
        <span className={s.name}>
          {resident.name}
          {tag}
        </span>
        <span className={s.meta}>
          Apt {resident.apt} · {resident.level} · {left != null ? `${left} ${unit} left` : 'à la carte'}
        </span>
        <ResidentPills resident={resident} size="md" plain />
      </span>
      <ChevronRight size={18} className={s.chev} aria-hidden />
    </button>
  );
}
