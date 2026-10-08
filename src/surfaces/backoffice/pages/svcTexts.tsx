/**
 * Text Messages: the wording each community sends, a switch per text, who
 * has no mobile, and every text the demo would have sent. Only what differs
 * from the standard is saved, so the standard wording can change
 * underneath.
 */
import { useRef, useState } from 'react';
import { COMMUNITY_NAME, residents, rooms } from '../../../data';
import { formatTime } from '../../../lib/format';
import { setSetting } from '../../../store/serviceConfig';
import { Chip, SearchField, Tabs, TextArea, Toggle, cx, toast } from '../../../ui';
import { useOutbox } from '../../../store/textOutbox';
import { formatPhone, hasMobile, hasMobileByDefault, PHONES } from '../../../domain/pickupService/phones';
import { mobileOverrides, textSettings, useServiceSettings, type TextSetting } from '../../../domain/pickupService/settings';
import { fillText, smsParts, TEXT_DEFINITIONS, TEXT_TAG_LABELS, textBody, textOn, type TextDefinition, type TextKey, type TextTag } from '../../../domain/pickupService/texts';
import { BoPage, BoSection, BoTabbedPage } from '../kit';
import { ConfirmReset } from './ConfirmReset';
import { useHubTab, usePageTab } from './pageTab';
import BroadcastsPage from './broadcasts';
import { insertTag, unknownTags } from './textTags';
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
  const box = useRef<HTMLTextAreaElement>(null);
  const texts = { [def.key]: own };
  const on = textOn(texts, def.key);
  const body = textBody(texts, def.key);
  // Fill only what this text really knows, so the preview never shows an apartment a pick up text can't have.
  const preview = fillText(body, Object.fromEntries(def.tags.map((k) => [k, SAMPLE[k]])));
  const parts = smsParts(preview);
  const unknown = unknownTags(body, def.tags);
  // A cleared box stays on screen as typed but isn't saved: an empty text would go out blank.
  const [blank, setBlank] = useState<string | null>(null);
  const setBody = (v: string) => {
    if (!v.trim()) return setBlank(v);
    setBlank(null);
    putText(def.key, own, { body: v === def.body ? undefined : v });
  };
  const addTag = (tag: TextTag) => {
    const el = box.current;
    const next = insertTag(body, tag, el?.selectionStart ?? body.length, el?.selectionEnd ?? body.length);
    setBody(next.body);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.cursor, next.cursor);
    });
  };
  const restoreStandard = () => {
    const before = own?.body;
    putText(def.key, own, { body: undefined });
    toast(`${def.title} is back to the standard wording`, { action: { label: 'Undo', onClick: () => putText(def.key, { ...own, body: undefined }, { body: before }) } });
  };
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
        <TextArea
          ref={box}
          value={blank ?? body}
          rows={2}
          disabled={!on}
          aria-label={`${def.title} wording`}
          className={s.wording}
          onChange={(e) => setBody(e.target.value)}
          onBlur={() => setBlank(null)}
        />
        {blank != null && (
          <p className={s.warn} role="alert">
            A text can&apos;t be empty, so the last wording is kept. Type the new wording, or use the standard one.
          </p>
        )}
        {on && (
          <>
            <div className={s.tags}>
              <span className={s.tagsLabel}>Add</span>
              {def.tags.map((t) => (
                <button key={t} className={s.tag} title={`Adds {${t}}`} onClick={() => addTag(t)}>
                  {TEXT_TAG_LABELS[t]}
                </button>
              ))}
              {body !== def.body && (
                <button className={cx(s.tag, s.standard)} onClick={restoreStandard}>
                  Use the standard wording
                </button>
              )}
            </div>
            {unknown.length > 0 && (
              <p className={s.warn} role="status">
                {unknown.map((u) => `{${u}}`).join(', ')} {unknown.length === 1 ? "isn't a detail" : "aren't details"} this text can fill in, so residents would see{' '}
                {unknown.length === 1 ? 'it' : 'them'} as typed. Use the buttons above instead.
              </p>
            )}
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

const TABS = ['texts', 'mobile', 'sent'] as const;
type TextsTab = (typeof TABS)[number];

/** Text Messages: What residents and associates get by text. */
function ResidentTexts() {
  const svc = useServiceSettings();
  const texts = textSettings(svc);
  const sent = useOutbox();
  const mobile = mobileOverrides(svc);
  const noMobile = residents.filter((r) => r.id && r.name && !hasMobile(mobile, r.id)).length;
  const [tab, setTab] = usePageTab<TextsTab>('svcTexts', TABS);
  const edited = Object.values(texts).some((t) => t && (t.on === false || typeof t.body === 'string'));
  return (
    <BoPage
      title="Text Messages"
      actions={
        edited && (
          <ConfirmReset
            label="Reset to standard wording"
            onReset={() => setSetting('texts', {})}
            title="Put every text back to the standard wording?"
            message="Your own wording is replaced, and any text you turned off is turned back on."
            done="Every text is back to the standard wording and turned on"
          />
        )
      }
    >
      <Tabs
        aria-label="Text messages"
        variant="underline"
        value={tab}
        onChange={setTab}
        options={[
          { id: 'texts', label: 'Wording', count: TEXT_DEFINITIONS.length },
          { id: 'mobile', label: 'Residents without a mobile', count: noMobile },
          { id: 'sent', label: 'Sent from this demo', count: sent.length },
        ]}
      />
      {tab === 'texts' && (
        <>
          <p className={s.how}>Type the wording, then tap a button under it, such as First name, to add that detail where the cursor is. The switch turns a text off.</p>
          {TEXT_DEFINITIONS.map((d) => (
            <TextCard key={d.key} def={d} own={texts[d.key]} />
          ))}
        </>
      )}
      {tab === 'mobile' && <NoMobile />}
      {tab === 'sent' && <Outbox />}
    </BoPage>
  );
}

const HUB_TABS = ['texts', 'broadcasts'] as const;

/** Messages: texts residents get, and broadcasts servers read on their tablets. */
export default function Page(props: BoPageProps) {
  const [tab, go] = useHubTab('svcTexts', HUB_TABS);
  return (
    <BoTabbedPage
      page="svcTexts"
      title="Messages"
      current={tab}
      onTab={go}
      tabs={[
        { id: 'texts', label: 'Texts to residents', render: () => <ResidentTexts /> },
        { id: 'broadcasts', label: 'Broadcasts to staff', render: () => <BroadcastsPage {...props} /> },
      ]}
    />
  );
}
