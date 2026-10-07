import { getItem } from '../../../data';
import { dishNoun, dishVersions } from '../../../domain/kioskMenu';
import { DishTile } from '../ui/DishTile';
import { KButton } from '../ui/KButton';
import { Question } from '../ui/Layout';
import type { KioskFlow } from '../useKioskFlow';
import s from './VersionStep.module.css';

/** "Which pizza would you like?": the ready-made versions of a build-your-own dish. */
export function VersionStep({ flow }: { flow: KioskFlow }) {
  const it = getItem(flow.s.entree);
  if (!it) return null;
  return (
    <div>
      <Question title={`Which ${dishNoun(it).toLowerCase()} would you like?`} sub="Tap one. You can ask for changes after." />
      <div className={s.list}>
        {dishVersions(it).map((v) => (
          <KButton
            key={v.name}
            start
            look={flow.s.version === v.name ? 'selected' : 'secondary'}
            className={s.version}
            onClick={() => flow.advance({ version: v.name })}
          >
            <DishTile item={it} size={92} />
            <span className={s.text}>
              <span className={s.title}>{v.title}</span>
              <span className={s.desc}>{v.desc}</span>
            </span>
          </KButton>
        ))}
      </div>
    </div>
  );
}
