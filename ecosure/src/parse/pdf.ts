/**
 * Thin layer over pdf.js: text lines with positions (top-left origin, PDF points,
 * like PyMuPDF) and image placements, plus helpers to cut photos out of a page.
 */
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

let ready: Promise<void> | null = null;
/** Run pdf.js in the page itself (no worker file to host). */
function init(): Promise<void> {
  return (ready ||= import('pdfjs-dist/build/pdf.worker.mjs').then((w) => {
    (globalThis as unknown as { pdfjsWorker: unknown }).pdfjsWorker = w;
  }));
}

export async function openPdf(data: ArrayBuffer | Uint8Array): Promise<PDFDocumentProxy> {
  await init();
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise;
}

export interface Line {
  x: number;
  y: number; // top
  y1: number; // bottom
  x1: number;
  t: string;
  size: number;
  bold: boolean;
}

export interface ImgPlacement {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  pw: number; // image pixel width
  ph: number;
}

export interface PageData {
  n: number;
  width: number;
  height: number;
  lines: Line[];
  images: ImgPlacement[];
  page: PDFPageProxy;
}

type M = [number, number, number, number, number, number];
const mul = (m: M, n: M): M => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];

export async function readPage(doc: PDFDocumentProxy, n: number): Promise<PageData> {
  const page = await doc.getPage(n + 1);
  const [vx0, vy0, vx1, vy1] = page.view;
  const width = vx1 - vx0, height = vy1 - vy0;
  const ops = await page.getOperatorList();
  const OPS = pdfjs.OPS;

  // Image placements, by tracking the transformation matrix.
  const images: ImgPlacement[] = [];
  let ctm: M = [1, 0, 0, 1, 0, 0];
  const stack: M[] = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i], args = ops.argsArray[i] as unknown[];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = mul(ctm, args as M);
    else if (fn === OPS.paintFormXObjectBegin) { stack.push(ctm); if (args[0]) ctm = mul(ctm, args[0] as M); }
    else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
      const id = typeof args[0] === 'string' ? args[0] : '';
      const pw = Number(args[1]) || 0, ph = Number(args[2]) || 0;
      const xs = [ctm[4], ctm[4] + ctm[0], ctm[4] + ctm[2], ctm[4] + ctm[0] + ctm[2]];
      const ys = [ctm[5], ctm[5] + ctm[1], ctm[5] + ctm[3], ctm[5] + ctm[1] + ctm[3]];
      images.push({ id, pw, ph, x0: Math.min(...xs) - vx0, x1: Math.max(...xs) - vx0, y0: height - (Math.max(...ys) - vy0), y1: height - (Math.min(...ys) - vy0) });
    }
  }

  // Font names (loaded by getOperatorList) tell us which text is bold.
  const tc = await page.getTextContent();
  const boldFont = new Map<string, boolean>();
  const isBold = (fontName: string): boolean => {
    if (!boldFont.has(fontName)) {
      let b = false;
      try {
        const f = page.commonObjs.has(fontName) ? (page.commonObjs.get(fontName) as { name?: string; bold?: boolean }) : null;
        b = !!f && (!!f.bold || /bold|black|heavy|semibold/i.test(f.name ?? ''));
      } catch { /* font not loaded: treat as regular */ }
      if (!b) b = /bold/i.test(tc.styles[fontName]?.fontFamily ?? '');
      boldFont.set(fontName, b);
    }
    return boldFont.get(fontName)!;
  };

  interface Run { x: number; x1: number; base: number; size: number; t: string; bold: boolean }
  const runs: Run[] = [];
  for (const it of tc.items) {
    // pdf.js fills gaps between text with whitespace items; spacing is rebuilt from positions instead.
    if (!('str' in it) || !it.str.trim()) continue;
    const tr = it.transform as number[];
    const size = Math.hypot(tr[2], tr[3]) || it.height || 0;
    const x = tr[4] - vx0;
    runs.push({ x, x1: x + it.width, base: height - (tr[5] - vy0), size, t: it.str, bold: isBold(it.fontName) });
  }
  runs.sort((a, b) => a.base - b.base || a.x - b.x);

  // Join runs that sit on the same baseline and touch into one line, like PyMuPDF does.
  const lines: Line[] = [];
  let cur: (Run & { parts: string[] }) | null = null;
  const flush = () => {
    if (!cur) return;
    const t = cur.parts.join('').replace(/\s+/g, ' ').trim();
    if (t) lines.push({ x: cur.x, x1: cur.x1, y: cur.base - cur.size * 0.9, y1: cur.base + cur.size * 0.22, t, size: cur.size, bold: cur.bold });
    cur = null;
  };
  for (const r of runs) {
    if (cur && Math.abs(r.base - cur.base) < 1.5 && r.x - cur.x1 < Math.max(4, r.size * 0.9) && r.x >= cur.x1 - r.size) {
      const gap = r.x - cur.x1;
      cur.parts.push(gap > r.size * 0.15 && !/\s$/.test(cur.parts[cur.parts.length - 1]) && !/^\s/.test(r.t) ? ' ' + r.t : r.t);
      cur.x1 = Math.max(cur.x1, r.x1);
      cur.size = Math.max(cur.size, r.size);
    } else {
      flush();
      cur = { ...r, parts: [r.t] };
    }
  }
  flush();
  return { n, width, height, lines, images, page };
}

export async function readAll(doc: PDFDocumentProxy): Promise<PageData[]> {
  const out: PageData[] = [];
  for (let i = 0; i < doc.numPages; i++) out.push(await readPage(doc, i));
  return out;
}

/** The decoded image object pdf.js keeps for a page (an ImageBitmap or raw pixels). */
async function imageObject(page: PDFPageProxy, id: string): Promise<unknown> {
  const objs = id.startsWith('g_') ? page.commonObjs : page.objs;
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 3000);
    try {
      objs.get(id, (v: unknown) => { clearTimeout(t); resolve(v); });
    } catch { clearTimeout(t); resolve(null); }
  });
}

function toCanvas(obj: unknown): HTMLCanvasElement | null {
  const o = obj as { bitmap?: ImageBitmap; width?: number; height?: number; data?: Uint8ClampedArray; kind?: number } | null;
  if (!o || !o.width || !o.height) return null;
  const c = document.createElement('canvas');
  c.width = o.width; c.height = o.height;
  const ctx = c.getContext('2d')!;
  if (o.bitmap) { ctx.drawImage(o.bitmap, 0, 0); return c; }
  if (!o.data) return null;
  const img = ctx.createImageData(o.width, o.height);
  const d = img.data, s = o.data, px = o.width * o.height;
  if (o.kind === 3 || s.length === px * 4) d.set(s.subarray(0, px * 4));
  else if (o.kind === 2 || s.length === px * 3) for (let i = 0; i < px; i++) { d[i * 4] = s[i * 3]; d[i * 4 + 1] = s[i * 3 + 1]; d[i * 4 + 2] = s[i * 3 + 2]; d[i * 4 + 3] = 255; }
  else return null; // 1-bit masks are not photos
  ctx.putImageData(img, 0, 0);
  return c;
}

const rendered = new WeakMap<PDFPageProxy, Promise<HTMLCanvasElement>>();
function renderPage(p: PDFPageProxy, scale: number): Promise<HTMLCanvasElement> {
  if (!rendered.has(p)) {
    rendered.set(p, (async () => {
      const vp = p.getViewport({ scale });
      const c = document.createElement('canvas');
      c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
      await p.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise;
      return c;
    })());
  }
  return rendered.get(p)!;
}

/** Downscale to at most `max` px on the long side and encode as JPEG. */
export async function toJpeg(src: HTMLCanvasElement, max = 1280, sx = 0, sy = 0, sw = src.width, sh = src.height): Promise<Blob> {
  const k = Math.min(1, max / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * k)); c.height = Math.max(1, Math.round(sh * k));
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode photo'))), 'image/jpeg', 0.82));
}

/** A photo as a JPEG blob: the embedded image when pdf.js hands it over, else a crop of the rendered page. */
export async function extractPhoto(pd: PageData, im: ImgPlacement): Promise<Blob> {
  if (im.id) {
    const c = toCanvas(await imageObject(pd.page, im.id));
    if (c && c.width >= 40) return toJpeg(c);
  }
  const scale = 150 / 72;
  const page = await renderPage(pd.page, scale);
  return toJpeg(page, 1280, im.x0 * scale, im.y0 * scale, (im.x1 - im.x0) * scale, (im.y1 - im.y0) * scale);
}
