import { Check } from 'lucide-react';
import { cx } from '../../../ui';
import { looseSubcategories, MAX_SCREENS, renameScreen, resizeScreens, toggleSubcategory } from '../../../domain/kdsScreens';
import { groupLabel, KDS_GROUPS, SUBCATEGORIES } from '../../../domain/subcategories';
import { kitchenHasExpo, kitchenScreens, setKitchenExpo, setKitchenScreens, type VenueSettings } from '../../../store/venueSettings';
import s from './KdsScreensEditor.module.css';

/** Segmented choice of a few values. */
function Segmented<T extends string | number | boolean>({ value, options, onChange, label }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void; label: string }) {
  return (
    <span className={s.segmented} role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={String(v)} className={cx(s.seg, v === value && s.segOn)} aria-pressed={v === value} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </span>
  );
}

/**
 * KDS screens of a kitchen: how many, their names, which subcategories each
 * shows, and whether the kitchen has an expo station. A venue that cooks in
 * another venue's kitchen just says so.
 */
export function KdsScreensEditor({ settings, room, ownerName }: { settings: VenueSettings; room: string; ownerName: string | null }) {
  const screens = kitchenScreens(settings, room);
  if (ownerName)
    return (
      <div>
        <h3 className={s.head}>KDS screens</h3>
        <p className={s.muted}>
          Shares the {ownerName.replace(/ Dining Room$/, '')} kitchen: {screens.map((x) => x.name).join(', ')}. Set the screens on {ownerName}.
        </p>
      </div>
    );
  const expo = kitchenHasExpo(settings, room);
  const loose = looseSubcategories(screens);
  const save = (next: typeof screens) => setKitchenScreens(room, next);
  return (
    <div>
      <h3 className={s.head}>KDS screens</h3>
      <div className={s.setting}>
        <span className={s.settingLabel}>Screens in this kitchen</span>
        <Segmented
          label="Screens in this kitchen"
          value={screens.length}
          options={Array.from({ length: MAX_SCREENS }, (_, i) => [i + 1, String(i + 1)] as [number, string])}
          onChange={(n) => save(resizeScreens(screens, n))}
        />
        <span className={s.settingHint}>{screens.length < 2 ? 'One screen shows everything the cook makes.' : 'Each screen shows the subcategories ticked for it.'}</span>
      </div>
      <div className={s.setting}>
        <span className={s.settingLabel}>Expo screen</span>
        <Segmented label="Expo screen" value={expo} options={[[true, 'Yes'], [false, 'No']]} onChange={(v) => setKitchenExpo(room, v)} />
        <span className={s.settingHint}>{expo ? 'Expo runs each course. Servers are told to go get it.' : 'No one on Expo, so servers run each course from My Tables.'}</span>
      </div>
      <div className={s.screens}>
        {screens.map((screen, i) => (
          <div key={i} className={s.screen}>
            <label className={s.screenName}>
              <span className={s.screenNum}>Screen {i + 1}</span>
              <input
                className={s.nameInput}
                value={screen.name}
                placeholder="Hot, Cold, Grill..."
                aria-label={`Screen ${i + 1} name`}
                onChange={(e) => save(renameScreen(screens, i, e.target.value))}
              />
            </label>
            {screens.length < 2 ? (
              <p className={s.muted}>Shows every ticket the cook makes.</p>
            ) : (
              KDS_GROUPS.map((g) => (
                <div key={g} className={s.group}>
                  <div className={s.groupName}>{groupLabel(g)}</div>
                  <div className={s.subs}>
                    {SUBCATEGORIES[g].map((sub) => {
                      const key = g + '|' + sub;
                      const on = screen.subs.includes(key);
                      return (
                        <button key={key} className={cx(s.sub, on && s.subOn)} aria-pressed={on} onClick={() => save(toggleSubcategory(screens, i, key))}>
                          {on && <Check size={12} strokeWidth={3} />}
                          {sub}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        ))}
      </div>
      {loose.length > 0 && (
        <p className={s.loose}>
          Not ticked anywhere, so they go to {screens[0].name || 'screen 1'}: {loose.map((k) => k.split('|')[1]).join(', ')}.
        </p>
      )}
      <p className={s.footnote}>
        A subcategory on two screens shows on both; the first screen to bump it marks it done. What the server makes (set on each venue's Kitchen routing tab) never
        goes to a cook screen. Each cook device picks its screen.
      </p>
    </div>
  );
}
