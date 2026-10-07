/**
 * Row-wise bump bar navigation over a ticket grid.
 *
 * The grid is auto-fill, so the number of columns changes with the screen
 * width and with how many tickets are up. Never assume a column count:
 * group the tickets actually on screen by their top edge. That keeps it
 * right on a KDS, on an all-in-one PC and on a tablet.
 *
 * Tickets are marked with data-kticket="<index>" inside a scroll container
 * marked data-kscroll.
 */

const TICKET_ATTR = 'data-kticket';

function ticketRows(): HTMLElement[][] {
  const rows: HTMLElement[][] = [];
  let lastTop: number | null = null;
  for (const el of document.querySelectorAll<HTMLElement>(`[${TICKET_ATTR}]`)) {
    const top = Math.round(el.getBoundingClientRect().top);
    if (lastTop === null || Math.abs(top - lastTop) > 4) rows.push([]);
    lastTop = top;
    rows[rows.length - 1].push(el);
  }
  return rows;
}

const indexOf = (el: HTMLElement) => Number(el.getAttribute(TICKET_ATTR));

/** The ticket in the row above (dir -1) or below (dir 1), in the same column where it can be. */
export function rowJump(current: number, dir: -1 | 1): number {
  const rows = ticketRows();
  let r = -1;
  let c = 0;
  rows.forEach((row, ri) =>
    row.forEach((el, ci) => {
      if (indexOf(el) === current) {
        r = ri;
        c = ci;
      }
    }),
  );
  if (r < 0) return current;
  const target = rows[r + dir];
  if (!target) return current;
  return indexOf(target[Math.min(c, target.length - 1)]);
}

/**
 * Scroll so the whole row holding the ticket is in view, not just the
 * ticket: rows vary in height, and left and right could otherwise walk off
 * screen.
 */
export function showTicketRow(index: number): void {
  requestAnimationFrame(() => {
    const row = ticketRows().find((r) => r.some((el) => indexOf(el) === index));
    const scroller = row?.[0].closest<HTMLElement>('[data-kscroll]');
    if (!row || !scroller) return;
    const box = scroller.getBoundingClientRect();
    const top = Math.min(...row.map((el) => el.getBoundingClientRect().top));
    const bottom = Math.max(...row.map((el) => el.getBoundingClientRect().bottom));
    if (top < box.top) scroller.scrollTop += top - box.top - 8;
    else if (bottom > box.bottom) scroller.scrollTop += Math.min(bottom - box.bottom + 8, top - box.top - 8);
  });
}
