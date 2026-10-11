/** "Top 5, expand for more": every list starts short and can be opened by the reader. */
export const OPEN = new Set<string>();

export function top<T>(key: string, xs: T[], n = 5, noun = ''): { shown: T[]; more: string } {
  const open = OPEN.has(key);
  const shown = open ? xs : xs.slice(0, n);
  const more = xs.length > n
    ? `<p class="more"><button class="btn quiet sm" data-act="expand:${key}" aria-expanded="${open}">${open ? `Show top ${n} only` : `Show all ${xs.length}${noun ? ' ' + noun : ''}`}</button></p>`
    : '';
  return { shown, more };
}

/** A collapsed section the reader can open; it stays open across re-renders. */
export const fold = (key: string, title: string, body: string, open = false) =>
  body ? `<details class="fold" data-fold="${key}"${open || OPEN.has('fold:' + key) ? ' open' : ''}><summary>${title}</summary><div class="foldbody">${body}</div></details>` : '';
