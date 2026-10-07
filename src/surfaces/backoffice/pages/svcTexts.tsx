/**
 * Text Messages: the wording each community sends, a switch per text, who
 * has no mobile, and every text the demo would have sent. Only what differs
 * from the standard is saved, so the standard wording can change
 * underneath.
 */
import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { COMMUNITY_NAME, residents, rooms } from '../../../data';
import { formatTime } from '../../../lib/format';
import { setSetting } from '../../../store/serviceConfig';
import { Button, Chip, SearchField, TextArea, Toggle, cx, toast } from '../../../ui';
import { useOutbox } from '../../../store/textOutbox';
import { formatPhone, hasMobile, hasMobileByDefault, PHONES } from '../../../domain/pickupService/phones';
import { mobileOverrides, textSettings, useServiceSettings, type TextSetting } from '../../../domain/pickupService/settings';
import { fillText, smsParts, TEXT_DEFINITIONS, TEXT_TAG_LABELS, textBody, textOn, type TextDefinition, type TextKey, type TextTag } from '../../../domain/pickupService/texts';
import { BoPage, BoSection } from '../kit';
import type { BoPageProps } from '../nav';
import s from './svcTexts.module.css';

/** What Eleanor would get: the sample every preview is filled with. */
const SAMPLE: Record<TextTag, string> = {
  first: 'Eleanor',
  name: 'Eleanor Whitfield',
  meal: 'dinner',
  venue: rooms.sequoia?.name ?? 'Sequoia Dining Room',
  apt: '208',
  time: '5:30 PM',
  community: COMMUNITY_NAME,
  date: 'Friday',
  day: 'Friday',
  change: 'Chicken Marsala instead of the Salmon',
  when: 'today, 5:30 to 5:45 PM, pick up at the Sequoia Dining basket',
  items: '- BYO Pizza: Thin Crust, Marinara Base, Pepperoni, Mushrooms\n- Iced Tea',
};

/** Save a text's switch or wording, dropping anything back at the standard. */
function putText(key: TextKey, current: TextSetting | undefined, patch: TextSetting) {
  const next: TextSetting = { ...current, ...patch };
  if (next.on !== false) delete next.on;
  if (next.body === undefined) delete next.body;
  setSetting(`texts.${key}`, Object.keys(next).length ? next : undefined);
}

function TextCard({ def, own }: { def: TextDefinition; own: TextSetting | undefined }) {
  const texts = { [def.key]: own };
  const on = textOn(texts, def.key);
  const body = textBody(texts, def.key);
  const preview = fillText(body, SAMPLE);
  const parts = smsParts(preview);
  const setBody = (v: string) => putText(def.key, own, { body: v === def.body ? undefined : v });
  return (
    <BoSection
      title={def.title}
      sub={def.when + (on ? '' : ' Turned off: nothing is texted and the screens say not texted.')}
      actions={
        <Toggle
          checked={on}
          label={<span className={s.srOnly}>Send the {def.title.toLowerCase()} text</span>}
          onChange={(v) => {
            putText(def.key, own, { on: v ? undefined : false });
            toast(v ? `${def.title} texts are on` : `${def.title} texts are off`);
          }}
        />
      }
    >
      <div className={s.body}>
        <TextArea value={body} rows={2} disabled={!on} aria-label={`${def.title} wording`} className={s.wording} onChange={(e) => setBody(e.target.value)} />
        {on && (
          <>
            <div className={s.tags}>
              <span className={s.tagsLabel}>Add</span>
              {def.tags.map((t) => (
                <button key={t} className={s.tag} title={`Adds {${t}}`} onClick={() => setBody(`${body.replace(/\s+$/, '')} {${t}}`.trim())}>
                  {TEXT_TAG_LABELS[t]}
                </button>
              ))}
              {body !== def.body && (
                <button className={cx(s.tag, s.standard)} onClick={() => putText(def.key, own, { body: undefined })}>
                  Use the standard wording
                </button>
              )}
            </div>
            <div className={s.preview}>
              <div className={s.previewLabel}>What Eleanor would get</div>
              <div className={s.previewText}>{preview || '(empty)'}</div>
              <div className={cx(s.count, parts > 1 && s.countLong)}>
                {preview.length} characters{parts > 1 ? `, sends as ${parts} texts` : ''}
              </div>
            </div>
          </>
        )}
      </div>
    </BoSection>
  );
}

/** Residents with no mobile: their orders work the same, but nothing is texted. */
function NoMobile() {
  const svc = useServiceSettings();
  const mobile = mobileOverrides(svc);
  const [q, setQ] = useState('');
  const list = residents.filter((r) => r.id && r.name);
  const term = q.trim().toLowerCase();
  const shown = list.filter((r) => !term || r.name.toLowerCase().includes(term) || r.apt.toLowerCase().includes(term)).sort((a, b) => a.name.localeCompare(b.name));
  const none = list.filter((r) => !hasMobile(mobile, r.id)).length;
  const set = (id: string, name: string, v: boolean) => {
    setSetting(`mobile.${id}`, v === hasMobileByDefault(id) ? undefined : v);
    toast(v ? `Texts go to ${name.split(' ')[0]} again` : `No texts for ${name.split(' ')[0]}; screens say no mobile`);
  };
  return (
    <BoSection
      title="Residents without a mobile"
      sub="Their orders go through the same way. Nothing is texted to them, and the pick up, delivery and expo screens say no mobile instead of texted, so staff let them know another way."
      actions={<Chip tone={none ? 'warning' : 'neutral'}>{none === 1 ? '1 resident' : `${none} residents`}</Chip>}
    >
      <div className={s.search}>
        <SearchField value={q} onChange={setQ} placeholder="Search residents or apartments" />
      </div>
      <ul className={s.people}>
        {shown.map((r) => {
          const has = hasMobile(mobile, r.id);
          const p = PHONES[r.id] ?? {};
          const line = has ? `Gets texts${p.m ? ` at ${formatPhone(p.m)}` : ''}` : p.h ? `Home phone only, ${formatPhone(p.h)}` : 'No mobile';
          return (
            <li key={r.id} className={s.person}>
              <div className={s.personText}>
                <div className={s.personName}>{r.name}</div>
                <div className={cx(s.personLine, !has && s.personNone)}>
                  {r.apt ? `Apt ${r.apt} · ` : ''}
                  {line}
                </div>
              </div>
              <Toggle checked={has} label={<span className={s.srOnly}>{r.name} has a mobile</span>} onChange={(v) => set(r.id, r.name, v)} />
            </li>
          );
        })}
      </ul>
      {!shown.length && <p className={s.empty}>No resident matches “{q}”.</p>}
    </BoSection>
  );
}

/** Every text the demo would have sent, newest first. */
function Outbox() {
  const sent = useOutbox();
  return (
    <BoSection
      title="Sent from this demo"
      sub="The demo has no texting service, so nothing leaves this page. Each text the demo would have sent is kept here."
      actions={<Chip>{sent.length === 1 ? '1 text' : `${sent.length} texts`}</Chip>}
    >
      {sent.length ? (
        <ul className={s.outbox}>
          {sent.map((m) => (
            <li key={m.id} className={s.sent}>
              <div className={s.sentMeta}>
                {formatTime(m.at)} · to {formatPhone(m.to)}
                {m.name ? ` (${m.name})` : ''} · {m.status === 'simulated' ? 'not really sent (demo)' : m.status}
              </div>
              <div className={s.sentBody}>{m.body}</div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.empty}>Nothing yet. Place an order at the Resident Kiosk as someone with a mobile, and the text shows up here.</p>
      )}
    </BoSection>
  );
}

/** Text Messages: What residents and associates get by text. */
export default function Page(_props: BoPageProps) {
  const texts = textSettings(useServiceSettings());
  const edited = Object.values(texts).some((t) => t && (t.on === false || typeof t.body === 'string'));
  return (
    <BoPage
      title="Text Messages"
      sub={`What ${COMMUNITY_NAME} sends by text. Each community writes its own wording; a change goes out with the next text.`}
      actions={
        edited && (
          <Button
            variant="ghost"
            icon={<RotateCcw size={14} />}
            onClick={() => {
              setSetting('texts', {});
              toast('Every text is back to the standard wording and turned on');
            }}
          >
            Reset to standard wording
          </Button>
        )
      }
    >
      {TEXT_DEFINITIONS.map((d) => (
        <TextCard key={d.key} def={d} own={texts[d.key]} />
      ))}
      <NoMobile />
      <Outbox />
    </BoPage>
  );
}
