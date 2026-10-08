import { mergeConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import base from './vite.config.ts';

/** Vite keeps <link rel="icon"> as a separate file; embed it so nothing sits next to the page. */
function inlineIcons(): Plugin {
  return {
    name: 'kisco-inline-icons',
    enforce: 'post',
    generateBundle(_opts, bundle) {
      const html = Object.values(bundle).find((f) => f.type === 'asset' && f.fileName.endsWith('.html'));
      if (!html || html.type !== 'asset') return;
      let source = String(html.source);
      for (const [name, file] of Object.entries(bundle)) {
        if (file.type !== 'asset' || !name.endsWith('.png') || !source.includes(name)) continue;
        const uri = 'data:image/png;base64,' + Buffer.from(file.source as Uint8Array).toString('base64');
        source = source.split('./' + name).join(uri);
        delete bundle[name];
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
