import { useEffect, useRef, useState } from 'react';
import { Copy, FileUp, Keyboard, Plus, Sparkles } from 'lucide-react';
import type { Recipe } from '../../../../store/menuEdits';
import { Button, Chip, Modal, SearchField, Tabs, TextArea, toast } from '../../../../ui';
import { useBo } from '../data';
import { GLOBAL_LIBRARY, OTHER_COMMUNITIES } from '../library';
import { categoryLabel, dishLong } from '../model/categories';
import { parseRecipeText } from '../model/recipeDraft';
import { createRecipe } from '../recipeActions';
import { ImportPicker, ImportReview, type ImportResult } from './ImportRecipe';
import s from './AddRecipeDialog.module.css';

/** How long the stand-in AI takes to "read" a recipe. */
const READ_MS = 1200;

/**
 * Add a recipe. Search checks your recipes first, then the Global Library,
 * then other communities, so nobody builds the fourth copy of meatloaf by
 * accident. A new one is typed in (blank, or drafted from pasted text) or
 * imported from a file: a Word document, text, PDF or a photo of the card.
 */
export function AddRecipeDialog({
  onClose,
  onAddGlobal,
  onCreated,
  onOpen,
}: {
  onClose: () => void;
  onAddGlobal: (r: Recipe, linked: boolean) => void;
  onCreated: (id: string) => void;
  onOpen: (r: Recipe) => void;
}) {
  const bo = useBo();
  const [q, setQ] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'type' | 'file'>('type');
  const [imported, setImported] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const preview = imported?.preview;
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  const k = q.trim().toLowerCase();
  const mine = k ? bo.recipes.filter((r) => r.name.toLowerCase().includes(k)).slice(0, 4) : [];
  const glob = k ? GLOBAL_LIBRARY.filter((r) => r.name.toLowerCase().includes(k) || r.desc.toLowerCase().includes(k)).slice(0, 4) : [];
  const others = k ? OTHER_COMMUNITIES.filter((r) => r.name.toLowerCase().includes(k)).slice(0, 4) : [];
  const name = q.trim();
  const have = (g: Recipe) => bo.recipes.some((x) => x.globalId === g.id || x.name.toLowerCase() === g.name.toLowerCase());

  const draft = () => {
    setBusy(true);
    timer.current = window.setTimeout(() => {
      const id = createRecipe(name, { ...parseRecipeText(text), importedFrom: 'text' });
      toast('Drafted from your text. Review every line before publishing.', { tone: 'success' });
      onCreated(id);
    }, READ_MS);
  };
  const startNew = (m: 'type' | 'file') => {
    setMode(m);
    setIsNew(true);
  };

  if (imported) return <ImportReview result={imported} onBack={() => setImported(null)} onClose={onClose} onCreated={onCreated} />;

  return (
    <Modal open onClose={onClose} title="Add a recipe" width={560}>
      <SearchField value={q} onChange={setQ} placeholder="Start typing, e.g. meatloaf" autoFocus className={s.search} />
      {isNew ? (
        <div className={s.newBox}>
          <div className={s.newTitle}>{name ? <>Add “{name}” as a new recipe</> : 'Add a new recipe'}</div>
          <Tabs
            variant="segmented"
            size="sm"
            value={mode}
            onChange={setMode}
            aria-label="How to add it"
            options={[
              { id: 'type', label: 'Type it in', icon: <Keyboard size={14} aria-hidden /> },
              { id: 'file', label: 'Import a file', icon: <FileUp size={14} aria-hidden /> },
            ]}
          />
          {mode === 'file' ? (
            <>
              <p className={s.muted}>
                Import a recipe you already have. It opens in the recipe form, filled in from the file, for you to check before saving.
              </p>
              <ImportPicker name={name} onRead={setImported} />
              <div className={s.actions}>
                <Button variant="ghost" onClick={() => setIsNew(false)}>
                  Back
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className={s.muted}>Paste the recipe as text and AI drafts it for you to review and edit. Or start blank.</p>
              <TextArea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                aria-label="Recipe text"
                placeholder={
                  'Paste anything: an email, a recipe card, notes…\n\n2 lb ground beef\n1 cup breadcrumbs\n2 eggs\nMix, form a loaf, bake at 350 for 45 minutes.'
                }
              />
              <div className={s.actions}>
                <Button variant="primary" icon={<Sparkles size={14} />} disabled={busy || !name || !text.trim()} onClick={draft}>
                  {busy ? 'Reading…' : 'Draft it with AI'}
                </Button>
                <Button
                  disabled={busy || !name}
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
            </>
          )}
        </div>
      ) : k.length > 1 ? (
        <>
          {mine.length > 0 && (
            <Group label="Already in your recipes">
              {mine.map((r) => (
                <Hit
                  key={r.id}
                  title={dishLong(r.name)}
                  sub={categoryLabel(r.cat)}
                  actions={
                    <Button size="sm" onClick={() => onOpen(r)}>
                      Open
                    </Button>
                  }
                />
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
                    have(r) ? (
                      <Chip tone="success">You have this</Chip>
                    ) : (
                      <>
                        <Button size="sm" onClick={() => onAddGlobal(r, true)} title="Home Office keeps it up to date. You can't edit it.">
                          Add
                        </Button>
                        <Button size="sm" icon={<Copy size={13} />} onClick={() => onAddGlobal(r, false)} title="Your own copy to change.">
                          Copy to edit
                        </Button>
                      </>
                    )
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
                      Copy to edit
                    </Button>
                  }
                />
              ))}
            </Group>
          )}
          <div className={s.none}>
            <Sparkles size={15} aria-hidden className={s.noneIcon} />
            <span className={s.noneText}>None of these?</span>
            <Button size="sm" variant="primary" icon={<Plus size={13} />} onClick={() => startNew('type')}>
              Add “{name.slice(0, 22)}” as new
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className={s.muted}>
            Search checks your recipes first, then the Global Library, then other communities, so nobody builds the fourth copy of meatloaf by
            accident.
          </p>
          <div className={s.importRow}>
            <FileUp size={15} aria-hidden className={s.noneIcon} />
            <span className={s.noneText}>Have it in a Word document, PDF or photo?</span>
            <Button size="sm" onClick={() => startNew('file')}>
              Import a file
            </Button>
          </div>
        </>
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
