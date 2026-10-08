/**
 * Photos bundled from src/assets. Vite resolves the globs at build time, so the
 * app knows exactly which photos exist and never requests a missing file.
 */
const residentFiles = import.meta.glob('../assets/residents/*.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const dishFiles = import.meta.glob('../assets/dishes/*.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const baseName = (path: string) => path.split('/').pop()!.replace(/\.[a-z]+$/i, '');

const residentPhotos = new Map(Object.entries(residentFiles).map(([p, url]) => [baseName(p), url]));
const dishPhotos = new Map(Object.entries(dishFiles).map(([p, url]) => [baseName(p), url]));

/** URL of a resident's portrait, or null when none is bundled. */
export function residentPhoto(residentId: string | null | undefined): string | null {
  return (residentId && residentPhotos.get(residentId)) || null;
}

/** "Peach Glazed Chicken Breast" -> "peach-glazed-chicken-breast" */
export function dishSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** URL of a dish photo by dish name, or null. Wide falls back to the regular photo. */
export function dishPhoto(name: string | null | undefined, wide = false): string | null {
  if (!name) return null;
  const slug = dishSlug(name);
  return (wide && dishPhotos.get(slug + '-wide')) || dishPhotos.get(slug) || null;
}
