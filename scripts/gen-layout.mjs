// Menghasilkan src/gt65/layout.ts dari KeyboardLayout.xml milik vendor.
// Pakai: node scripts/gen-layout.mjs <path-ke-KeyboardLayout.xml>
import { readFileSync, writeFileSync } from 'node:fs';

const src = process.argv[2];
if (!src) {
  console.error('pakai: node scripts/gen-layout.mjs <KeyboardLayout.xml>');
  process.exit(1);
}

// XML vendor tidak valid pada tombol kutip: name=""" desc="""
const xml = readFileSync(src, 'utf8').replaceAll('"""', '"&quot;"');

// Tombol ">" punya name/desc berisi literal ">", yang membuat regex tag
// naif ([^>]*?) berhenti terlalu awal dan melewatkan tombol tersebut.
// Grup atribut di bawah mencocokkan nilai berkutip secara utuh (boleh
// berisi ">") agar tombol itu tetap terbaca.
const keys = [...xml.matchAll(/<key\s+((?:[^">]|"[^"]*")*?)\s*\/>/g)].map((m) => {
  const a = Object.fromEntries(
    [...m[1].matchAll(/(\w+)\s*=\s*"([^"]*)"/g)].map((x) => [x[1], x[2]]),
  );
  return {
    usage: parseInt(a.code, 16),
    name: a.name === '&quot;' ? '"' : a.name,
    x: Number(a.rect_left),
    y: Number(a.rect_top),
    w: Number(a.rect_width),
    h: Number(a.rect_height),
    keyIndex: Number(a.key_index),
    lightIndex: Number(a.light_index),
  };
});

if (keys.length === 0) throw new Error('tidak ada <key> yang terbaca');

const out = `// DIHASILKAN OLEH scripts/gen-layout.mjs — jangan diedit manual.
export type KeyDef = {
  usage: number; name: string;
  x: number; y: number; w: number; h: number;
  keyIndex: number; lightIndex: number;
};

export const LAYOUT_SIZE = { width: 800, height: 300 };

export const KEYS: KeyDef[] = ${JSON.stringify(keys, null, 2)};
`;

writeFileSync('src/gt65/layout.ts', out);
console.log(`ditulis ${keys.length} tombol ke src/gt65/layout.ts`);
