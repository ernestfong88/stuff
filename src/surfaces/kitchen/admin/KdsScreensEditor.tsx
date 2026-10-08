import { useState } from 'react';
import { looseSubcategories, MAX_SCREENS, renameScreen, resizeScreens } from '../../../domain/kdsScreens';
import { groupLabel, KDS_GROUPS, SUBCATEGORIES } from '../../../domain/subcategories';
import { kitchenHasExpo, kitchenScreens, setKitchenExpo, setKitchenScreens, type VenueSettings } from '../../../store/venueSettings';
import { CheckList, SettingSelect } from '../../backoffice/kit/SettingControls';
import s from './KdsScreensEditor.module.css';

const COUNTS = Array.from({ length: MAX_SCREENS }, (_, i) => ({ id: String(i + 1), label: i ? `${i + 1} screens` : '1 screen' }));
const YES_NO = [
  { id: 'yes', label: 'Yes' },
  { id: 'no', label: 'No' },
] as const;
const GROUPS = KDS_GROUPS.map((g) => ({ title: groupLabel(g), options: SUBCATEGORIES[g].map((sub) => ({ id: g + '|' + sub, label: sub })) }));

/**
 * KDS screens of a kitchen: how many, their names, which subcategories each
 * shows, and whether the kitchen has an expo station. One screen is edited at
 * a time, picked from a dropdown. A venue that cooks in another venue's
 * kitchen just says so.
 */
export function KdsScreensEditor({ settings, room, ownerName }: { settings: VenueSettings; room: string; ownerName: string | null }) {
  const screens = kitchenScreens(settings, room);
  const [picked, setPicked] = useState(0);
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
  const i = Math.min(picked, screens.length - 1);
  const screen = screens[i];
  return (
    <div>
      <h3 className={s.head}>KDS screens</h3>
      <div className={s.settings}>
        <label className={s.setting}>
          <span className={s.settingLabel}>Screens in this kitchen</span>
          <SettingSelect
            label="Screens in this kitchen"
            value={String(screens.length)}
            options={COUNTS}
            onChange={(n) => save(resizeScreens(screens, Number(n)))}
          />
        </label>
        <label className={s.setting}>
          <span className={s.settingLabel}>Expo screen</span>
          <SettingSelect label="Expo screen" value={expo ? 'yes' : 'no'} options={YES_NO} onChange={(v) => setKitchenExpo(room, v === 'yes')} />
        </label>
      </div>
      <div className={s.screen}>
        <div className={s.settings}>
          {screens.length > 1 && (
            <label className={s.setting}>
              <span className={s.settingLabel}>Screen</span>
              <SettingSelect
                label="Screen to edit"
                value={String(i)}
                options={screens.map((x, j) => ({ id: String(j), label: `${j + 1}. ${x.name || 'Screen ' + (j + 1)}` }))}
                onChange={(v) => setPicked(Number(v))}
              />
            </label>
          )}
          <label className={s.setting}>
            <span className={s.settingLabel}>Name</span>
            <input
              className={s.nameInput}
              value={screen.name}
              placeholder="Hot, Cold, Grill..."
              aria-label={`Screen ${i + 1} name`}
              onChange={(e) => save(renameScreen(screens, i, e.target.value))}
            />
          </label>
        </div>
        {screens.length > 1 && (
          <CheckList
            label={`Shown on ${screen.name || 'screen ' + (i + 1)}`}
            groups={GROUPS}
            value={screen.subs}
            onChange={(subs) => save(screens.map((x, j) => (j === i ? { ...x, subs } : x)))}
          />
        )}
      </div>
      {loose.length > 0 && (
        <p className={s.loose}>
          Not ticked anywhere, so they go to {screens[0].name || 'screen 1'}: {loose.map((k) => k.split('|')[1]).join(', ')}.
        </p>
      )}
    </div>
  );
}
