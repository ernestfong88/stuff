import { mergeConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import base from './vite.config.ts';

const ICON_TYPES: Record<string, string> = { '.png': 'image/png', '.svg': 'image/svg+xml' };

/** Vite keeps <link rel="icon"> (SVG favicon, PNG touch icon) as separate files; embed them so nothing sits next to the page. */
function inlineIcons(): Plugin {
  return {
    name: 'kisco-inline-icons',
    enforce: 'post',
    generateBundle(_opts, bundle) {
      const html = Object.values(bundle).find((f) => f.type === 'asset' && f.fileName.endsWith('.html'));
      if (!html || html.type !== 'asset') return;
      let source = String(html.source);
      for (const [name, file] of Object.entries(bundle)) {
        const type = ICON_TYPES[name.slice(name.lastIndexOf('.'))];
        if (file.type !== 'asset' || !type || !source.includes(name)) continue;
        const uri = `data:${type};base64,` + Buffer.from(file.source).toString('base64');
        // The same file can also be imported by a script (the mark in the sidebar), which points at it with new URL(`name`, import.meta.url).
        for (const q of ['`', '"', "'"]) source = source.split(`new URL(${q}${name}${q},import.meta.url).href`).join(JSON.stringify(uri));
        source = source.split('./' + name).join(uri);
        // Keep the file if anything still names it.
        if (!source.includes(name)) delete bundle[name];
      }
      html.source = source;
    },
  };
}

/**
 * One self-contained HTML file (every surface, script and style inlined),
 * like the original mockup: easy to email or open from a tablet's files.
 */
export default mergeConfig(base, {
  plugins: [viteSingleFile(), inlineIcons()],
  build: { outDir: 'dist-single', emptyOutDir: true },
});
