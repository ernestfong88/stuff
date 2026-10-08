/**
 * Fit a printed menu to its paper: draw it in a hidden frame, measure each
 * page, split a page that will not fit at a readable size (or that was
 * asked for on two pages), and return the page with each sheet's fit
 * written into it. The same page goes to the preview and to the printer,
 * so what prints is what was previewed.
 */
import { useEffect, useState } from 'react';
import { splitDoc, splitUnits, type MenuDoc } from '../model/menuDoc';
import { docHtml, paperOf, printArea, type PrintOptions } from '../model/menuPrint';
import { FILL, fitCss, fitPlan, readableZoom, refineZoom, type Fit } from '../model/printFit';

/** How a menu may be split: never, when it does not fit readably on one page, or always (à la carte on two pages). */
export type SplitMode = 'none' | 'auto' | 'two';

export interface Fitted {
  html: string;
  /** The menu as printed, after any split. */
  doc: MenuDoc;
  fits: Fit[];
  /** A one page menu went onto two pages to stay readable. */
  overflowed: boolean;
}

const PX = 96;

function load(html: string, widthIn: number): Promise<HTMLIFrameElement> {
  return new Promise((resolve) => {
    const f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true');
    f.setAttribute('tabindex', '-1');
    f.style.cssText = `position:fixed;left:-10000px;top:0;width:${Math.ceil(widthIn * PX)}px;height:600px;border:0;visibility:hidden`;
    f.onload = () => {
      const fonts = f.contentDocument?.fonts;
      (fonts ? fonts.ready : Promise.resolve()).then(() => resolve(f));
    };
    f.srcdoc = html;
    document.body.appendChild(f);
  });
}

const sheets = (f: HTMLIFrameElement) => [...(f.contentDocument?.querySelectorAll<HTMLElement>('.sheet') ?? [])];

/** A sheet's height (px) drawn at a zoom and spacing, without the page-tall minimum. */
function heightAt(sheet: HTMLElement, zoom: number, space: number): number {
  const fit = sheet.querySelector<HTMLElement>('.fit')!;
  fit.style.minHeight = '0';
  fit.style.setProperty('zoom', String(zoom));
  fit.style.setProperty('--sp', String(space));
  return sheet.getBoundingClientRect().height;
}

/** Text and spacing heights (px) of a sheet at zoom 1: spacing is what grows between --sp 1 and 2. */
function measure(sheet: HTMLElement): { text: number; space: number } {
  const h1 = heightAt(sheet, 1, 1);
  const h2 = heightAt(sheet, 1, 2);
  return { text: h1 - (h2 - h1), space: h2 - h1 };
}

/** Each block's height (px) on the first sheet, with à la carte columns read as one. */
function blockHeights(f: HTMLIFrameElement, n: number): number[] {
  const d = f.contentDocument!;
  const style = d.createElement('style');
  style.textContent = '.cols{column-count:1!important}';
  d.head.appendChild(style);
  const sheet = sheets(f)[0];
  heightAt(sheet, 1, 1);
  const out = Array.from({ length: n }, (_, i) => sheet.querySelector<HTMLElement>(`[data-blk="${i}"]`)?.getBoundingClientRect().height ?? 0);
  style.remove();
  return out;
}

export async function fitMenu(doc: MenuDoc, o: PrintOptions, mode: SplitMode): Promise<Fitted> {
  const paper = paperOf(o.paper);
  const area = printArea(paper, doc.landscape);
  const avail = area.h * PX;
  const floor = readableZoom();
  let f = await load(docHtml(doc, o), area.w);
  try {
    let overflowed = false;
    if (mode !== 'none' && doc.sheets.length === 1 && splitUnits(doc.sheets[0].blocks).length > 1) {
      const m = measure(sheets(f)[0]);
      const tooLong = !fitPlan(m.text, m.space, avail, floor).readable;
      if (mode === 'two' || tooLong) {
        const heights = blockHeights(f, doc.sheets[0].blocks.length);
        doc = splitDoc(doc, heights);
        overflowed = mode === 'auto';
        f.remove();
        f = await load(docHtml(doc, o), area.w);
      }
    }
    const fits = sheets(f).map((sheet) => {
      const m = measure(sheet);
      // The week's rows stretch to fill the page rather than its type growing.
      const plan = fitPlan(m.text, m.space, avail, floor, doc.kind === 'week' ? 4 : undefined);
      // Text rewraps as it scales: check the page at its fit and close in on the zoom that fills it.
      let zoom = plan.zoom;
      for (let i = 0; i < 5; i++) {
        const next = refineZoom(zoom, heightAt(sheet, zoom, plan.space), avail);
        if (next === zoom) break;
        zoom = next;
      }
      // Whatever the steps did, never leave a page that runs over.
      const h = heightAt(sheet, zoom, plan.space);
      if (h > avail * (FILL + 0.015)) zoom = Math.floor(((zoom * avail * FILL) / h) * 1000) / 1000;
      return { ...plan, zoom, readable: zoom >= floor - 1e-6 };
    });
    const html = docHtml(doc, o).replace('</style>', fitCss(fits, area.h) + '</style>');
    return { html, doc, fits, overflowed };
  } finally {
    f.remove();
  }
}

/**
 * A menu fitted to its paper, refitted when it changes. Until the first fit
 * lands it is null; after that the last fit stays up while the next one
 * is measured, so the preview never flashes an unfitted page.
 */
export function useFittedMenu(doc: MenuDoc, o: PrintOptions, mode: SplitMode): { fitted: Fitted | null; current: boolean } {
  const [state, setState] = useState<{ fitted: Fitted; doc: MenuDoc; o: PrintOptions; mode: SplitMode } | null>(null);
  useEffect(() => {
    let live = true;
    fitMenu(doc, o, mode)
      .then((fitted) => live && setState({ fitted, doc, o, mode }))
      // Measuring failed: the preview keeps the page as designed.
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [doc, o, mode]);
  return { fitted: state?.fitted ?? null, current: !!state && state.doc === doc && state.o === o && state.mode === mode };
}
