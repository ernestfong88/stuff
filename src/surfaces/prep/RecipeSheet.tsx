import { Button, Modal } from '../../ui';
import { SPECIAL_KIND_LABEL, type PrepSpecial } from '../../store/production';
import { formatQuantity, formatScale } from './logic';
import s from './RecipeSheet.module.css';

interface RecipeSheetProps {
  special: PrepSpecial | null;
  make: number;
  onClose: () => void;
}

/** The special's recipe scaled to the amount to make, or its cook notes. */
export function RecipeSheet({ special, make, onClose }: RecipeSheetProps) {
  if (!special) return null;
  const recipe = special.recipe;
  const factor = recipe ? make / recipe.base : 1;
  const subtitle = recipe
    ? `Make ${make} · base recipe ${recipe.base} · scaled ${formatScale(make, recipe.base)} · one serving = ${recipe.serving}`
    : SPECIAL_KIND_LABEL[special.kind] + (special.sides.length ? ` · with ${special.sides.join(', ')}` : '');
  return (
    <Modal
      open
      onClose={onClose}
      width={760}
      title={
        <span className={s.title}>
          <span>{special.name}</span>
          <span className={s.make}>{make}</span>
        </span>
      }
      subtitle={subtitle}
      footer={
        <Button size="lg" block onClick={onClose}>
          Back to the plan
        </Button>
      }
    >
      {recipe ? (
        <div className={s.grid}>
          <section>
            <h3 className={s.cap}>Ingredients · for {make}</h3>
            <ul className={s.ingredients}>
              {recipe.ingredients.map(([q, unit, what]) => (
                <li key={what} className={s.ingredient}>
                  <span className={s.qty}>
                    {formatQuantity(q * factor)}
                    {unit ? ` ${unit}` : ''}
                  </span>
                  <span>{what}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className={s.cap}>Method</h3>
            <ol className={s.method}>
              {recipe.method.map((step, i) => (
                <li key={step} className={s.step}>
                  <span className={s.stepNum}>{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      ) : (
        <div>
          {special.desc && <p className={s.desc}>{special.desc}</p>}
          {special.cook && (
            <>
              <h3 className={s.cap}>Cook notes</h3>
              <p className={s.cook}>{special.cook}</p>
            </>
          )}
          <p className={s.none}>There is no scaled recipe for this dish yet.</p>
        </div>
      )}
    </Modal>
  );
}
