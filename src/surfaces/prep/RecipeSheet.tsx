import { Button, Modal } from '../../ui';
import type { Recipe } from '../../store/menuEdits';
import { SPECIAL_KIND_LABEL, type PrepSpecial } from '../../store/production';
import { isWritten, useRecipeCard } from '../../store/recipeCards';
import { formatScale, kitchenAmount } from './logic';
import s from './RecipeSheet.module.css';

interface RecipeSheetProps {
  special: PrepSpecial | null;
  make: number;
  onClose: () => void;
}

/**
 * The special's recipe scaled to the amount to make: the Recipe Book's
 * recipe when the chef has written one, else the prep recipe, else what the
 * book does know (description, cook notes, serving).
 */
export function RecipeSheet({ special, make, onClose }: RecipeSheetProps) {
  const book = useRecipeCard(special?.name);
  if (!special) return null;
  const prep = special.recipe;
  const written = isWritten(book) ? book : undefined;
  const base = written ? written.baseServings || 1 : (prep?.base ?? 1);
  const factor = make / base;
  const serving = written ? written.servingDesc || written.servingSize : prep?.serving;
  const subtitle =
    written || prep
      ? [`Make ${make}`, `base recipe ${base}`, `scaled ${formatScale(make, base)}`, serving && `one serving = ${serving}`]
          .filter(Boolean)
          .join(' · ')
      : SPECIAL_KIND_LABEL[special.kind] + (special.sides.length ? ` · with ${special.sides.join(', ')}` : '');
  const ingredients: Array<[number, string, string]> = written
    ? (written.ingredients ?? []).map((i) => [i.qty, i.unit, i.name])
    : (prep?.ingredients ?? []);
  const method = written ? (written.method ?? []) : (prep?.method ?? []);
  const cookNotes = book?.cookNotes || special.cook;

  return (
    <Modal
      open
      onClose={onClose}
      width={820}
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
      {written || prep ? (
        <>
          {written && <Facts recipe={written} />}
          <div className={s.grid}>
            {ingredients.length > 0 && (
              <section>
                <h3 className={s.cap}>Ingredients · for {make}</h3>
                <ul className={s.ingredients}>
                  {ingredients.map(([q, unit, what]) => (
                    <li key={what} className={s.ingredient}>
                      <span className={s.qty}>{kitchenAmount(q * factor, unit)}</span>
                      <span>{what}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {method.length > 0 && (
              <section>
                <h3 className={s.cap}>Method</h3>
                <Steps steps={method} />
              </section>
            )}
          </div>
          {written?.plating?.length ? (
            <section className={s.more}>
              <h3 className={s.cap}>Plating</h3>
              <Steps steps={written.plating} />
            </section>
          ) : null}
          {cookNotes && <Notes text={cookNotes} />}
        </>
      ) : (
        <div>
          {(book?.desc || special.desc) && <p className={s.desc}>{book?.desc || special.desc}</p>}
          {book && <Facts recipe={book} />}
          {cookNotes && <Notes text={cookNotes} />}
          <p className={s.none}>No written recipe yet. Add the ingredients and method in the Recipe Book and they show here, scaled.</p>
        </div>
      )}
    </Modal>
  );
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className={s.method}>
      {steps.map((step, i) => (
        <li key={step} className={s.step}>
          <span className={s.stepNum}>{i + 1}</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

function Notes({ text }: { text: string }) {
  return (
    <section className={s.more}>
      <h3 className={s.cap}>Cook notes</h3>
      <p className={s.cook}>{text}</p>
    </section>
  );
}

/** One line of what a cook checks first: times, garnish, equipment, allergens. */
function Facts({ recipe: r }: { recipe: Recipe }) {
  const facts = [
    r.prepMin ? `Prep ${r.prepMin} min` : null,
    r.cookMin ? `Cook ${r.cookMin} min` : null,
    r.garnish ? `Garnish: ${r.garnish}` : null,
    r.equipment?.length ? `Equipment: ${r.equipment.join(', ')}` : null,
  ].filter(Boolean);
  if (!facts.length && !r.allergens?.length) return null;
  return (
    <div className={s.facts}>
      {facts.map((f) => (
        <span key={f}>{f}</span>
      ))}
      {r.allergens?.length ? <span className={s.allergens}>Contains {r.allergens.join(', ').toLowerCase()}</span> : null}
    </div>
  );
}
