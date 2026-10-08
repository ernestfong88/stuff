import { useState } from 'react';
import { Check, GlassWater, MessageCircle, Sparkles, Star } from 'lucide-react';
import { getItem, getResident } from '../../../../data';
import { isDrink, isSide, modsText } from '../../../../domain/menu';
import { serverName } from '../../../../domain/servers';
import type { MealName, Resident } from '../../../../domain/types';
import { formatAgo } from '../../../../lib/format';
import { useDiningActions } from '../../../../store/dining';
import { useResidentNotes } from '../../../../store/notes';
import { residentPref, updateResidentPref, useResidentPrefs } from '../../../../store/residentPrefs';
import { conversationStarters, useResidentStory } from '../../../../store/residentStories';
import { Avatar, Button, Chip, TextArea, cx, useNow } from '../../../../ui';
import { MEALS } from '../menu/menuSections';
import { ResidentPills } from './ResidentCard';
import { careLevel, planStatus } from './residentInfo';
import { littleThings } from './littleThings';
import s from './ResidentProfile.module.css';

function Hero({ resident, wide }: { resident: Resident; wide: boolean }) {
  const story = useResidentStory(resident.id);
  const spouse = getResident(resident.spouse);
  const { plan, left, period } = planStatus(resident);
  const side = (
    <div className={s.heroSide}>
      <div>
        <div className={s.cap}>Meal plan</div>
        <div className={s.planName}>{left != null ? plan.label : 'A la carte, no plan'}</div>
        {left != null && (
          <>
            <div className={s.planTrack} aria-hidden>
              <div className={cx(s.planFill, left <= 3 && s.planLow)} style={{ width: `${Math.min(100, (resident.consumed / plan.amt) * 100)}%` }} />
            </div>
            <div className={s.planLeft}>
              <b>{left}</b> left {period}
            </div>
          </>
        )}
      </div>
      {!!resident.contacts?.length && (
        <div>
          <div className={s.cap}>Family</div>
          {resident.contacts.map((c) => (
            <div key={c.name} className={s.contact}>
              <span className={s.contactName}>{c.name}</span>
              <span className={s.contactRel}>{c.rel}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
  return (
    <>
      <section className={cx(s.card, s.hero)}>
        <Avatar person={resident} size={wide ? 160 : 96} className={s.portrait} />
        <div className={s.ident}>
          <div>
            <h2 className={s.name}>{resident.name}</h2>
            <div className={s.sub}>
              Apt {resident.apt} · {careLevel(resident.level)}
              {spouse ? ` · Lives with ${spouse.name.split(' ')[0]}` : ''}
            </div>
          </div>
          <ResidentPills resident={resident} size="md" />
          {story.loves.length > 0 && (
            <div className={s.loves}>
              <span className={s.cap}>Loves</span>
              {story.loves.map((l) => (
                <Chip key={l} size="md" tone="neutral" className={s.love}>
                  {l}
                </Chip>
              ))}
            </div>
          )}
        </div>
        {wide && side}
      </section>
      {!wide && <section className={s.card}>{side}</section>}
    </>
  );
}

function PreferenceCard({ resident }: { resident: Resident }) {
  const prefs = useResidentPrefs();
  const current = residentPref(prefs, resident.id);
  const [draft, setDraft] = useState(current);
  const [saved, setSaved] = useState(false);
  const dirty = draft.trim() !== current.trim();
  const save = () => {
    updateResidentPref(resident.id, draft.trim());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };
  return (
    <section className={s.card}>
      <h3 className={s.h3}>Likes and dislikes</h3>
      <p className={s.hint}>Servers see this first at the table. Update it when something changes.</p>
      <TextArea
        className={s.pref}
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="How they like things"
        aria-label={`Likes and dislikes for ${resident.name}`}
      />
      <div className={s.prefActions}>
        {dirty && (
          <Button variant="secondary" onClick={() => setDraft(current)}>
            Cancel
          </Button>
        )}
        <Button variant={saved ? 'success' : 'primary'} block disabled={!dirty && !saved} onClick={save} icon={saved ? <Check size={15} /> : undefined}>
          {saved ? 'Saved' : 'Save preference'}
        </Button>
      </div>
    </section>
  );
}

function UsualsCard({ resident }: { resident: Resident }) {
  const { learnedFavorites } = useDiningActions();
  const meals = MEALS.map((meal: MealName) => {
    const favs = learnedFavorites(resident.id, meal)
      .map((f) => ({ ...f, item: getItem(f.itemId) }))
      .filter((f) => f.item && !isSide(f.itemId));
    return {
      meal,
      drinks: favs.filter((f) => isDrink(f.itemId)).slice(0, 3),
      food: favs.filter((f) => !isDrink(f.itemId)).slice(0, 3),
    };
  }).filter((m) => m.drinks.length || m.food.length);
  return (
    <section className={s.card}>
      <h3 className={s.h3}>
        <Star size={17} className={s.h3Icon} aria-hidden /> Usuals
      </h3>
      <p className={s.hint}>What they order most, by meal</p>
      {!meals.length && <p className={s.empty}>No orders on record yet. Their usuals show here once they have eaten with us a few times.</p>}
      {meals.map((m, i) => (
        <div key={m.meal} className={cx(s.meal, i > 0 && s.mealDivider)}>
          <div className={cx(s.cap, s.capOcean)}>{m.meal}</div>
          {m.drinks.length > 0 && (
            <div className={s.drinks}>
              {m.drinks.map((d) => (
                <Chip key={d.itemId + JSON.stringify(d.mods)} tone="info" size="md" icon={<GlassWater size={13} aria-hidden />}>
                  {d.item!.name}
                </Chip>
              ))}
            </div>
          )}
          {m.food.map((f) => {
            const mods = modsText(f.mods, f.note);
            return (
              <div key={f.itemId + JSON.stringify(f.mods)} className={s.dish}>
                <div className={s.dishText}>
                  <div className={s.dishName}>{f.item!.name}</div>
                  {mods && <div className={s.dishMods}>{mods}</div>}
                </div>
                {f.n > 1 && <span className={s.times}>×{f.n}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}

function UpdatesCard({ resident }: { resident: Resident }) {
  const notes = useResidentNotes('know', resident.id);
  const story = useResidentStory(resident.id);
  useNow(60_000);
  const things = littleThings(notes, story.goodToKnow).slice(0, 6);
  const starters = conversationStarters(story, resident);
  if (!things.length && !starters.length) return null;
  return (
    <section className={cx(s.card, s.updates)}>
      <h3 className={cx(s.h3, s.h3Plum)}>
        <Sparkles size={17} aria-hidden /> Updates
      </h3>
      {things.length > 0 && (
        <div className={s.block}>
          <div className={cx(s.cap, s.capPlum)}>Little things</div>
          {things.map((t) => (
            <div key={t.text} className={s.thing}>
              <span className={cx(s.dot, t.fresh && s.dotFresh)} aria-hidden />
              <span>
                {t.text}
                {t.fresh && (
                  <span className={s.fresh}>
                    New · {t.by ? serverName(t.by) : 'Staff'} · {formatAgo(t.at)}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      {starters.length > 0 && (
        <div className={s.block}>
          <div className={cx(s.cap, s.capPlum)}>Conversation starters</div>
          <div className={s.starters}>
            {starters.map((q) => (
              <div key={q} className={s.starter}>
                <MessageCircle size={15} className={s.starterIcon} aria-hidden />
                {q}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function StoryCard({ resident }: { resident: Resident }) {
  const story = useResidentStory(resident.id);
  if (!story.background && !story.now) return null;
  return (
    <section className={s.card}>
      <h3 className={s.h3}>Their story</h3>
      {story.background && (
        <div className={s.block}>
          <div className={cx(s.cap, s.capOcean)}>Background</div>
          <p className={s.prose}>{story.background}</p>
        </div>
      )}
      {story.now && (
        <div className={s.block}>
          <div className={cx(s.cap, s.capOcean)}>At the community now</div>
          <p className={s.prose}>{story.now}</p>
        </div>
      )}
    </section>
  );
}

/**
 * A resident's profile: who they are before what they eat. Their story and
 * the little things lead, so a server walks up knowing something; the
 * dining preference stays editable and usuals show for every meal.
 */
export function ResidentProfile({ resident, wide = true }: { resident: Resident; wide?: boolean }) {
  return (
    // Focus lands here when the profile opens, not in the preference box, so the tablet keyboard stays down.
    <div className={s.profile} tabIndex={-1} data-autofocus>
      <Hero resident={resident} wide={wide} />
      <div className={cx(s.columns, wide && s.columnsWide)}>
        <div className={s.column}>
          <PreferenceCard key={resident.id} resident={resident} />
          <UsualsCard resident={resident} />
        </div>
        <div className={s.column}>
          <UpdatesCard resident={resident} />
          <StoryCard resident={resident} />
        </div>
      </div>
    </div>
  );
}
