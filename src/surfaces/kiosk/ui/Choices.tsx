import type { CatalogItem } from '../../../domain/types';
import { KButton } from './KButton';
import { GroupTitle, TileGrid } from './Layout';
import s from './Choices.module.css';

export interface ChoiceProps {
  items: CatalogItem[];
  selectedId: string | null;
  label: (it: CatalogItem) => string;
  onPick: (it: CatalogItem) => void;
}

/** A short list of drinks or sides: three across on the portrait kiosk, more in landscape. */
export function ChoiceGrid({ items, selectedId, label, onPick }: ChoiceProps) {
  return (
    <TileGrid min={280} gap={14}>
      {items.map((it) => (
        <KButton key={it.id} look={selectedId === it.id ? 'selected' : 'secondary'} className={s.choice} onClick={() => onPick(it)}>
          {label(it)}
        </KButton>
      ))}
    </TileGrid>
  );
}

/** The full list behind More, under headings. `min` is the narrowest tile in kiosk units. */
export function ChoiceGroups({ groups, min, selectedId, label, onPick }: Omit<ChoiceProps, 'items'> & { groups: Array<[string, CatalogItem[]]>; min: number }) {
  return (
    <div>
      {groups.map(([title, items]) => (
        <section key={title} className={s.group}>
          <GroupTitle>{title}</GroupTitle>
          <TileGrid min={min} gap={14}>
            {items.map((it) => (
              <KButton key={it.id} look={selectedId === it.id ? 'selected' : 'secondary'} className={s.choice} onClick={() => onPick(it)}>
                {label(it)}
              </KButton>
            ))}
          </TileGrid>
        </section>
      ))}
    </div>
  );
}
