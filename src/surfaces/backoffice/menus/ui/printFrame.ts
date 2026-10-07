/**
 * Print a generated page from a hidden frame, so the screen itself never
 * goes to the printer and the Back Office page stays where it was.
 */
export function printHtml(html: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('tabindex', '-1');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      // Some browsers return from print() before the dialog closes; keep the frame a while.
      window.setTimeout(() => frame.remove(), 60_000);
    }
  };
  frame.srcdoc = html;
  document.body.appendChild(frame);
}
