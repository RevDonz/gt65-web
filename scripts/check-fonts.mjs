import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const assets = readdirSync(join(DIST, 'assets'));
const woff2 = assets.filter((f) => f.endsWith('.woff2'));

if (woff2.length !== 4) {
  console.error(`check-fonts: diharapkan 4 berkas woff2 di dist/assets, dapat ${woff2.length}`);
  process.exit(1);
}

for (const html of readdirSync(DIST).filter((f) => f.endsWith('.html'))) {
  const s = readFileSync(join(DIST, html), 'utf8');
  if (s.includes('fonts.googleapis.com') || s.includes('fonts.gstatic.com')) {
    console.error(`check-fonts: ${html} masih menarik font dari jaringan`);
    process.exit(1);
  }
}

console.log(`check-fonts: ${woff2.length} berkas font terbundel, tidak ada rujukan jaringan`);
