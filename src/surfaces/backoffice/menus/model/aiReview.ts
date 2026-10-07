/**
 * The menu builder's AI review. The variety check runs live on whatever
 * menu is open, so a finding clears as soon as the change that fixes it
 * lands. Suggestions (dishes from nearby communities, last season's
 * feedback) come with the menu's data. Every action edits the grid and can
 * be undone.
 */
import type { GridEntry, Recipe, SideOverrides } from '../../../../store/menuEdits';
import { dishLong, normCategory, subOf } from './categories';
import type { RecipeScore } from './score';

export type Severity = 'high' | 'medium' | 'low';
export type Season = 'Fall' | 'Winter' | 'Spring' | 'Summer';
export const SEASONS: Season[] = ['Fall', 'Winter', 'Spring', 'Summer'];

export interface AiFinding {
  id: string;
  rule: 'repeat' | 'protein' | 'pasta' | 'season' | 'holiday' | 'weak' | 'anyday';
  sev: Severity;
  msg: string;
  day?: number;
  meal?: string;
  rec?: string;
  week?: number;
  /** A low score from this season's resident feedback (it can be removed). */
  live?: boolean;
}

export interface PastSeasonItem {
  recipe: string;
  dish: string;
  score: number;
  ratings: number;
  orders: number;
  runs: number;
  ordersPerRun: number;
  trend: string;
  quotes?: Array<{ text: string; from: string }>;
  takeaway: string;
  onDraft?: Array<{ day: number; meal: string }>;
}

export interface CheckContext {
  menuId: string;
  grid: GridEntry[];
  recipes: Map<string, Recipe>;
  len: number;
  season: Season;
  /** Protein targets per meal for a full week of lunch and dinner. */
  target: Record<string, Record<string, number>> | null;
  pastSeason: PastSeasonItem[];
  scoreOf: (r: Recipe) => RecipeScore | null;
}

const RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
const PROTEIN_WORDS: Record<string, string> = { veg: 'vegetarian and egg', seafood: 'fish and shellfish' };

/** Protein group of a placed dish, for menu balance. */
export function balanceOf(r: Recipe | undefined): string {
  return r?.balance ?? '';
}

export function aiCheck(c: CheckContext): AiFinding[] {
  const out: AiFinding[] = [];
  const name = (id: string) => dishLong(c.recipes.get(id)?.name ?? id);
  const placed = c.grid.filter((g) => g.menuId === c.menuId && g.day > 0 && g.day <= c.len);
  const at = (d: number, m: string | null, cat: string) => placed.filter((g) => g.day === d && (!m || g.meal === m) && normCategory(g.cat) === cat);
  const where = (a: Array<[number, string]>) => a.map(([d, m]) => 'day ' + d + (m ? ' ' + m.toLowerCase() : '')).join(', ');
  const weeks = Math.ceil(c.len / 7);

  for (let w = 1; w <= weeks; w++) {
    const days: number[] = [];
    for (let d = (w - 1) * 7 + 1; d <= Math.min(c.len, w * 7); d++) days.push(d);
    for (const [cat] of [['Entrees'], ['Desserts'], ['Sides']] as const) {
      const seen = new Map<string, Array<[number, string]>>();
      for (const d of days) for (const m of ['Lunch', 'Dinner']) for (const g of at(d, m, cat)) seen.set(g.recipeId, [...(seen.get(g.recipeId) ?? []), [d, m]]);
      for (const [rid, a] of seen) {
        if (a.length < 2) continue;
        const last = a[a.length - 1];
        out.push({
          id: `rep|${cat}|${rid}|${w}`,
          rule: 'repeat',
          sev: cat === 'Sides' && a.length > 2 ? 'high' : 'medium',
          msg: `${name(rid)} is ${cat === 'Sides' ? 'a default side ' : 'on the menu '}${a.length} times in week ${w} (${where(a)}).`,
          day: last[0],
          meal: last[1],
          rec: rid,
          week: w,
        });
      }
    }
    const soups = new Map<string, number[]>();
    for (const d of days) {
      const g = at(d, 'Lunch', 'Starters')[0] ?? at(d, 'Dinner', 'Starters')[0];
      if (g) soups.set(g.recipeId, [...(soups.get(g.recipeId) ?? []), d]);
    }
    for (const [rid, a] of soups) {
      if (a.length < 2) continue;
      const b2b = a.some((d, i) => i > 0 && d === a[i - 1] + 1);
      out.push({
        id: `soup|${rid}|${w}`,
        rule: 'repeat',
        sev: 'medium',
        msg: `${name(rid)} is the soup ${b2b ? 'on back-to-back days ' + a.join(' and ') : a.length + ' times in week ' + w + ' (days ' + a.join(', ') + ')'}.`,
        day: a[a.length - 1],
        meal: 'Lunch and Dinner',
        rec: rid,
        week: w,
      });
    }
    if (c.target && days.length === 7) {
      for (const m of ['Lunch', 'Dinner']) {
        const ent = days.flatMap((d) => at(d, m, 'Entrees'));
        if (ent.length !== 14) continue;
        const count: Record<string, number> = {};
        for (const g of ent) {
          const k = balanceOf(c.recipes.get(g.recipeId)) || 'other';
          count[k] = (count[k] ?? 0) + 1;
        }
        for (const [k, t] of Object.entries(c.target[m] ?? {})) {
          const v = count[k] ?? 0;
          if (Math.abs(v - t) >= 2)
            out.push({
              id: `prot|${w}|${m}|${k}`,
              rule: 'protein',
              sev: 'medium',
              msg: `Week ${w} ${m.toLowerCase()} has ${v} ${PROTEIN_WORDS[k] ?? k} entrees against a target of ${t}.`,
              day: days[0],
              meal: m,
              week: w,
            });
        }
      }
    }
  }

  for (let d = 1; d <= c.len; d++) {
    const next = d === c.len ? 1 : d + 1;
    for (const m of ['Lunch', 'Dinner']) {
      const today = at(d, m, 'Desserts').map((g) => g.recipeId);
      for (const g of at(next, null, 'Desserts')) {
        if (today.includes(g.recipeId) && !out.some((f) => f.id === `b2b|${d}|${g.recipeId}`))
          out.push({
            id: `b2b|${d}|${g.recipeId}`,
            rule: 'repeat',
            sev: 'low',
            msg: `${name(g.recipeId)} is the dessert on back-to-back days ${d} and ${next}.`,
            day: next,
            meal: g.meal,
            rec: g.recipeId,
          });
      }
    }
    const din = at(d, 'Dinner', 'Entrees');
    if (din.length > 1 && din.every((g) => subOf(c.recipes.get(g.recipeId) ?? { cat: 'Entrees', name: '' }) === 'Pasta'))
      out.push({
        id: `pasta|${d}`,
        rule: 'pasta',
        sev: 'medium',
        msg: `Both dinner specials on day ${d} are pasta (${din.map((g) => name(g.recipeId)).join(' and ')}).`,
        day: d,
        meal: 'Dinner',
      });
  }

  const seen = new Set<string>();
  for (const g of placed) {
    const key = g.recipeId + '|' + g.day;
    if (seen.has(key)) continue;
    seen.add(key);
    const tags = c.recipes.get(g.recipeId)?.tags;
    const w = Math.ceil(g.day / 7);
    const where1 = `day ${g.day}${normCategory(g.cat) === 'Starters' ? '' : ' ' + g.meal.toLowerCase()}`;
    if (tags?.summer && c.season !== 'Summer' && c.season !== 'Spring')
      out.push({
        id: `season|${g.recipeId}|${g.day}`,
        rule: 'season',
        sev: 'medium',
        msg: `${name(g.recipeId)} (${where1}) is a summer dish.`,
        day: g.day,
        meal: g.meal,
        rec: g.recipeId,
      });
    if (tags?.holiday && tags.week && w !== tags.week && c.season === 'Winter')
      out.push({
        id: `hol|${g.recipeId}|${g.day}`,
        rule: 'holiday',
        sev: 'low',
        msg: `${name(g.recipeId)} is a ${tags.holiday} dish but runs in week ${w}; ${tags.holiday} falls in week ${tags.week}.`,
        day: g.day,
        meal: g.meal,
        rec: g.recipeId,
      });
    const past = c.pastSeason.find((x) => x.recipe === g.recipeId);
    if (past && past.score < 3.5)
      out.push({
        id: `weak|${g.recipeId}|${g.day}`,
        rule: 'weak',
        sev: 'high',
        msg: `${name(g.recipeId)} scored ${past.score}/5 on ${past.orders} orders last season.`,
        day: g.day,
        meal: g.meal,
        rec: g.recipeId,
      });
  }

  const anyDay = new Set(c.grid.filter((g) => g.menuId === c.menuId && g.day === 0).map((g) => g.recipeId));
  for (const g of placed) {
    if (anyDay.has(g.recipeId) && normCategory(g.cat) !== 'Drinks' && !out.some((f) => f.id === 'any|' + g.recipeId))
      out.push({
        id: 'any|' + g.recipeId,
        rule: 'anyday',
        sev: 'low',
        msg: `${name(g.recipeId)} is a special on day ${g.day} and also on Any Day.`,
        day: g.day,
        meal: g.meal,
        rec: g.recipeId,
      });
  }

  const scored = new Set<string>();
  for (const g of placed) {
    const cat = normCategory(g.cat);
    if (scored.has(g.recipeId) || cat === 'Drinks' || cat === 'Sides' || c.pastSeason.some((x) => x.recipe === g.recipeId)) continue;
    scored.add(g.recipeId);
    const r = c.recipes.get(g.recipeId);
    const sc = r && c.scoreOf(r);
    if (sc && sc.n >= 3 && sc.neg >= 2 && sc.score < 3.2)
      out.push({
        id: 'weak|live|' + g.recipeId,
        rule: 'weak',
        sev: 'high',
        msg: `${name(g.recipeId)} scores ${sc.score.toFixed(1)}/5 from resident feedback (${sc.neg} of ${sc.n} comments negative).`,
        day: g.day,
        meal: g.meal,
        rec: g.recipeId,
        live: true,
      });
  }
  return out.sort((a, b) => RANK[a.sev] - RANK[b.sev] || (a.day ?? 0) - (b.day ?? 0));
}

// ─── Applying changes (and undoing them) ─────────────────────────────────

export type AiOp =
  | { op: 'entree'; day: number; meal: string; from: string; to: string; side?: string }
  | { op: 'side'; day: number; meal: string; entree: string; from: string; to: string }
  | { op: 'soup'; day: number; to: string }
  | { op: 'dessert'; day: number; meal: string; to: string }
  | { op: 'rm'; day: number; meal: string; rid: string }
  | { op: 'add'; placements: GridEntry[]; sides: Array<[number, string, string[]]> };

export interface ApplyState {
  menuId: string;
  grid: GridEntry[];
  /** The default sides a placement has now (chef's choice, else the seed's). */
  sidesOf: (day: number, recipeId: string) => string[];
  sides: SideOverrides;
  newId: () => string;
}

/** How to undo an applied change. */
export interface AiUndo {
  changed: Array<[string, string, string]>;
  added: string[];
  removed: GridEntry[];
  sides: Array<[number, string, string[] | undefined]>;
}

export interface ApplyResult {
  grid: GridEntry[];
  sides: SideOverrides;
  undo: AiUndo;
  /** Recipes the change needs in the master. */
  needs: string[];
}

/**
 * Apply a suggestion's operations. Returns null when the spot on the menu
 * has changed so the suggestion no longer fits.
 */
export function applyOps(ops: AiOp[], st: ApplyState, anyDaySides: string[] = []): ApplyResult | null {
  const M = st.menuId;
  const pend = new Map<string, string>();
  const changed: AiUndo['changed'] = [];
  const added: GridEntry[] = [];
  const removed: GridEntry[] = [];
  const sideLog: AiUndo['sides'] = [];
  const needs = new Set<string>();
  const menuSides = { ...st.sides[M] };
  const cur = (g: GridEntry) => pend.get(g.id) ?? g.recipeId;
  const find = (d: number, m: string, cat: string, rid?: string) =>
    st.grid.find((g) => g.menuId === M && g.day === d && g.meal === m && normCategory(g.cat) === cat && (!rid || cur(g) === rid) && !removed.includes(g));
  const setRecipe = (g: GridEntry, to: string) => {
    changed.push([g.id, cur(g), to]);
    pend.set(g.id, to);
    needs.add(to);
  };
  const sidesNow = (d: number, rid: string) => menuSides[d]?.[rid] ?? st.sidesOf(d, rid);
  const setSides = (d: number, rid: string, v: string[] | undefined) => {
    const day = { ...menuSides[d] };
    sideLog.push([d, rid, day[rid]]);
    if (v) day[rid] = v;
    else delete day[rid];
    menuSides[d] = day;
  };
  const usedBy = (d: number, m: string, sid: string, skip?: GridEntry) =>
    st.grid.some(
      (g) =>
        g.menuId === M &&
        g.day === d &&
        g.meal === m &&
        normCategory(g.cat) === 'Entrees' &&
        g !== skip &&
        !removed.includes(g) &&
        sidesNow(d, cur(g)).includes(sid),
    );
  const addSide = (d: number, m: string, rid: string) => {
    added.push({ id: st.newId(), menuId: M, recipeId: rid, day: d, meal: m as GridEntry['meal'], cat: 'Sides', sort: 900 + added.length });
    needs.add(rid);
  };
  const swapSide = (d: number, m: string, from: string | undefined, to: string | undefined, skip?: GridEntry) => {
    if (!to) return;
    if (!from || from === to || usedBy(d, m, from, skip)) {
      if (!find(d, m, 'Sides', to)) addSide(d, m, to);
      return;
    }
    const sp = find(d, m, 'Sides', from);
    if (sp && !find(d, m, 'Sides', to)) setRecipe(sp, to);
    else if (!sp && !find(d, m, 'Sides', to)) addSide(d, m, to);
  };

  for (const op of ops) {
    if (op.op === 'entree') {
      const g = find(op.day, op.meal, 'Entrees', op.from);
      if (!g) return null;
      const old = sidesNow(op.day, op.from);
      const next = op.side ? [op.side, ...anyDaySides] : old;
      setRecipe(g, op.to);
      setSides(op.day, op.to, next);
      setSides(op.day, op.from, undefined);
      if (op.side) swapSide(op.day, op.meal, old[0], op.side, g);
    } else if (op.op === 'side') {
      const o = sidesNow(op.day, op.entree);
      if (!o.includes(op.from)) return null;
      setSides(
        op.day,
        op.entree,
        o.map((x) => (x === op.from ? op.to : x)),
      );
      needs.add(op.to);
      swapSide(
        op.day,
        op.meal,
        op.from,
        op.to,
        st.grid.find((g) => g.menuId === M && g.day === op.day && g.meal === op.meal && cur(g) === op.entree),
      );
    } else if (op.op === 'soup') {
      let hit = false;
      for (const m of ['Lunch', 'Dinner']) {
        const g = find(op.day, m, 'Starters');
        if (g) {
          setRecipe(g, op.to);
          hit = true;
        }
      }
      if (!hit) return null;
    } else if (op.op === 'dessert') {
      const g = find(op.day, op.meal, 'Desserts');
      if (!g) return null;
      setRecipe(g, op.to);
    } else if (op.op === 'rm') {
      const g = find(op.day, op.meal, 'Entrees', op.rid);
      if (!g) return null;
      const sd = sidesNow(op.day, op.rid)[0];
      removed.push(g);
      if (sd && !usedBy(op.day, op.meal, sd, g)) {
        const sp = find(op.day, op.meal, 'Sides', sd);
        if (sp) removed.push(sp);
      }
      setSides(op.day, op.rid, undefined);
    } else {
      added.push(...op.placements);
      for (const [d, rid, v] of op.sides) setSides(d, rid, v);
    }
  }
  const grid = st.grid
    .filter((g) => !removed.includes(g))
    .map((g) => (pend.has(g.id) ? { ...g, recipeId: pend.get(g.id)! } : g))
    .concat(added);
  return { grid, sides: { ...st.sides, [M]: menuSides }, undo: { changed, added: added.map((g) => g.id), removed, sides: sideLog }, needs: [...needs] };
}

/** Undo an applied change, leaving later edits elsewhere on the menu alone. */
export function undoOps(u: AiUndo, menuId: string, grid: GridEntry[], sides: SideOverrides): { grid: GridEntry[]; sides: SideOverrides } {
  const menuSides = { ...sides[menuId] };
  for (const [d, rid, v] of [...u.sides].reverse()) {
    const day = { ...menuSides[d] };
    if (v) day[rid] = v;
    else delete day[rid];
    menuSides[d] = day;
  }
  const next = grid
    .filter((g) => !u.added.includes(g.id))
    .map((g) => {
      const c = u.changed.filter((x) => x[0] === g.id);
      return c.length && g.recipeId === c[c.length - 1][2] ? { ...g, recipeId: c[0][1] } : g;
    })
    .concat(u.removed.filter((r) => !grid.some((g) => g.id === r.id)));
  return { grid: next, sides: { ...sides, [menuId]: menuSides } };
}

// ─── Fill from recipe book ────────────────────────────────────────────────

export interface FillContext {
  menuId: string;
  grid: GridEntry[];
  recipes: Recipe[];
  len: number;
  season: Season;
  target: Record<string, Record<string, number>> | null;
  /** Dishes planned for this season (they go first). */
  inSeason: Set<string>;
  /** Holiday dishes that only suit their holiday. */
  holidayOnly: Set<string>;
  sidesOf: (day: number, recipeId: string) => string[];
  newId: () => string;
}

const NEED: Array<[string, number]> = [
  ['Starters', 1],
  ['Entrees', 2],
  ['Sides', 2],
  ['Desserts', 1],
];

/**
 * Fill every empty lunch and dinner slot with one of the community's own
 * specials: in season, not used elsewhere that week, a soup or dessert not
 * on the day before or after, and a second entrée of another protein,
 * leaning toward the week's protein targets.
 */
export function aiFill(c: FillContext): AiOp | null {
  const M = c.menuId;
  const all = c.grid.filter((g) => g.menuId === M);
  const byId = new Map(c.recipes.map((r) => [r.id, r]));
  const wk = (d: number) => Math.ceil(d / 7);
  const anyDay = new Set(all.filter((g) => g.day === 0).map((g) => g.recipeId));
  const off = (r: Recipe) => !!r.tags && ((r.tags.summer && c.season !== 'Summer' && c.season !== 'Spring') || !!r.tags.holiday);
  const fits = (r: Recipe, meal: string) => !r.meals || r.meals.includes(meal[0]);
  const at = (d: number, m: string | null, cat: string) => all.filter((g) => g.day === d && (!m || g.meal === m) && normCategory(g.cat) === cat);
  const used = new Map<number, Set<string>>();
  for (const g of all) if (g.day > 0) used.set(wk(g.day), (used.get(wk(g.day)) ?? new Set()).add(g.recipeId));
  const pool = (cat: string) =>
    c.recipes
      .filter(
        (r) =>
          normCategory(r.cat) === cat &&
          r.special &&
          !r.retired &&
          !r.placeholder &&
          !anyDay.has(r.id) &&
          !off(r) &&
          (cat !== 'Starters' || /soup|chowder|bisque|chili|stew/i.test(r.name + ' ' + (r.sub ?? ''))),
      )
      .sort((a, b) => Number(c.inSeason.has(b.id)) - Number(c.inSeason.has(a.id)) || a.name.localeCompare(b.name));
  const P = new Map(NEED.map(([cat]) => [cat, pool(cat)]));
  const neededProtein = (d: number, m: string): string | null => {
    const t = c.target?.[m];
    if (!t) return null;
    const count: Record<string, number> = {};
    for (const g of all)
      if (g.day > 0 && wk(g.day) === wk(d) && g.meal === m && normCategory(g.cat) === 'Entrees')
        count[byId.get(g.recipeId)?.balance ?? ''] = (count[byId.get(g.recipeId)?.balance ?? ''] ?? 0) + 1;
    let best: string | null = null;
    let gap = 0;
    for (const [k, v] of Object.entries(t)) if (v - (count[k] ?? 0) > gap) [best, gap] = [k, v - (count[k] ?? 0)];
    return best;
  };
  const placements: GridEntry[] = [];
  for (let d = 1; d <= c.len; d++) {
    ['Lunch', 'Dinner'].forEach((m, mi) => {
      for (const [cat, n] of NEED) {
        let have = at(d, m, cat).length;
        while (have < n) {
          const U = used.get(wk(d)) ?? new Set<string>();
          used.set(wk(d), U);
          let pick: string | null = null;
          if (cat === 'Starters') pick = at(d, mi ? 'Lunch' : 'Dinner', 'Starters')[0]?.recipeId ?? null;
          if (!pick) {
            const L = P.get(cat)!;
            const near = new Set([...at(d - 1, null, cat), ...at(d + 1, null, cat)].map((g) => g.recipeId));
            const other = at(d, m, 'Entrees').map((g) => byId.get(g.recipeId)?.balance);
            const start = (d * 7 + mi * 3 + have) % Math.max(1, L.length);
            const want = cat === 'Entrees' ? neededProtein(d, m) : null;
            for (let pass = want ? 0 : 1; pass < 2 && !pick; pass++) {
              for (let i = 0; i < L.length && !pick; i++) {
                const r = L[(start + i) % L.length];
                if (U.has(r.id) || near.has(r.id) || c.holidayOnly.has(r.id) || !fits(r, m)) continue;
                if (cat === 'Entrees' && ((r.balance && other.includes(r.balance)) || (!pass && r.balance !== want))) continue;
                pick = r.id;
              }
            }
          }
          if (!pick) break;
          const g: GridEntry = {
            id: c.newId(),
            menuId: M,
            recipeId: pick,
            day: d,
            meal: m as GridEntry['meal'],
            cat: cat as GridEntry['cat'],
            sort: 800 + placements.length,
          };
          placements.push(g);
          all.push(g);
          U.add(pick);
          have++;
        }
      }
    });
  }
  if (!placements.length) return null;
  const sides: Array<[number, string, string[]]> = [];
  for (const g of placements.filter((x) => x.cat === 'Entrees')) {
    const taken = new Set(
      at(g.day, g.meal, 'Entrees')
        .filter((e) => e !== g)
        .flatMap((e) => c.sidesOf(g.day, e.recipeId))
        .concat(sides.filter((x) => x[0] === g.day).flatMap((x) => x[2])),
    );
    const sd = at(g.day, g.meal, 'Sides').find((x) => !taken.has(x.recipeId));
    if (sd) sides.push([g.day, g.recipeId, [sd.recipeId]]);
  }
  return { op: 'add', placements, sides };
}

/** The season a menu is for, from its quarter. */
export function seasonOfQuarter(quarter: string): Season {
  const q = /^Q([1-4])/.exec(quarter)?.[1];
  return q === '1' ? 'Winter' : q === '2' ? 'Spring' : q === '3' ? 'Summer' : 'Fall';
}
