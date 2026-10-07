import { useEffect, useRef, useState } from 'react';
import { Copy, Paperclip, Plus, Sparkles } from 'lucide-react';
import type { Recipe } from '../../../../store/menuEdits';
import { Button, Chip, Modal, SearchField, TextArea, toast } from '../../../../ui';
import { useBo } from '../data';
import { GLOBAL_LIBRARY, OTHER_COMMUNITIES } from '../library';
import { dishLong } from '../model/categories';
import { parseRecipeText, photoDraft } from '../model/recipeDraft';
import { createRecipe } from '../recipeActions';
import s from './AddRecipeDialog.module.css';

/** How long the stand-in AI takes to "read" a recipe. */
const READ_MS = 1200;

/**
 * Add a recipe. Search checks your recipes first, then the Global Library,
 * then other communities, so nobody builds the fourth copy of meatloaf by
 * accident. A new one can start blank or be drafted from pasted text or a
 * photo of the recipe card.
 */
export function AddRecipeDialog({ onClose, onAddGlobal, onCreated }: { onClose: () => void; onAddGlobal: (r: Recipe, linked: boolean) => void; onCreated: (id: string) => void }) {
  const bo = useBo();
  const [q, setQ] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [text, setText] = useState('');
  const [file, setFile] = useState('');
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const k = q.trim().toLowerCase();
  const mine = k ? bo.recipes.filter((r) => r.name.toLowerCase().includes(k)).slice(0, 4) : [];
  const glob = k ? GLOBAL_LIBRARY.filter((r) => r.name.toLowerCase().includes(k) || r.desc.toLowerCase().includes(k)).slice(0, 4) : [];
  const others = k ? OTHER_COMMUNITIES.filter((r) => r.name.toLowerCase().includes(k)).slice(0, 4) : [];
  const name = q.trim();

  const draft = () => {
    setBusy(true);
    const from = text.trim() ? 'text' : 'photo';
    const parsed = text.trim() ? parseRecipeText(text) : photoDraft();
    timer.current = window.setTimeout(() => {
      const id = createRecipe(name, { ...parsed, importedFrom: from });
      toast(`Drafted from ${from === 'photo' ? 'your photo' : 'your text'}. Review every line before publishing.`, { tone: 'success' });
      onCreated(id);
    }, READ_MS);
  };

  return (
    <Modal open onClose={onClose} title="Add a recipe" width={560}>
      <SearchField value={q} onChange={setQ} placeholder="Start typing, e.g. meatloaf" autoFocus className={s.search} />
      {isNew ? (
        <div className={s.newBox}>
          <div className={s.newTitle}>Add “{name}” as a new recipe</div>
          <p className={s.muted}>Paste the recipe as text, or upload a photo or PDF. AI drafts the recipe from it for you to review and edit. Or start blank.</p>
          <TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            aria-label="Recipe text"
            placeholder={'Paste anything: an email, a recipe card, notes…\n\n2 lb ground beef\n1 cup breadcrumbs\n2 eggs\nMix, form a loaf, bake at 350 for 45 minutes.'}
          />
          <div className={s.fileRow}>
            <label className={s.file}>
              <input type="file" accept="image/*,.pdf" className={s.fileInput} onChange={(e) => setFile(e.target.files?.[0]?.name ?? '')} />
              <Paperclip size={14} aria-hidden />
              {file || 'Upload a photo or PDF'}
            </label>
            <span className={s.muted}>{file ? 'AI will read what it can from the file.' : 'Handwritten cards work too.'}</span>
          </div>
          <div className={s.actions}>
            <Button variant="primary" icon={<Sparkles size={14} />} disabled={busy || (!text.trim() && !file)} onClick={draft}>
              {busy ? 'Reading…' : 'Draft it with AI'}
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                const id = createRecipe(name);
                toast('Created. Fill it in, or use AI Autofill.', { tone: 'success' });
                onCreated(id);
              }}
            >
              Start blank
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setIsNew(false)}>
              Back
            </Button>
          </div>
        </div>
      ) : k.length > 1 ? (
        <>
          {mine.length > 0 && (
            <Group label="Already in your recipes">
              {mine.map((r) => (
                <Hit key={r.id} title={dishLong(r.name)} sub={r.cat} actions={<Chip tone="success">You have this</Chip>} />
              ))}
            </Group>
          )}
          {glob.length > 0 && (
            <Group label="Global Library · managed by Home Office">
              {glob.map((r) => (
                <Hit
                  key={r.id}
                  title={r.name}
                  sub={r.desc}
                  actions={
                    <>
                      <Button size="sm" onClick={() => onAddGlobal(r, true)}>
                        Add linked
                      </Button>
                      <Button size="sm" icon={<Copy size={13} />} onClick={() => onAddGlobal(r, false)}>
                        Copy
                      </Button>
                    </>
                  }
                />
              ))}
            </Group>
          )}
          {others.length > 0 && (
            <Group label="From other communities · copy only">
              {others.map((r) => (
                <Hit
                  key={r.id}
                  title={r.name}
                  sub={`${r.community} · ${r.desc}`}
                  actions={
                    <Button
                      size="sm"
                      icon={<Copy size={13} />}
                      onClick={() => {
                        const id = createRecipe(r.name, { cat: r.cat, desc: r.desc });
                        toast(`Copied from ${r.community}. Yours now, no linkage back.`, { tone: 'success' });
                        onCreated(id);
                      }}
                    >
                      Copy as mine
                    </Button>
                  }
                />
              ))}
            </Group>
          )}
          <div className={s.none}>
            <Sparkles size={15} aria-hidden className={s.noneIcon} />
            <span className={s.noneText}>None of these?</span>
            <Button size="sm" variant="primary" icon={<Plus size={13} />} onClick={() => setIsNew(true)}>
              Add “{name.slice(0, 22)}” as new
            </Button>
          </div>
        </>
      ) : (
        <p className={s.muted}>Search checks your recipes first, then the Global Library, then other communities, so nobody builds the fourth copy of meatloaf by accident.</p>
      )}
    </Modal>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={s.group}>
      <div className={s.groupLabel}>{label}</div>
      {children}
    </div>
  );
}

function Hit({ title, sub, actions }: { title: string; sub?: string; actions: React.ReactNode }) {
  return (
    <div className={s.hit}>
      <div className={s.hitText}>
        <div className={s.hitTitle}>{title}</div>
        {sub && <div className={s.hitSub}>{sub}</div>}
      </div>
      <div className={s.hitActions}>{actions}</div>
    </div>
  );
}
