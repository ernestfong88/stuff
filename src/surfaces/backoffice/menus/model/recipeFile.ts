/**
 * Reading a recipe file in the browser, with no server: the text of a Word
 * document, a text or Markdown file, or an RTF file. Photos and PDFs have no
 * text to read here; they go to the (demo) AI reader instead.
 */

export type RecipeFileKind = 'docx' | 'text' | 'rtf' | 'pdf' | 'image' | 'doc' | 'other';

/** Files the import accepts, for the file picker. */
export const RECIPE_FILE_ACCEPT = '.docx,.txt,.md,.markdown,.rtf,.pdf,image/*,.heic,.heif';

/** What kind of file it is, from its name and, failing that, its type. */
export function recipeFileKind(name: string, type = ''): RecipeFileKind {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? '';
  if (ext === 'docx' || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (ext === 'doc' || type === 'application/msword') return 'doc';
  if (ext === 'rtf' || /rtf/.test(type)) return 'rtf';
  if (['txt', 'md', 'markdown', 'text'].includes(ext) || type.startsWith('text/')) return 'text';
  if (ext === 'pdf' || type === 'application/pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tif', 'tiff'].includes(ext) || type.startsWith('image/')) return 'image';
  return 'other';
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENTITIES[e.toLowerCase()],
  );

/**
 * The text of a Word document's body (word/document.xml): one line per
 * paragraph, list items marked "• ", headings marked "# ", tabs and line
 * breaks kept. Deleted tracked changes are left out.
 */
export function documentXmlText(xml: string): string {
  const out: string[] = [];
  for (const p of xml.matchAll(/<w:p(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/w:p>)/g)) {
    const body = p[1] ?? '';
    let text = '';
    // Run text only: the paragraph properties hold tab stops, not tabs.
    for (const r of body.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/, '').matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:(tab|br|cr)(?:\s[^>]*)?\/>/g)) {
      if (r[2] === 'tab') text += '\t';
      else if (r[2]) text += '\n';
      else text += decode(r[1]);
    }
    if (!text.trim()) {
      out.push('');
      continue;
    }
    const style = /<w:pStyle\s+w:val="([^"]*)"/.exec(body)?.[1] ?? '';
    if (/^(title|heading\d?)$/i.test(style)) text = '# ' + text;
    else if (/<w:numPr>/.test(body) || /^list/i.test(style)) text = '• ' + text;
    out.push(text);
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The text of a .docx file. */
export async function docxText(data: ArrayBuffer | Uint8Array): Promise<string> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(data);
  const doc = zip.file('word/document.xml');
  if (!doc) throw new Error('This isn’t a Word document we can read. Try saving it again as .docx.');
  return documentXmlText(await doc.async('string'));
}

/** Destinations whose text isn't part of the document (fonts, colours, pictures, metadata). */
const RTF_SKIP =
  /^(fonttbl|colortbl|stylesheet|info|pict|header|footer|headerl|headerr|footerl|footerr|listtable|listoverridetable|rsidtbl|generator|xmlnstbl|themedata|datastore|latentstyles)$/;
const RTF_WORDS: Record<string, string> = {
  par: '\n',
  line: '\n',
  tab: '\t',
  bullet: '•',
  endash: '–',
  emdash: '—',
  lquote: '‘',
  rquote: '’',
  ldblquote: '“',
  rdblquote: '”',
};

/** Plain text from RTF: paragraphs and list numbers kept, formatting dropped. */
export function rtfText(rtf: string): string {
  if (!/^\s*\{\\rtf/.test(rtf)) return rtf;
  let out = '';
  // Stack of "skip this group" flags; a group starting \* or a known destination is skipped.
  const skip: boolean[] = [false];
  let uc = 1;
  let pendingSkip = 0;
  for (let i = 0; i < rtf.length; i++) {
    const c = rtf[i];
    const skipping = skip[skip.length - 1];
    if (c === '{') {
      skip.push(skipping);
      continue;
    }
    if (c === '}') {
      if (skip.length > 1) skip.pop();
      continue;
    }
    if (c === '\\') {
      const n = rtf[i + 1];
      if (n === '\\' || n === '{' || n === '}') {
        if (!skipping) out += n;
        i++;
        continue;
      }
      if (n === '*') {
        skip[skip.length - 1] = true;
        i++;
        continue;
      }
      if (n === "'") {
        if (!skipping) {
          if (pendingSkip) pendingSkip--;
          else out += String.fromCharCode(parseInt(rtf.slice(i + 2, i + 4), 16));
        }
        i += 3;
        continue;
      }
      if (n === '~') {
        if (!skipping) out += ' ';
        i++;
        continue;
      }
      if (n === '\n' || n === '\r') {
        if (!skipping) out += '\n';
        i++;
        continue;
      }
      const m = /^([a-z]+)(-?\d+)? ?/i.exec(rtf.slice(i + 1));
      if (!m) {
        i++;
        continue;
      }
      i += m[0].length;
      const word = m[1];
      // A destination word right after "{" decides whether the group is skipped.
      if (RTF_SKIP.test(word) && rtf[i - m[0].length - 1] === '{') skip[skip.length - 1] = true;
      if (skip[skip.length - 1]) continue;
      if (word === 'uc') uc = Number(m[2] ?? 1);
      else if (word === 'u') {
        const code = Number(m[2]);
        out += String.fromCharCode(code < 0 ? code + 65536 : code);
        pendingSkip = uc;
      } else if (RTF_WORDS[word]) out += RTF_WORDS[word];
      continue;
    }
    if (skipping || c === '\n' || c === '\r') continue;
    if (pendingSkip) {
      pendingSkip--;
      continue;
    }
    out += c;
  }
  return out
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The text of a recipe file, for the kinds that have text to read. */
export async function recipeFileText(file: File): Promise<string> {
  const kind = recipeFileKind(file.name, file.type);
  if (kind === 'docx') return docxText(await file.arrayBuffer());
  const text = await file.text();
  return kind === 'rtf' ? rtfText(text) : text;
}
