import { avatarColors } from '../data';
import { residentPhoto } from '../data/photos';
import { initials as toInitials } from '../lib/format';
import s from './Avatar.module.css';
import { cx } from './cx';

export interface AvatarPerson {
  /** Resident id, used to find a bundled photo. */
  id?: string;
  name?: string;
  /** Initials; also keys the avatar colour. Derived from name when absent. */
  photo?: string;
}

export interface AvatarProps {
  person: AvatarPerson | null | undefined;
  size?: number;
  /** Override the background colour (e.g. a server's colour). */
  color?: string;
  className?: string;
  /** Show a ring, e.g. for the selected diner. */
  ring?: boolean;
}

const DEFAULT: [string, string] = ['#145785', '#0F4368'];

/**
 * Round portrait for a resident, associate or staff member. Uses the bundled
 * photo when there is one, otherwise initials on the person's colour.
 */
export function Avatar({ person, size = 40, color, className, ring }: AvatarProps) {
  const label = person?.photo || toInitials(person?.name);
  const src = residentPhoto(person?.id);
  const [from, to] = color ? [color, color] : avatarColors[label] || DEFAULT;
  return (
    <span
      className={cx(s.avatar, ring && s.ring, className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background: src ? '#DCE3E8' : `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
      }}
      title={person?.name}
      aria-hidden={!person?.name}
    >
      {src ? <img src={src} alt="" draggable={false} /> : label}
    </span>
  );
}
