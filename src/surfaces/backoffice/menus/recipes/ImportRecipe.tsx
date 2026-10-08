import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FileText, FileUp, Save, Sparkles, X } from 'lucide-react';
import type { Recipe } from '../../../../store/menuEdits';
import { Button, Modal, cx, toast } from '../../../../ui';
import { BoCallout } from '../../kit';
import { RECIPE_FILE_ACCEPT, recipeFileKind, recipeFileText } from '../model/recipeFile';
import { nameFromFile, parseRecipeDoc, sampleFromPhoto, type ImportDraft } from '../model/recipeImport';
import { createRecipe, setRecipeShort } from '../recipeActions';
import { useAutofill } from './RecipeDetail';
import { RecipeForm } from './RecipeForm';
import s from './ImportRecipe.module.css';

/** How long the stand-in AI takes to "read" a photo. */
const READ_MS = 1200;

/** A file read and parsed, waiting for the chef to check it. */
export interface ImportResult {
  draft: ImportDraft;
  fileName: string;
  /** A photo or PDF: the demo filled a sample instead of reading it. */
  sample: boolean;
  /** Object URL of a photo, for the preview. */
  preview?: string;
}

/**
 * Pick or drop a recipe file. Word, text, Markdown and RTF files are read
 * here in the browser; a photo or PDF needs the AI service, so the demo says
 * so and fills a sample to edit.
 */
export function ImportPicker({ name, onRead }: { name: string; onRead: (r: ImportResult) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();
  const [noPreview, setNoPreview] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const kind = file ? recipeFileKind(file.name, file.type) : null;
  const visual = kind === 'image' || kind === 'pdf';

  const take = async (f: File | undefined) => {
    if (!f) return;
    setError('');
    setNoPreview(false);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(undefined);
    const k = recipeFileKind(f.name, f.type);
    if (k === 'doc') return setError('Older Word files (.doc) can’t be read here. Open it in Word and save it as .docx, then import that.');
    if (k === 'other') return setError('That kind of file can’t be read. Use a Word document, a text file, a PDF or a photo.');
    setFile(f);
    if (k === 'image') {
      setPreview(URL.createObjectURL(f));
      return;
    }
    if (k === 'pdf') return;
    setBusy(true);
    try {
      const text = await recipeFileText(f);
      if (!text.trim()) throw new Error('There’s no text in this file to read.');
      onRead({ draft: parseRecipeDoc(text, name || nameFromFile(f.name)), fileName: f.name, sample: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This file couldn’t be read.');
      setFile(null);
    } finally {
      setBusy(false);
    }
  };

  const readSample = () => {
    if (!file) return;
    setBusy(true);
    timer.current = window.setTimeout(() => {
      onRead({ draft: sampleFromPhoto(name || nameFromFile(file.name)), fileName: file.name, sample: true, preview });
    }, READ_MS);
  };

  return (
    <div className={s.picker}>
      <label
        className={cx(s.drop, over && s.dropOver)}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void take(e.dataTransfer.files[0]);
        }}
      >
        <input
          type="file"
          accept={RECIPE_FILE_ACCEPT}
          className={s.fileInput}
          aria-label="Recipe file"
          onChange={(e) => {
            void take(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <FileUp size={22} aria-hidden className={s.dropIcon} />
        <span className={s.dropTitle}>{busy && !visual ? 'Reading…' : 'Drop a file here, or choose one'}</span>
        <span className={s.dropSub}>Word (.docx), text (.txt, .md, .rtf), PDF, or a photo of the recipe card</span>
      </label>

      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}

      {file && visual && (
        <div className={s.visual}>
          {preview && !noPreview ? (
            <img src={preview} alt={`Preview of ${file.name}`} className={s.thumb} onError={() => setNoPreview(true)} />
          ) : (
            <div className={s.fileTile}>
              <FileText size={26} aria-hidden />
              <span>{kind === 'pdf' ? 'PDF' : 'No preview'}</span>
            </div>
          )}
          <div className={s.visualText}>
            <div className={s.fileName}>{file.name}</div>
            <BoCallout tone="warning">
              Reading {kind === 'pdf' ? 'PDFs' : 'photos'} needs the AI service; this demo fills a sample you can edit. Check every line against your{' '}
              {kind === 'pdf' ? 'PDF' : 'photo'}.
            </BoCallout>
            <div>
              <Button variant="primary" icon={<Sparkles size={14} />} disabled={busy} onClick={readSample}>
                {busy ? 'Reading…' : 'Fill a sample to edit (demo)'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Check an imported recipe in the normal recipe form before it is saved.
 * Lines the reader couldn't place are listed so nothing is lost; any still
 * listed at Save go into the chef's notes.
 */
export function ImportReview({
  result,
  onBack,
  onClose,
  onCreated,
}: {
  result: ImportResult;
  onBack: () => void;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [d, setD] = useState<Recipe>(() => ({ id: 'import-draft', ...result.draft.recipe }));
  const [short, setShort] = useState('');
  const [unplaced, setUnplaced] = useState(result.draft.unplaced);
  const update = (patch: Partial<Recipe>) => setD((x) => ({ ...x, ...patch }));
  const [busy, runAi] = useAutofill(update);
  const { fileName, sample } = result;

  const save = () => {
    const { id: _draftId, ...rest } = d;
    const notes = unplaced.length ? `From ${fileName}, not placed:\n${unplaced.map((l) => '- ' + l).join('\n')}` : '';
    const id = createRecipe(d.name, {
      ...rest,
      desc: d.desc || d.menuDescriptor || '',
      variations: [d.variations, notes].filter(Boolean).join('\n\n') || undefined,
      importedFrom: sample ? 'photo' : 'text',
      sourceFile: fileName,
    });
    setRecipeShort(d, short);
    toast(`${d.name} saved from ${fileName}. Review every line before publishing.`, { tone: 'success' });
    onCreated(id);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Check the imported recipe"
      width={920}
      tall
      footer={
        <div className={s.footer}>
          <Button variant="ghost" icon={<ArrowLeft size={14} />} onClick={onBack}>
            Choose another file
          </Button>
          <span className={s.spacer} />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Save size={14} />} disabled={!d.name.trim()} onClick={save}>
            Save recipe
          </Button>
        </div>
      }
    >
      <div className={s.review}>
        <div className={s.banner}>
          {result.preview ? (
            <img src={result.preview} alt="" className={s.bannerThumb} />
          ) : (
            <FileText size={18} aria-hidden className={s.bannerIcon} />
          )}
          <div className={s.bannerText}>
            <span>
              <strong>Imported from {fileName}</strong> — check before saving.
            </span>
            {sample ? (
              <span className={s.bannerSub}>Reading photos and PDFs needs the AI service; this demo filled a sample you can edit.</span>
            ) : (
              <span className={s.bannerSub}>
                Read from the file’s text: the title, yield and times, ingredients, method and notes. Allergens are suggested below.
                {d.baseServings ? ` Amounts are as written, for ${d.baseServings} servings; prep sheets scale from that.` : ''}
              </span>
            )}
          </div>
        </div>
        {unplaced.length > 0 && (
          <section className={s.unplaced} aria-label="Didn't recognise">
            <div className={s.unplacedHead}>
              <span className={s.unplacedTitle}>Didn’t recognise</span>
              <span className={s.unplacedHint}>Move these into the recipe yourself. Any still here when you save go into Chef’s notes.</span>
            </div>
            <ul className={s.unplacedList}>
              {unplaced.map((l, i) => (
                <li key={i} className={s.unplacedLine}>
                  <span className={s.unplacedText}>{l}</span>
                  <button className={s.x} aria-label={`Remove “${l}”`} onClick={() => setUnplaced((u) => u.filter((_, j) => j !== i))}>
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <RecipeForm
          r={d}
          update={update}
          rename={(name) => update({ name })}
          short={short}
          onShort={setShort}
          readOnly={false}
          global={false}
          draft
          busy={busy}
          onAi={() => runAi(d)}
        />
      </div>
    </Modal>
  );
}
