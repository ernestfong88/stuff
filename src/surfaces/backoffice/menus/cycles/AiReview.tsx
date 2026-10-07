import { useMemo, useState, type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { uid } from '../../../../lib/id';
import type { BoMenu } from '../../../../store/menuEdits';
import { Button, Chip, cx, toast } from '../../../../ui';
import { AI, AI_MENU_ID, HOLIDAY_ONLY, PROPOSED_RECIPES, PROTEIN_TARGET, SEASON_NOTES, inSeasonSet, type AiSuggestion } from '../aiData';
import { getBo, placementSides, updateBo, useBo } from '../data';
import { useRecipeScores } from '../feedback';
import { aiCheck, aiFill, applyOps, seasonOfQuarter, SEASONS, undoOps, type AiFinding, type AiOp, type AiUndo, type Season } from '../model/aiReview';
import { dishLong } from '../model/categories';
import { Select } from '../ui/controls';
import { ScoreChip } from '../ui/recipeBits';
import s from './AiReview.module.css';

/** A spot on the grid the review points at. */
export interface AiHighlight {
  day: number;
  meal?: string;
}

type Tab = 'sug' | 'var' | 'past' | 'reg' | 'weak' | 'fb' | 'season';

const TYPES: Record<string, [string, string]> = {
  regionalSwap: ['Nearby community', 'info'],
  pastFeedback: ['Last season', 'plum'],
  removeWeak: ['Weak item', 'danger'],
  season: ['Season', 'warning'],
  variety: ['Variety', 'success'],
  holidayTiming: ['Holiday', 'warning'],
};
const SEV: Record<string, ['danger' | 'warning' | 'neutral', string]> = {
  high: ['danger', 'High'],
  medium: ['warning', 'Medium'],
  low: ['neutral', 'Low'],
};

function statsText(st: Record<string, unknown> | undefined): string[] {
  if (!st) return [];
  const o: string[] = [];
  const num = (k: string) => st[k] as number | undefined;
  if (st.community) {
    if (num('score') != null) o.push(`${num('score')}/5${num('ratings') ? ' · ' + num('ratings') + ' ratings' : ''}`);
    if (num('ordersPerRun')) o.push(`${num('ordersPerRun')} orders a run`);
    if (num('runs')) o.push(`${num('runs')} runs at ${st.community}`);
    const rep = st.replacing as { score: number; orders: number } | undefined;
    if (rep) o.push(`Replacing ${rep.score}/5 on ${rep.orders} orders`);
  } else if (st.current || st.suggested) {
    const c = st.current as { score: number; orders: number } | undefined;
    const g = st.suggested as { score: number; orders: number } | undefined;
    if (c) o.push(`Now ${c.score}/5, ${c.orders} orders`);
    if (g) o.push(`Suggested ${g.score}/5, ${g.orders} orders`);
  } else if (st.lastSeason && typeof st.lastSeason === 'object') {
    const l = st.lastSeason as { score: number; orders?: number };
    o.push(`${l.score}/5 last season`);
    if (l.orders) o.push(`${l.orders} orders`);
  } else if (num('score') != null) {
    o.push(`${num('score')}/5`);
    if (num('orders')) o.push(`${num('orders')} orders`);
  }
  if (num('count') && num('week')) o.push(`${num('count')} times in week ${num('week')}`);
  if (st.holiday) o.push(`${st.holiday} is in week ${num('holidayWeek')}`);
  return o;
}

function quoteOf(st: Record<string, unknown> | undefined): string {
  if (!st) return '';
  const q = st.quote ?? (st.lastSeason as { quote?: string } | undefined)?.quote ?? (st.current as { quote?: string } | undefined)?.quote;
  return typeof q === 'string' ? q : '';
}

/**
 * AI menu review: the variety check, last season's results, nearby
 * communities' winners, weak items, resident feedback and season notes,
 * with one-tap changes that can be undone.
 */
export function AiReview({ menu: m, len, onGo }: { menu: BoMenu; len: number; onGo: (t: AiHighlight) => void }) {
  const bo = useBo();
  const vt = m.id === AI_MENU_ID;
  const [open, setOpen] = useState(vt);
  const [tab, setTab] = useState<Tab>(vt ? 'sug' : 'var');
  const [season, setSeason] = useState<Season>(seasonOfQuarter(m.quarter));
  const [type, setType] = useState('all');
  const [done, setDone] = useState<Record<string, AiUndo & { fill?: number }>>({});
  const scoreOf = useRecipeScores(bo.recipes);
  const recipes = useMemo(() => new Map(bo.recipes.map((r) => [r.id, r])), [bo.recipes]);
  const S = vt ? AI.suggestions : [];
  const findings = useMemo(
    () => aiCheck({ menuId: m.id, grid: bo.grid, recipes, len, season, target: PROTEIN_TARGET, pastSeason: vt ? AI.pastSeason.items : [], scoreOf }),
    [m.id, bo.grid, recipes, len, season, vt, scoreOf],
  );
  const name = (id: string) => dishLong(recipes.get(id)?.name ?? PROPOSED_RECIPES.find((r) => r.id === id)?.name ?? id);
  const liveWeak = findings.filter((f) => f.live);
  const fbRows = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ id: string; day: number; meal: string; sc: NonNullable<ReturnType<typeof scoreOf>> }> = [];
    for (const g of bo.grid) {
      if (g.menuId !== m.id || !(g.day > 0 && g.day <= len) || seen.has(g.recipeId)) continue;
      seen.add(g.recipeId);
      const r = recipes.get(g.recipeId);
      const sc = r && scoreOf(r);
      if (sc && sc.n) out.push({ id: g.recipeId, day: g.day, meal: g.meal, sc });
    }
    return out.sort((a, b) => a.sc.score - b.sc.score);
  }, [bo.grid, m.id, len, recipes, scoreOf]);

  const run = (key: string, ops: AiOp[], anyDaySides: string[] = []): boolean => {
    const st = getBo();
    const res = applyOps(
      ops,
      { menuId: m.id, grid: st.grid, sides: st.sides, sidesOf: (d, rid) => placementSides(st, m.id, d, rid).sides, newId: () => uid('g') },
      anyDaySides,
    );
    if (!res) return false;
    const missing = res.needs
      .filter((id) => !st.recipes.some((r) => r.id === id))
      .map((id) => PROPOSED_RECIPES.find((r) => r.id === id))
      .filter((r) => !!r);
    updateBo((x) => ({ grid: res.grid, sides: res.sides, recipes: missing.length ? [...x.recipes, ...missing] : x.recipes }));
    setDone((d) => ({ ...d, [key]: res.undo }));
    return true;
  };
  const undo = (key: string) => {
    const u = done[key];
    if (!u) return;
    updateBo((x) => undoOps(u, m.id, x.grid, x.sides));
    setDone((d) => {
      const n = { ...d };
      delete n[key];
      return n;
    });
    toast('Undone');
  };
  const apply = (sg: AiSuggestion) => {
    if (!run(sg.id, sg.ops, sg.anyDaySides)) toast('That spot on the menu has changed, so this suggestion no longer fits', { tone: 'warning' });
    else toast(`${sg.action} · ${sg.title}`, { tone: 'success' });
  };
  const remove = (rid: string, day: number, meal: string) => {
    if (!run('rm|' + rid, [{ op: 'rm', day, meal, rid }])) toast(`${name(rid)} is no longer on day ${day}`, { tone: 'warning' });
    else toast(`Removed ${name(rid)} from day ${day}. Fill from recipe book puts something in its place.`);
  };
  const fill = () => {
    const st = getBo();
    const op = aiFill({
      menuId: m.id,
      grid: st.grid,
      recipes: st.recipes,
      len,
      season,
      target: PROTEIN_TARGET,
      inSeason: inSeasonSet(season),
      holidayOnly: HOLIDAY_ONLY,
      sidesOf: (d, rid) => placementSides(st, m.id, d, rid).sides,
      newId: () => uid('g'),
    });
    if (!op || op.op !== 'add') {
      toast('No empty slots to fill. Remove a dish first, or add days to the cycle.');
      return;
    }
    const key = 'fill' + uid();
    run(key, [op]);
    setDone((d) => ({ ...d, [key]: { ...d[key], fill: op.placements.length } }));
    toast(`Filled ${op.placements.length} empty slot${op.placements.length > 1 ? 's' : ''} from the recipe book`, { tone: 'success' });
  };
  const lastFill = Object.keys(done)
    .filter((k) => k.startsWith('fill'))
    .slice(-1)[0];
  const applied = S.filter((x) => done[x.id]).length;

  const go = (t: AiHighlight | undefined, text: string) =>
    t?.day ? (
      <button className={s.link} onClick={() => onGo(t)}>
        {text}
      </button>
    ) : null;
  const act = (sg: AiSuggestion, label?: string) =>
    done[sg.id] ? (
      <span className={s.applied}>
        <Chip tone="success">✓ Applied</Chip>
        <Button size="sm" variant="ghost" onClick={() => undo(sg.id)}>
          Undo
        </Button>
      </span>
    ) : (
      <Button size="sm" variant="primary" onClick={() => apply(sg)}>
        {label ?? sg.action}
      </Button>
    );
  const rmButton = (rid: string, day: number, meal: string) =>
    done['rm|' + rid] ? (
      <span className={s.applied}>
        <Chip tone="success">✓ Removed</Chip>
        <Button size="sm" variant="ghost" onClick={() => undo('rm|' + rid)}>
          Undo
        </Button>
      </span>
    ) : (
      <Button size="sm" onClick={() => remove(rid, day, meal)}>
        Remove
      </Button>
    );
  const related = (f: AiFinding) =>
    S.filter((x) => {
      const cur = x.currentItem?.recipe;
      return (
        (f.rec && cur === f.rec && (f.rule !== 'repeat' || !f.week || x.target.week === f.week)) ||
        (f.rule === 'protein' && x.stats?.group && x.stats.week === f.week && /Dinner/.test(x.target.meal ?? '') === (f.meal === 'Dinner')) ||
        (f.rule === 'pasta' && x.target.day === f.day && x.type === 'variety')
      );
    });
  const byRecipe = (rid: string) => S.filter((x) => x.currentItem?.recipe === rid || x.suggestedItem?.recipe === rid);
  const actions = (list: AiSuggestion[]) =>
    list.length ? (
      <div className={s.acts}>
        {list.map((x) => (
          <span key={x.id}>{act(x, `${x.action}: ${x.suggestedItem?.name ?? x.title}`)}</span>
        ))}
      </div>
    ) : null;
  const row = (key: string, children: ReactNode) => (
    <div key={key} className={s.row}>
      {children}
    </div>
  );
  const score = (v: number) => <Chip tone={v >= 4.3 ? 'success' : v < 3.5 ? 'danger' : 'warning'}>{v}/5</Chip>;

  const tabs: Array<[Tab, string, number | null]> = vt
    ? [
        ['sug', 'Suggestions', S.length - applied],
        ['var', 'Variety check', findings.length],
        ['past', 'Last season', AI.pastSeason.items.length],
        ['reg', 'Other communities', AI.regional.ideas.length],
        ['weak', 'Weak items', AI.weakItems.length + liveWeak.length],
        ['fb', 'Resident feedback', fbRows.length],
        ['season', 'Season notes', null],
      ]
    : [
        ['var', 'Variety check', findings.length],
        ['fb', 'Resident feedback', fbRows.length],
        ['season', 'Season notes', null],
      ];

  let body: ReactNode = null;
  if (tab === 'sug') {
    const list = S.filter((x) => type === 'all' || x.type === type);
    body = (
      <>
        <div className={s.filters}>
          {[
            ['all', 'All'] as [string, string],
            ...Object.keys(TYPES)
              .filter((k) => S.some((x) => x.type === k))
              .map((k) => [k, TYPES[k][0]] as [string, string]),
          ].map(([k, t]) => (
            <button key={k} aria-pressed={type === k} className={cx(s.filter, type === k && s.filterOn)} onClick={() => setType(k)}>
              {t} {k === 'all' ? S.length : S.filter((x) => x.type === k).length}
            </button>
          ))}
        </div>
        {list.map((x) => {
          const q = quoteOf(x.stats);
          return row(
            x.id,
            <>
              <div className={s.cardHead}>
                <Chip tone={(TYPES[x.type]?.[1] ?? 'neutral') as 'info'}>{TYPES[x.type]?.[0] ?? 'Suggestion'}</Chip>
                <span className={s.cardTitle}>{x.title}</span>
                {act(x)}
              </div>
              <div className={s.cardWhere}>
                {go(
                  { day: x.target.day, meal: x.target.meal },
                  [
                    `Week ${x.target.week}`,
                    x.target.date
                      ? new Date(x.target.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                      : `Day ${x.target.day}`,
                    x.target.meal,
                  ]
                    .filter(Boolean)
                    .join(' · '),
                )}
                <span>
                  {x.currentItem?.name ?? ''}
                  {x.suggestedItem?.name ? ' → ' : ''}
                  <b>{x.suggestedItem?.name ?? ''}</b>
                  {x.suggestedItem?.isNew ? ` (new recipe, from ${String(x.suggestedItem.source ?? '').replace(/ \(.*\)$/, '')})` : ''}
                  {x.newDefaultSides?.length ? ` with ${x.newDefaultSides.map((d) => d.name).join(' and ')}` : ''}
                  {x.moveTo ? `; it moves to Week ${x.moveTo.week} · Day ${x.moveTo.day} in place of ${x.moveTo.replaces.name}` : ''}
                </span>
              </div>
              <p className={s.reason}>{x.reason}</p>
              <div className={s.stats}>
                {statsText(x.stats).map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
                {q && <span className={s.quote}>“{q}”</span>}
              </div>
            </>,
          );
        })}
      </>
    );
  } else if (tab === 'var') {
    body = findings.length ? (
      findings.map((f) =>
        row(
          f.id,
          <>
            <div className={s.cardHead}>
              <Chip tone={SEV[f.sev][0]}>{SEV[f.sev][1]}</Chip>
              <span className={s.msg}>{f.msg}</span>
              {f.day ? go({ day: f.day, meal: f.meal }, `Day ${f.day}`) : null}
            </div>
            {actions(related(f))}
            {f.live && f.rec && f.day && <div className={s.acts}>{rmButton(f.rec, f.day, f.meal ?? 'Lunch')}</div>}
          </>,
        ),
      )
    ) : (
      <p className={s.muted}>No variety issues for {season}. Every week passes the checks.</p>
    );
  } else if (tab === 'past') {
    body = (
      <>
        <p className={s.muted}>
          {AI.pastSeason.menu} · {AI.pastSeason.source}.
        </p>
        {fbRows.length > 0 && (
          <p className={s.muted}>
            Also reading this season&apos;s resident feedback: {fbRows.length} dishes on this menu have linked comments
            {liveWeak.length ? `, and ${liveWeak.length} ${liveWeak.length === 1 ? 'scores' : 'score'} below 3.2` : ''}.{' '}
            <button className={s.link} onClick={() => setTab('fb')}>
              See Resident feedback
            </button>
          </p>
        )}
        {AI.pastSeason.items.map((it) =>
          row(
            it.recipe,
            <>
              <div className={s.cardHead}>
                <span className={s.cardTitle}>{it.dish}</span>
                {score(it.score)}
                <span className={s.muted}>
                  {it.ratings} ratings · {it.orders} orders · {it.ordersPerRun} a run over {it.runs} runs · trend {it.trend}
                </span>
                {(it.onDraft ?? []).map((o, i) => (
                  <span key={i}>{go({ day: o.day, meal: o.meal }, `Day ${o.day} ${o.meal.toLowerCase()}`)}</span>
                ))}
              </div>
              {(it.quotes ?? []).map((q, i) => (
                <p key={i} className={s.reason}>
                  <i>“{q.text}”</i> <span className={s.muted}>· {q.from}</span>
                </p>
              ))}
              <p className={s.reason}>{it.takeaway}</p>
              {actions(byRecipe(it.recipe))}
            </>,
          ),
        )}
      </>
    );
  } else if (tab === 'reg') {
    body = (
      <>
        <p className={s.muted}>
          {AI.regional.region} · {AI.regional.note}
        </p>
        {AI.regional.ideas.map((it) =>
          row(
            it.proposedRecipe,
            <>
              <div className={s.cardHead}>
                <span className={s.cardTitle}>{it.dish}</span>
                <Chip tone="info">{it.community}</Chip>
                {score(it.score)}
                <span className={s.muted}>
                  {it.ratings} ratings · {it.ordersPerRun} orders a run · {it.runs} runs
                </span>
              </div>
              <p className={s.reason}>{it.why}</p>
              <p className={s.reason}>
                Would replace <b>{it.wouldReplace.name}</b> on {go({ day: it.day, meal: it.meal }, `day ${it.day} ${it.meal.toLowerCase()}`)}
              </p>
              {actions(S.filter((x) => x.suggestedItem?.recipe === it.proposedRecipe))}
            </>,
          ),
        )}
      </>
    );
  } else if (tab === 'weak') {
    body = (
      <>
        {AI.weakItems.map((w) => {
          const sg = S.find((x) => x.id === w.suggestion);
          const o = w.onDraft?.[0];
          return row(
            w.recipe,
            <>
              <div className={s.cardHead}>
                <span className={s.cardTitle}>{w.dish}</span>
                {score(w.score)}
                <span className={s.muted}>{w.orders} orders last season</span>
                {o && go({ day: o.day, meal: o.meal }, `Day ${o.day} ${o.meal.toLowerCase()}`)}
              </div>
              <div className={s.acts}>
                {sg && !done['rm|' + w.recipe] && act(sg, `${sg.action}: ${sg.suggestedItem?.name ?? sg.title}`)}
                {!(sg && done[sg.id]) && o && rmButton(w.recipe, o.day, o.meal)}
              </div>
            </>,
          );
        })}
        {liveWeak.map((f) =>
          row(
            'lw' + f.rec,
            <>
              <div className={s.cardHead}>
                <span className={s.cardTitle}>{name(f.rec!)}</span>
                <Chip tone="plum">From resident feedback</Chip>
                {go({ day: f.day!, meal: f.meal }, `Day ${f.day} ${(f.meal ?? '').toLowerCase()}`)}
              </div>
              <p className={s.reason}>{f.msg}</p>
              <div className={s.acts}>{rmButton(f.rec!, f.day!, f.meal ?? 'Lunch')}</div>
            </>,
          ),
        )}
      </>
    );
  } else if (tab === 'fb') {
    body = fbRows.length ? (
      <>
        <p className={s.muted}>Lowest scores first.</p>
        {fbRows.map((x) => {
          const q = (x.sc.score < 3.5 && x.sc.feedback.find((f) => f.sent === 'neg')) || x.sc.feedback[0];
          return row(
            x.id,
            <>
              <div className={s.cardHead}>
                <span className={s.cardTitle}>{name(x.id)}</span>
                <ScoreChip sc={x.sc} />
                <span className={s.muted}>
                  {x.sc.pos} positive · {x.sc.neu} neutral · {x.sc.neg} negative{x.sc.sales ? ` · ${x.sc.sales.orders} orders` : ''}
                </span>
                {go({ day: x.day, meal: x.meal }, `Day ${x.day} ${x.meal.toLowerCase()}`)}
              </div>
              {q && (
                <p className={s.reason}>
                  <i>“{q.text}”</i> <span className={s.muted}>· {q.who}</span>
                </p>
              )}
              {x.sc.score < 3.2 && <div className={s.acts}>{rmButton(x.id, x.day, x.meal)}</div>}
            </>,
          );
        })}
      </>
    ) : (
      <p className={s.muted}>No resident feedback is linked to dishes on this menu yet.</p>
    );
  } else if (season === 'Winter' && vt) {
    const N = AI.seasonNotes;
    body = (
      <>
        {row(
          'light',
          <>
            <div className={s.label}>Too light for December</div>
            {N.tooLight.map((t, i) => (
              <p key={i} className={s.reason}>
                {go({ day: t.day, meal: t.meal }, `Day ${t.day} ${t.meal.toLowerCase()}`)}: {t.item}. {t.why}
              </p>
            ))}
          </>,
        )}
        {row(
          'lean',
          <>
            <div className={s.label}>Produce to lean on</div>
            {N.leanOn.map((t, i) => (
              <p key={i} className={s.lean}>
                <b>{t.produce}</b> <span className={s.muted}>{t.peak}</span> <Chip>{t.onDraft} on this menu</Chip>{' '}
                <span className={s.muted}>{t.examples.join(', ')}</span>
              </p>
            ))}
          </>,
        )}
        {row(
          'cold',
          <>
            <div className={s.label}>Cold special sides each week</div>
            <div className={s.bars}>
              {N.coldSidesByWeek.map((c) => (
                <span key={c.week} className={s.barCol}>
                  <span className={s.bar} style={{ height: c.coldSpecialSides * 6 }} />W{c.week} · {c.coldSpecialSides}
                </span>
              ))}
            </div>
          </>,
        )}
        {row(
          'obs',
          <>
            <div className={s.label}>Notes</div>
            {N.observations.map((t, i) => (
              <p key={i} className={s.reason}>
                {t}
              </p>
            ))}
          </>,
        )}
      </>
    );
  } else {
    const n = SEASON_NOTES[season === 'Winter' ? 'Fall' : season];
    body = (
      <>
        {row(
          'lean',
          <>
            <div className={s.label}>Produce to lean on in {season.toLowerCase()}</div>
            {n.lean.map(([p, when]) => (
              <p key={p} className={s.lean}>
                <b>{p}</b> <span className={s.muted}>{when}</span>
              </p>
            ))}
          </>,
        )}
        {row(
          'obs',
          <>
            <div className={s.label}>Notes</div>
            {n.obs.map((t) => (
              <p key={t} className={s.reason}>
                {t}
              </p>
            ))}
          </>,
        )}
      </>
    );
  }

  const head = vt ? AI.summary.headline : '';
  return (
    <section className={s.card} aria-label="AI menu review">
      <div className={s.top}>
        <span className={s.title}>
          <Sparkles size={15} aria-hidden /> AI menu review
        </span>
        <Chip tone={findings.length ? 'warning' : 'success'}>
          {findings.length ? `${findings.length} finding${findings.length > 1 ? 's' : ''} left` : 'No findings'}
        </Chip>
        {vt && (
          <Chip>
            {applied} of {S.length} suggestions applied
          </Chip>
        )}
        <span className={s.head}>{open ? '' : head}</span>
        <Select
          size="sm"
          value={season}
          onChange={(v) => setSeason(v as Season)}
          options={SEASONS.map((x) => ({ value: x, label: x }))}
          aria-label="Season"
        />
        <Button size="sm" onClick={fill}>
          Fill from recipe book
        </Button>
        {lastFill && (
          <Button size="sm" variant="ghost" onClick={() => undo(lastFill)}>
            Undo fill ({done[lastFill].fill})
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide details' : 'Show details'}
        </Button>
      </div>
      {open && (
        <>
          {vt && (
            <p className={s.headline}>
              {head} {AI.disclaimer}
            </p>
          )}
          <div className={s.tabs} role="tablist">
            {tabs.map(([k, t, c]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={cx(s.tab, tab === k && s.tabOn)} onClick={() => setTab(k)}>
                {t}
                {c != null && <span className={s.count}>{c}</span>}
              </button>
            ))}
          </div>
          <div className={s.body}>{body}</div>
        </>
      )}
    </section>
  );
}
