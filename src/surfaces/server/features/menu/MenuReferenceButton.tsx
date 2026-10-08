import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import type { MealName } from '../../../../domain/types';
import { Button } from '../../../../ui';
import { MenuReference } from './MenuReference';

/**
 * Header button that opens the menu reference (today's menu, dish photos).
 * variant "pictures" is the "Menu pictures" pill used on the check, where a
 * server describing a dish wants the photo.
 */
export function MenuReferenceButton({
  short,
  meal,
  variant = 'header',
  className,
}: {
  short?: boolean;
  meal?: MealName;
  variant?: 'header' | 'pictures';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={variant === 'pictures' ? 'soft' : 'secondary'}
        className={className}
        icon={<BookOpen size={16} />}
        iconOnly={short && variant === 'header'}
        aria-label={short ? 'Menu' : undefined}
        title="Today's menu: specials, photos and plating"
        onClick={() => setOpen(true)}
      >
        {variant === 'pictures' ? 'Menu pictures' : short ? null : 'Menu'}
      </Button>
      {open && <MenuReference meal={meal} onClose={() => setOpen(false)} />}
    </>
  );
}
