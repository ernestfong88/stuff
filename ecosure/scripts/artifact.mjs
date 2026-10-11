// Turns dist/index.html into dist/artifact.html: the page content without the
// <!doctype>/<html>/<head>/<body> wrapper, which claude.ai adds when publishing.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
const rawHead = html.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? '';
// Pull scripts out first: the app code contains markup strings such as <title>.
const scripts = [...rawHead.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)].map((m) => m[0]);
const head = scripts.reduce((h, s) => h.replace(s, ''), rawHead);
const body = html.match(/<body>([\s\S]*?)<\/body>/i)?.[1] ?? '';
const pick = (re) => [...head.matchAll(re)].map((m) => m[0]);
const title = pick(/<title>[\s\S]*?<\/title>/gi);
const links = pick(/<link\b[^>]*>/gi);
const styles = pick(/<style\b[^>]*>[\s\S]*?<\/style>/gi);
// Title and styles first (the title must sit in the first 8 KB), the app script last.
const out = [...title, ...links, ...styles, body.trim(), ...scripts].join('\n');
writeFileSync('dist/artifact.html', out);
console.log(`dist/artifact.html ${(out.length / 1e6).toFixed(2)} MB`);
