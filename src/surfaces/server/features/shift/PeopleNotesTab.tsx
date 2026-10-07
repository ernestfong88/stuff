import { useState } from 'react';
import { getResident } from '../../../../data';
import { serverName } from '../../../../domain/servers';
import type { ResidentNote } from '../../../../domain/types';
import { formatAgo, ordinal } from '../../../../lib/format';
import { dropNote, editNote, useNotes } from '../../../../store/notes';
import { residentPref, residentPrefsStore, updateResidentPref } from '../../../../store/residentPrefs';
import { Avatar, Button, Chip, TextArea } from '../../../../ui';
import { BarRow } from '../shared/BarRow';
import { NOTE_KINDS } from '../shared/noteKinds';
import { SummaryTile, SummaryTiles } from '../shared/SummaryTile';
import { useShiftServers } from '../shared/useShiftServers';
import { noteRank } from '../points/noteRank';
import { withoutPreference } from '../voice/saveHeard';
import s from './PeopleNotesTab.module.css';

/** Keep the resident's dining preference in step when a preference note is corrected or deleted. */
function fixPreference(n: ResidentNote, replacement: string) {
  if (n.kind !== 'pref') return;
  const current = residentPref(residentPrefsStore.get(), n.rid);
  const next = withoutPreference(current, n.text, replacement);
  if (next !== current) updateResidentPref(n.rid, next);
}

function NoteRow({ note, locked }: { note: ResidentNote; locked: boolean }) {
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view');
  const [draft, setDraft] = useState(note.text);
  const res = getResident(note.rid);
  const k = NOTE_KINDS[note.kind];
  const save = () => {
    const t = draft.trim();
    if (!t) return;
    if (t !== note.text) {
      fixPreference(note, t);
      editNote(note.id, t);
    }
    setMode('view');
  };
  return (
    <li className={s.note}>
      <span className={s.point}>+1</span>
      {res && <Avatar person={res} size={34} />}
      <div className={s.noteBody}>
        <div className={s.noteHead}>
          <Chip tone={k.tone} size="xs" className={s.kind}>
            {k.label}
          </Chip>
          <span className={s.who}>{res?.name}</span>
          <span className={s.meta}>{[note.table, formatAgo(note.at), note.edited && 'edited'].filter(Boolean).join(' · ')}</span>
        </div>
        {mode === 'edit' ? (
          <TextArea
            className={s.edit}
            rows={2}
            value={draft}
            autoFocus
            aria-label="Correct this note"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                save();
              }
              if (e.key === 'Escape') setMode('view');
            }}
          />
        ) : (
          <div className={s.text}>{note.text}</div>
        )}
        {mode === 'delete' && (
          <div className={s.confirm}>{note.kind === 'pref' ? 'Delete this and take it out of their dining preference?' : 'Delete this note? You lose the point.'}</div>
        )}
      </div>
      {!locked && (
        <div className={s.noteActions}>
          {mode === 'edit' && (
            <>
              <Button onClick={() => setMode('view')}>
                Cancel
              </Button>
              <Button variant="primary" disabled={!draft.trim()} onClick={save}>
                Save
              </Button>
            </>
          )}
          {mode === 'delete' && (
            <>
              <Button onClick={() => setMode('view')}>
                Keep
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  fixPreference(note, '');
                  dropNote(note.id);
                }}
              >
                Delete
              </Button>
            </>
          )}
          {mode === 'view' && (
            <>
              <Button
                variant="soft"
                onClick={() => {
                  setDraft(note.text);
                  setMode('edit');
                }}
              >
                Edit
              </Button>
              <Button variant="softDanger" onClick={() => setMode('delete')}>
                Delete
              </Button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

/** People notes: points, where that puts the server tonight, and everything they added. */
export function PeopleNotesTab({ who, locked }: { who: string; locked: boolean }) {
  const notes = useNotes();
  const servers = useShiftServers();
  const r = noteRank(notes, who, servers);
  const mine = notes.filter((n) => n.by === who).sort((a, b) => b.at - a.at);
  const count = (kind: ResidentNote['kind']) => mine.filter((n) => n.kind === kind).length;
  const max = Math.max(1, ...r.list.map((x) => r.by[x] ?? 0));
  return (
    <>
      <section className={s.rank}>
        <div className={s.rankHead}>
          <span className={s.points}>
            {r.mine} point{r.mine === 1 ? '' : 's'}
          </span>
          <span className={s.rankText}>
            {r.of > 1 ? `${ordinal(r.rank)} of ${r.of} servers this shift. ` : ''}One point for each thing you learned, noticed, updated or passed on as
            feedback.
          </span>
        </div>
        <div className={s.bars}>
          {[...r.list]
            .sort((a, b) => (r.by[b] ?? 0) - (r.by[a] ?? 0))
            .map((x) => (
              <BarRow
                key={x}
                mine={x === who}
                label={(x === who ? 'You · ' : '') + serverName(x)}
                pct={((r.by[x] ?? 0) / max) * 100}
                value={r.by[x] ?? 0}
                color={x === who ? 'var(--plum)' : '#c9c2de'}
              />
            ))}
        </div>
      </section>
      <SummaryTiles>
        <SummaryTile value={count('know')} label="little things" color={NOTE_KINDS.know.color} />
        <SummaryTile value={count('obs')} label="observations for the care team" color={NOTE_KINDS.obs.color} />
        <SummaryTile value={count('pref')} label="dining preferences updated" color={NOTE_KINDS.pref.color} />
        <SummaryTile value={count('fb')} label="dining feedback" color={NOTE_KINDS.fb.color} />
      </SummaryTiles>
      <div className={s.listHead}>
        <span className={s.cap}>Everything you added · {mine.length}</span>
        <span className={s.hint}>{locked ? 'Signed off. These are saved and can no longer be changed.' : 'Fix or remove anything before you sign off.'}</span>
      </div>
      {mine.length ? (
        <ul className={s.list}>
          {mine.map((n) => (
            <NoteRow key={n.id} note={n} locked={locked} />
          ))}
        </ul>
      ) : (
        <p className={s.empty}>Nothing yet. Use the mic on an order or the Voice button on My Tables.</p>
      )}
    </>
  );
}
