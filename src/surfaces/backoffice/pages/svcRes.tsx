import { useCallback, useEffect, useRef, useState } from 'react';
import { Save } from 'lucide-react';
import type { BoPageProps } from '../nav';
import { BoPage } from '../kit';
import { getResident, residents } from '../../../data';
import {
  isStoryEdited,
  resetResidentStory,
  saveResidentStory,
  storyFor,
  useStoryEdits,
  type ResidentStory,
} from '../../../store/residentStories';
import { Button, Chip, SearchField, TextArea, TextField, cx, toast, useConfirm } from '../../../ui';
import { searchResidents } from '../../server/features/residents/residentInfo';
import { storyPick } from '../../server/features/residents/storyPick';
import s from './svcRes.module.css';

interface Draft {
  background: string;
  now: string;
  loves: string;
  starters: string;
  goodToKnow: string;
  question: string;
}

const toDraft = (st: ResidentStory): Draft => ({
  background: st.background,
  now: st.now,
  loves: st.loves.join(', '),
  starters: st.starters.join('\n'),
  goodToKnow: st.goodToKnow.join('\n'),
  question: st.question,
});

const lines = (t: string) =>
  t
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

const fromDraft = (d: Draft): ResidentStory => ({
  background: d.background.trim(),
  now: d.now.trim(),
  loves: d.loves
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean),
  starters: lines(d.starters),
  goodToKnow: lines(d.goodToKnow),
  question: d.question.trim(),
});

function StoryEditor({ residentId, onDirty }: { residentId: string; onDirty: (dirty: boolean) => void }) {
  const edits = useStoryEdits();
  const resident = getResident(residentId)!;
  const current = storyFor(edits, residentId);
  const [draft, setDraft] = useState(() => toDraft(current));
  const dirty = JSON.stringify(fromDraft(draft)) !== JSON.stringify(current);
  const edited = isStoryEdited(edits, residentId);
  const first = resident.name.split(' ')[0];
  const [ask, dialog] = useConfirm();
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  const field = (k: keyof Draft) => ({ value: draft[k], onChange: (e: { target: { value: string } }) => setDraft((d) => ({ ...d, [k]: e.target.value })) });
  return (
    <section className={s.editor}>
      <header className={s.editorHead}>
        <h2 className={s.name}>{resident.name}</h2>
        {edited && <Chip tone="info">Edited here</Chip>}
        <span className={s.grow} />
        {edited && (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              const ok = await ask({
                title: `Put ${first}'s story back to the original?`,
                message: 'Everything written here for them is replaced by the original story.',
                confirmLabel: 'Back to original',
                tone: 'danger',
              });
              if (!ok) return;
              resetResidentStory(residentId);
              setDraft(toDraft(storyFor({}, residentId)));
              toast(`${first}'s profile is back to the original`);
            }}
          >
            Back to original
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          icon={<Save size={14} />}
          disabled={!dirty}
          onClick={() => {
            saveResidentStory(residentId, fromDraft(draft));
            toast(`Saved. Servers see it on ${first}'s profile`, { tone: 'success' });
          }}
        >
          Save
        </Button>
      </header>
      {dirty && <p className={s.unsaved}>Not saved yet. Servers see the change once you save.</p>}
      <TextArea label="Their story" rows={4} placeholder="Where they are from, what they did, family" {...field('background')} />
      <TextArea label="These days" rows={3} placeholder="What they are up to now" {...field('now')} />
      <TextField label="Loves" hint="Separate with commas. Shown as chips on the profile." placeholder="Golf, Book club" {...field('loves')} />
      <TextArea label="Conversation starters" hint="One per line." rows={3} placeholder="Ask about..." {...field('starters')} />
      <TextArea
        label="Good to know"
        hint="One note per line. Shown on the check when the server seats them."
        rows={3}
        placeholder="Grandson just started college"
        {...field('goodToKnow')}
      />
      <TextField label="Question to ask tonight" placeholder="How is ... doing?" {...field('question')} />
      {dialog}
    </section>
  );
}

/** Conversation Profiles: the story, conversation starters and Good to know notes servers see when they open a resident. */
export default function Page(_props: BoPageProps) {
  const edits = useStoryEdits();
  const [selected, setSelected] = useState<string>(() => {
    const pick = storyPick.get();
    return pick && getResident(pick) ? pick : residents[0].id;
  });
  // The pick from Resident Dining Profile is used once.
  useEffect(() => storyPick.set(null), []);
  const [query, setQuery] = useState('');
  const shown = searchResidents(residents, query);
  const dirty = useRef(false);
  const [ask, dialog] = useConfirm();
  const onDirty = useCallback((d: boolean) => {
    dirty.current = d;
  }, []);
  /** Switching residents with unsaved changes asks first, since the changes would be lost. */
  const pick = async (id: string) => {
    if (id === selected) return;
    if (dirty.current) {
      const name = getResident(selected)?.name.split(' ')[0] ?? 'this resident';
      const ok = await ask({ title: `Leave ${name}'s story without saving?`, message: 'Your changes are not saved and will be lost.', confirmLabel: 'Leave without saving', tone: 'danger' });
      if (!ok) return;
    }
    dirty.current = false;
    setSelected(id);
  };
  return (
    <BoPage title="Conversation Profiles">
      <div className={s.layout}>
        <nav className={s.list} aria-label="Residents">
          <SearchField value={query} onChange={setQuery} placeholder="Search residents" aria-label="Search residents" className={s.search} />
          <ul className={s.items}>
            {shown.map((r) => (
              <li key={r.id}>
                <button type="button" className={cx(s.item, r.id === selected && s.itemOn)} aria-current={r.id === selected} onClick={() => void pick(r.id)}>
                  <span className={s.itemText}>
                    <span className={s.itemName}>{r.name}</span>
                    <span className={s.itemApt}>{r.apt ? `Apt ${r.apt}` : 'Resident'}</span>
                  </span>
                  {isStoryEdited(edits, r.id) && (
                    <Chip tone="info" size="xs">
                      Edited
                    </Chip>
                  )}
                </button>
              </li>
            ))}
            {!shown.length && <li className={s.none}>No resident matches that.</li>}
          </ul>
        </nav>
        <StoryEditor key={selected} residentId={selected} onDirty={onDirty} />
      </div>
      {dialog}
    </BoPage>
  );
}
