/**
 * Printing without a print server: build a small self-contained HTML page
 * and print it from a hidden frame, so the tablet's own screen never
 * changes and the copy is clean (no buttons, no colours that waste ink).
 */

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape text for HTML (null and undefined print as nothing). */
export function escapeHtml(text: unknown): string {
  return String(text ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

const PRINT_CSS = `
  @page { margin: 16mm; }
  * { box-sizing: border-box; }
  body { font: 13px/1.45 -apple-system, system-ui, 'Segoe UI', sans-serif; color: #1b2630; margin: 0; }
  h1 { font: 600 24px/1.2 Georgia, serif; margin: 0 0 4px; }
  h2 { font: 600 15px/1.3 Georgia, serif; margin: 22px 0 8px; }
  .kick { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #5e6b74; }
  .sub { color: #5e6b74; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #5e6b74; border-bottom: 1.5px solid #1b2630; padding: 6px 8px 6px 0; }
  td { border-bottom: 1px solid #c9d2da; padding: 7px 8px 7px 0; vertical-align: top; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .tiles { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 4px; }
  .tile { border: 1px solid #c9d2da; border-radius: 8px; padding: 8px 12px; min-width: 110px; }
  .tile b { display: block; font: 600 20px/1.1 Georgia, serif; }
  .ft { margin-top: 26px; font-size: 11px; color: #5e6b74; }
`;

/** A whole printable page around a body, in the shared print style. */
export function printableDocument(title: string, body: string, extraCss = ''): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${PRINT_CSS}${extraCss}</style></head><body>${body}</body></html>`;
}

/**
 * Print an HTML page from a hidden frame. It prints once the page has
 * loaded (images and fonts included), and the frame stays a minute because
 * some browsers (the iPad's) return from print() before the dialog is done
 * with the page.
 */
export function printHtml(html: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      // Printing blocked (a sandboxed preview): nothing else to do.
    } finally {
      window.setTimeout(() => frame.remove(), 60_000);
    }
  };
  frame.srcdoc = html;
  document.body.appendChild(frame);
}
