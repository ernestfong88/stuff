/** "⌘ K" on a Mac, "Ctrl K" everywhere else. */
export function shortcutLabel(platform: string = typeof navigator === 'undefined' ? '' : navigator.platform || navigator.userAgent): string {
  return /Mac|iPhone|iPad/.test(platform) ? '⌘ K' : 'Ctrl K';
}

/** Ctrl K or ⌘ K, the page search shortcut. */
export function isSearchShortcut(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>): boolean {
  return (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k';
}
