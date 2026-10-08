import { ChevronRight, Copy } from 'lucide-react';
import type { Recipe } from '../../../../store/menuEdits';
import { Button, Chip, cx } from '../../../../ui';
import { RECIPE_BOOK_COMMUNITY, useSubmissions } from '../approvals';
import { dishLong } from '../model/categories';
import { approvalStatus, type RecipeApprovalInfo } from '../model/recipeApproval';
import type { RecipeScore } from '../model/score';
import { TableFrame, tableClass } from '../ui/controls';
import { DishPic } from '../ui/DishPic';
import { CategoryCell, DietChips, FavStar, ScoreChip } from '../ui/recipeBits';
import { ApprovalChip, canSubmit } from './ApprovalBits';
import s from './RecipeList.module.css';

export interface RecipeListProps {
  list: Recipe[];
  view: 'list' | 'cards';
  global: boolean;
  scoreOf: (r: Recipe) => RecipeScore | null;
  onMenu: Set<string>;
  pinCount: (id: string) => number;
  onOpen: (r: Recipe) => void;
  onAddLinked: (r: Recipe) => void;
  onCopy: (r: Recipe) => void;
  /** Your recipe made from this Global Library recipe, if you already added it. */
  ownedFrom?: (r: Recipe) => Recipe | undefined;
}

function Sold({ sc }: { sc: RecipeScore | null }) {
  return sc?.sales ? (
    <span className={s.sold}>
      {sc.sales.orders}
      <span className={s.soldUnit}> sold</span>
    </span>
  ) : (
    <span className={s.dash}>—</span>
  );
}

function Status({ r, global, onMenu, pins, approval }: { r: Recipe; global: boolean; onMenu: boolean; pins: number; approval: RecipeApprovalInfo | null }) {
  return (
    <span className={s.status}>
      {global && <Chip tone="info">Global · HO managed</Chip>}
      {approval && <ApprovalChip info={approval} />}
      {r.scope === 'linked' && <Chip tone="outline">Linked to Global</Chip>}
      {r.placeholder && <Chip tone="warning">Fee / placeholder</Chip>}
      {r.retired && <Chip>Retired</Chip>}
      {!global && !r.retired && !r.placeholder && !onMenu && <Chip tone="outline">Never scheduled</Chip>}
      {pins > 0 && (
        <Chip tone="info">
          {pins} {pins === 1 ? 'group' : 'groups'} pinned
        </Chip>
      )}
    </span>
  );
}

function GlobalActions({
  r,
  owned,
  onAddLinked,
  onCopy,
  onOpen,
}: {
  r: Recipe;
  owned?: Recipe;
  onAddLinked: (r: Recipe) => void;
  onCopy: (r: Recipe) => void;
  onOpen: (r: Recipe) => void;
}) {
  return (
    <span className={s.globalActs} onClick={(e) => e.stopPropagation()}>
      {owned ? (
        <>
          <Chip tone="success">In your recipes</Chip>
          <Button size="sm" onClick={() => onOpen(owned)}>
            Open
          </Button>
        </>
      ) : (
        <>
          <Button size="sm" onClick={() => onAddLinked(r)} title="Home Office keeps it up to date. You can't edit it.">
            Add
          </Button>
          <Button size="sm" icon={<Copy size={13} />} onClick={() => onCopy(r)} title="Your own copy to change. Home Office updates don't reach it.">
            Copy to edit
          </Button>
        </>
      )}
    </span>
  );
}

/** Recipes as a table or as photo cards. */
export function RecipeList({ list, view, global, scoreOf, onMenu, pinCount, onOpen, onAddLinked, onCopy, ownedFrom }: RecipeListProps) {
  const subs = useSubmissions();
  const approvalOf = (r: Recipe) => (global || !canSubmit(r) ? null : approvalStatus(subs, RECIPE_BOOK_COMMUNITY, r));
  if (!list.length) return <div className={s.none}>No recipes match these filters.</div>;

  if (view === 'cards') {
    return (
      <div className={s.cards}>
        {list.map((r) => {
          const sc = scoreOf(r);
          return (
            <article key={r.id} className={cx(s.card, r.retired && s.retired, !global && s.clickable)} onClick={global ? undefined : () => onOpen(r)}>
              <div className={s.cardPic}>
                <DishPic name={r.name} drink={r.cat === 'Drinks'} size="100%" className={s.cardImg} />
                {!global && (
                  <span className={s.cardStar}>
                    <FavStar r={r} onPhoto />
                  </span>
                )}
              </div>
              <div className={s.cardBody}>
                {global ? (
                  <span className={s.cardName}>{dishLong(r.name)}</span>
                ) : (
                  <button className={s.cardName} onClick={() => onOpen(r)}>
                    {dishLong(r.name)}
                  </button>
                )}
                <div className={s.cardCat}>
                  <CategoryCell r={r} />
                </div>
                <div className={s.cardScore}>
                  <ScoreChip sc={sc} />
                  <Sold sc={sc} />
                </div>
                {(r.dietFlags ?? []).length > 0 && <DietChips r={r} />}
                <Status r={r} global={global} onMenu={onMenu.has(r.id)} pins={pinCount(r.id)} approval={approvalOf(r)} />
                {global && <GlobalActions r={r} owned={ownedFrom?.(r)} onAddLinked={onAddLinked} onCopy={onCopy} onOpen={onOpen} />}
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <TableFrame>
      <table className={tableClass}>
        <thead>
          <tr>
            <th>Recipe</th>
            <th>Category</th>
            <th>Diet</th>
            <th title="Recipe score out of 5, from sales and resident feedback">Score</th>
            <th>Sold, last 4 weeks</th>
            <th aria-label={global ? 'Actions' : 'Open'} />
          </tr>
        </thead>
        <tbody>
          {list.map((r) => {
            const sc = scoreOf(r);
            return (
              <tr key={r.id} className={cx(!global && s.row, r.retired && s.retired)} onClick={global ? undefined : () => onOpen(r)}>
                <td>
                  <div className={s.nameCell}>
                    {!global && <FavStar r={r} />}
                    <DishPic name={r.name} drink={r.cat === 'Drinks'} size={40} />
                    <div className={s.nameCol}>
                      {global ? (
                        <span className={s.name}>{dishLong(r.name)}</span>
                      ) : (
                        <button className={s.name} onClick={() => onOpen(r)}>
                          {dishLong(r.name)}
                        </button>
                      )}
                      <Status r={r} global={global} onMenu={onMenu.has(r.id)} pins={pinCount(r.id)} approval={approvalOf(r)} />
                    </div>
                  </div>
                </td>
                <td>
                  <CategoryCell r={r} />
                </td>
                <td>
                  <DietChips r={r} />
                </td>
                <td>
                  <ScoreChip sc={sc} />
                </td>
                <td>
                  <Sold sc={sc} />
                </td>
                <td className={s.end}>
                  {global ? <GlobalActions r={r} owned={ownedFrom?.(r)} onAddLinked={onAddLinked} onCopy={onCopy} onOpen={onOpen} /> : <ChevronRight size={18} aria-hidden className={s.chev} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableFrame>
  );
}
