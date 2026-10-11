// Extracts the starting data (AUDITS and PHOTOS) from the previous review page into
// src/data/legacy-seed.json, which the build embeds. The file is git-ignored because
// it holds real audit data.  Usage: npm run seed -- path/to/EcoSure_Audit_Review.html
import { readFileSync, writeFileSync } from 'node:fs';

const src = process.argv[2];
if (!src) { console.error('Usage: npm run seed -- path/to/EcoSure_Audit_Review.html'); process.exit(1); }
const html = readFileSync(src, 'utf8');
const a = html.match(/const AUDITS=(\[.*?\]);\s*\n/s);
const p = html.match(/const PHOTOS=(\{.*?\});\s*\n/s);
if (!a) { console.error('No AUDITS found in ' + src); process.exit(1); }
const audits = JSON.parse(a[1]);
const all = p ? JSON.parse(p[1]) : {};
const used = new Set(audits.flatMap((x) => x.items.flatMap((i) => i.photos)));
const photos = Object.fromEntries(Object.entries(all).filter(([k]) => used.has(k)));
writeFileSync(new URL('../src/data/legacy-seed.json', import.meta.url), JSON.stringify({ audits, photos }));
console.log(`${audits.length} audits, ${Object.keys(photos).length} photos written to src/data/legacy-seed.json`);
