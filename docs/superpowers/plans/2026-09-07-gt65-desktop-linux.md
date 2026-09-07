# GT65 Configurator Desktop (Linux) — Rencana Implementasi

> **Untuk pekerja agentik:** SUB-SKILL WAJIB: pakai superpowers:subagent-driven-development
> (dianjurkan) atau superpowers:executing-plans untuk mengeksekusi rencana ini
> tugas-demi-tugas. Langkah memakai sintaks kotak centang (`- [ ]`) untuk penandaan.

**Goal:** Membungkus konfigurator WebHID `gt65-web` yang sudah ada menjadi aplikasi
desktop Linux, lalu merilisnya sebagai `.deb`, `.rpm`, dan AppImage di GitHub.

**Arsitektur:** Proses main Electron memuat aplikasi React yang ada apa adanya lewat
skema protokol kustom `app://gt65` — bukan `file://`, karena origin buram membuat
`navigator.hid` tidak terdefinisi. Diskriminasi interface HID tetap di renderer;
proses main hanya menyaring vendor+produk. Tidak ada fitur baru dan tidak ada
perubahan protokol, kecuali deteksi akses hidraw hanya-baca yang wajib ada karena
AppImage tidak bisa memasang aturan udev.

**Tech Stack:** Electron 44.2.0, electron-builder 26.15.3, esbuild 0.28.2, Vite 6,
React 19, TypeScript 5.7, vitest 2.1, Node 22.

**Spec:** `docs/superpowers/specs/2026-09-07-gt65-desktop-app-design.md` (revisi 2)

## Global Constraints

- **Linux saja.** Tidak ada target Windows atau macOS. Tidak ada `app.on('activate')`
  (event macOS). Tidak ada penandatanganan kode.
- **Versi rilis pertama `0.1.0`**, ditandai prerelease.
- **Perangkat gagal senyap.** Setiap kegagalan yang bisa dicegah harus dicegah; setiap
  yang tidak bisa dicegah harus terlihat. Jangan pernah menambahkan jalur yang gagal
  tanpa pesan.
- **Suite yang ada wajib tetap hijau:** 13 berkas, 201 test. Itu batas regresi.
- **`registerSchemesAsPrivileged` wajib dipanggil sebelum `app.whenReady()`.**
- **Nol flag Ozone.** Electron 44 memilih Wayland sendiri. Memaksa
  `--ozone-platform=wayland` di sesi X11 mematikan prosesnya.
- **Tidak ada `electron/preload.ts`.** Renderer tidak butuh apa pun dari Node.
- **Gerbang izin harus mengizinkan `hid` DAN `clipboard-sanitized-write`.** Menolak
  yang kedua mematahkan tombol "Salin log" di `LogPanel.tsx:75`.
- **VID/PID:** `0x05AC` / `0x024F`. Aturan udev bernomor **70** (harus < 73).
- Nama biner `gt65-configurator`; `productName` `GT65 Configurator`;
  `appId` `id.lintas.gt65configurator`.
- Semua teks yang dilihat pengguna berbahasa Indonesia, mengikuti nada README yang ada.

---

## Struktur berkas

| Berkas | Tanggung jawab |
|---|---|
| `electron/main.ts` | Daur hidup, jendela, protokol, izin, endpoint diagnostik |
| `electron/lib/resolvePath.ts` | Murni: URL `app://` → lintasan berkas, dengan penjagaan |
| `electron/lib/hidAccess.ts` | Murni: temukan node hidraw GT65, periksa bisa-tulis |
| `scripts/build-electron.mjs` | esbuild: `electron/*.ts` → `dist-electron/*.cjs` |
| `scripts/dev-electron.mjs` | Tunggu vite dev server, luncurkan Electron |
| `scripts/check-fonts.mjs` | Gagalkan build bila font tidak ikut ke `dist/` |
| `src/app/HidAccessBanner.tsx` | Spanduk instruksi udev bila perangkat hanya-baca |
| `build/70-gt65.rules` | Aturan udev |
| `build/linux-after-install.sh` | Skrip pasca-pasang deb/rpm |
| `build/linux-after-remove.sh` | Skrip pasca-hapus deb/rpm |
| `build/id.lintas.gt65configurator.metainfo.xml` | AppStream, agar muncul di GNOME Software / KDE Discover |
| `build/icon.png` | 1024×1024, sumber semua ikon turunan |
| `electron-builder.yml` | Konfigurasi paket |
| `.github/workflows/release.yml` | Build dan terbitkan rilis dari tag |

---

## Task 1: Amankan pekerjaan yang menggantung dan tetapkan garis dasar

Cabang `feat/protocol-core` punya berkas termodifikasi dan lima berkas HTML
**untracked yang sudah dirujuk `vite.config.ts`**. Tanpa di-commit, build multi-halaman
gagal dan setiap tugas berikutnya berdiri di atas pasir.

**Files:**
- Commit: `index.html`, `lighting.html`, `log.html`, `monitor.html`, `settings.html`,
  `tester.html`, `src/**`, `test/**`, `vite.config.ts`
- Hapus: `.fonttest/` (sisa agen riset)
- Modify: `.gitignore`

- [ ] **Step 1: Bersihkan sisa dan periksa apa yang menggantung**

```bash
rm -rf .fonttest
git status --short
```

Yang untracked dan WAJIB masuk: kelima berkas HTML. `AGENTS.md` adalah berkas konteks
alat, jangan di-commit.

- [ ] **Step 2: Tambahkan entri gitignore yang akan dibutuhkan**

Tambahkan ke `.gitignore`:

```
dist-electron/
release/
.fonttest/
AGENTS.md
```

- [ ] **Step 3: Jalankan garis dasar — catat hasilnya apa adanya**

```bash
npm test 2>&1 | tail -20
npm run build 2>&1 | tail -20
```

Harapan: 201 test lulus, build sukses. **Kalau ada yang merah, berhenti dan laporkan.**
Jangan memperbaiki apa pun di tugas ini — garis dasar yang jujur lebih berguna daripada
garis dasar yang hijau.

- [ ] **Step 4: Commit**

```bash
git add index.html lighting.html log.html monitor.html settings.html tester.html \
        src test vite.config.ts .gitignore
git commit -m "feat: halaman terpisah per panel dan desain ulang antarmuka

Kelima berkas HTML sudah dirujuk vite.config.ts tetapi belum pernah
di-commit, sehingga build multi-halaman gagal pada salinan bersih."
```

---

## Task 2: Metadata paket yang electron-builder butuhkan

**Interfaces:**
- Produces: `package.json` dengan `version`, `main`, `productName` — dikonsumsi Task 8.

electron-builder membaca `version` lewat `checkNotEmpty("version", metadata.version)`
di `out/util/packageMetadata.js:54` dan **melempar** bila kosong. Tanpa `productName`,
aplikasi terpasang di `/opt/gt65-web`, bukan `/opt/GT65 Configurator`.

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Tambahkan metadata dan skrip**

**Ini penambahan, bukan penggantian.** `package.json` yang ada memuat 5 skrip dan 12
devDependencies (vite, typescript, tailwind, vitest, dan lainnya). Menimpanya dengan
blok di bawah akan merusak repo. Sisipkan field yang belum ada, biarkan sisanya utuh:

```json
"version": "0.1.0",
"description": "Konfigurator desktop VortexSeries GT65 lewat WebHID",
"homepage": "https://github.com/RevDonz/gt65-web",
"author": "Reva Doni Aprilio <ai@lintas.net.id>",
"license": "MIT",
"main": "dist-electron/main.cjs"
```

Verifikasi tidak ada yang hilang setelah menyunting:

```bash
node -e "
const p = require('./package.json');
const wajib = ['dev','build','preview','test','test:watch'];
const hilang = wajib.filter(k => !(k in p.scripts));
if (hilang.length) { console.error('SKRIP HILANG:', hilang); process.exit(1); }
if (!p.version || !p.main) { console.error('version atau main belum diisi'); process.exit(1); }
console.log('package.json utuh:', Object.keys(p.scripts).length, 'skrip,',
            Object.keys(p.devDependencies).length, 'devDependencies');
"
```

Tambahkan ke `scripts`:

```json
"build:electron": "node scripts/build-electron.mjs",
"dev:desktop": "node scripts/dev-electron.mjs",
"pack:linux": "npm run build && npm run build:electron && electron-builder --linux --publish never"
```

`homepage` dipin eksplisit supaya build di direktori tanpa `.git` tidak melempar
"Please specify project homepage".

- [ ] **Step 2: Pasang dependensi Electron**

```bash
npm install --save-dev --save-exact electron@44.2.0 electron-builder@26.15.3 esbuild@0.28.2
```

- [ ] **Step 3: Pastikan suite masih hijau**

```bash
npm test 2>&1 | tail -5
```

Harapan: 201 test lulus. Menambah dependensi tidak boleh mengubah apa pun.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: metadata paket dan dependensi Electron"
```

---

## Task 3: Font lokal, aplikasi mandiri offline

**Interfaces:**
- Produces: `dist/assets/*.woff2` — dikonsumsi Task 5 (CSP tanpa host Google) dan Task 8.

Keenam HTML menarik font dari `fonts.googleapis.com`. Di aplikasi desktop itu berarti
butuh internet untuk tampil benar, dan tiap peluncuran mengirim permintaan ke Google.

**Files:**
- Create: `src/fonts/*.woff2`, `public/licenses/OFL-Archivo.txt`,
  `public/licenses/OFL-MartianMono.txt`, `scripts/check-fonts.mjs`
- Modify: `src/index.css`, keenam berkas HTML, `package.json`

- [ ] **Step 1: Ambil font dan lisensinya**

```bash
npm install --save-dev --save-exact \
  @fontsource-variable/archivo@5.3.0 \
  @fontsource-variable/martian-mono@5.3.0

mkdir -p src/fonts public/licenses
cp node_modules/@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2 src/fonts/
cp node_modules/@fontsource-variable/archivo/files/archivo-latin-ext-wght-normal.woff2 src/fonts/
cp node_modules/@fontsource-variable/martian-mono/files/martian-mono-latin-wght-normal.woff2 src/fonts/
cp node_modules/@fontsource-variable/martian-mono/files/martian-mono-latin-ext-wght-normal.woff2 src/fonts/

curl -fsSL -o public/licenses/OFL-Archivo.txt \
  https://raw.githubusercontent.com/Omnibus-Type/Archivo/master/OFL.txt
curl -fsSL -o public/licenses/OFL-MartianMono.txt \
  https://raw.githubusercontent.com/evilmartians/mono/main/OFL.txt
```

Keduanya SIL Open Font License 1.1; menyertakan teks lisensinya adalah kewajiban saat
mendistribusikan berkas fontnya.

- [ ] **Step 2: Ganti `<link>` dengan `@font-face` lokal**

Sisipkan di **paling atas** `src/index.css`, sebelum baris lain apa pun:

```css
@font-face {
  font-family: 'Archivo';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url('./fonts/archivo-latin-wght-normal.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA,
    U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193,
    U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Archivo';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url('./fonts/archivo-latin-ext-wght-normal.woff2') format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF,
    U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020,
    U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: 'Martian Mono';
  font-style: normal;
  font-weight: 100 800;
  font-display: swap;
  src: url('./fonts/martian-mono-latin-wght-normal.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA,
    U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193,
    U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Martian Mono';
  font-style: normal;
  font-weight: 100 800;
  font-display: swap;
  src: url('./fonts/martian-mono-latin-ext-wght-normal.woff2') format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF,
    U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020,
    U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
```

Rentang `font-weight` memakai sintaks variabel, jadi satu berkas per subset
menggantikan keempat berat yang dulu diminta dari Google.

- [ ] **Step 3: Hapus ketiga baris jaringan dari keenam berkas HTML**

Di `index.html`, `lighting.html`, `log.html`, `monitor.html`, `settings.html`,
`tester.html`, hapus dua `<link rel="preconnect">` dan satu `<link>` ke
`fonts.googleapis.com`. Jangan sentuh `data-page` pada `<body>`.

```bash
for f in index.html lighting.html log.html monitor.html settings.html tester.html; do
  python3 - "$f" <<'PY'
import re,sys
p=sys.argv[1]; s=open(p).read()
s=re.sub(r'\s*<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\n?', '\n', s)
open(p,'w').write(s)
PY
done
grep -l 'fonts.googleapis' *.html || echo "bersih"
```

- [ ] **Step 4: Tulis penjaga build**

Vite keluar dengan status 0 walaupun berkas font hilang, jadi tanpa penjaga ini
regresi font tidak akan terdeteksi sampai pengguna melihatnya.

Buat `scripts/check-fonts.mjs`:

```js
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
```

Sambungkan ke skrip build di `package.json`:

```json
"build": "tsc --noEmit && vite build && node scripts/check-fonts.mjs"
```

- [ ] **Step 5: Jalankan build dan pastikan penjaganya menyala**

```bash
npm run build 2>&1 | tail -8
```

Harapan: baris `check-fonts: 4 berkas font terbundel, tidak ada rujukan jaringan`.

Lalu buktikan penjaganya benar-benar bisa gagal — kalau tidak, ia hanya hiasan:

```bash
mv src/fonts/archivo-latin-wght-normal.woff2 /tmp/ && npm run build 2>&1 | tail -3
mv /tmp/archivo-latin-wght-normal.woff2 src/fonts/ && npm run build 2>&1 | tail -3
```

Harapan: gagal lebih dulu, lalu lulus lagi.

- [ ] **Step 6: Commit**

```bash
git add src/fonts public/licenses src/index.css scripts/check-fonts.mjs \
        package.json package-lock.json *.html
git commit -m "feat: bundel font secara lokal agar aplikasi mandiri offline

Keenam halaman menarik Archivo dan Martian Mono dari fonts.googleapis.com.
Di aplikasi desktop itu berarti butuh internet untuk tampil benar dan
mengirim permintaan ke Google tiap peluncuran, yang bertentangan dengan
klaim bebas telemetri proyek ini."
```

---

## Task 4: Dua fungsi murni — pemetaan URL dan pemeriksaan akses hidraw

**Interfaces:**
- Produces: `resolveAssetPath(requestUrl: string, root: string): string | null` dan
  `SCHEME`/`HOST` dari `electron/lib/resolvePath.ts`.
- Produces: `pickGt65Nodes(entries: UeventEntry[]): string[]` dan
  `gt65HidrawStatus(): Promise<HidrawStatus>` dari `electron/lib/hidAccess.ts`.
- Keduanya dikonsumsi `electron/main.ts` di Task 5.

Kedua fungsi ini murni dan bisa diuji tanpa menjalankan Electron, jadi keduanya
ditulis lebih dulu dengan test. Sisa proses main tidak bisa diuji begitu, dan itulah
alasan bagian yang punya logika dipisahkan ke sini.

**Files:**
- Create: `electron/lib/resolvePath.ts`, `test/resolvePath.test.ts`,
  `electron/lib/hidAccess.ts`, `test/hidAccess.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

Buat `test/resolvePath.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveAssetPath } from '../electron/lib/resolvePath';

const ROOT = '/app/dist';

describe('resolveAssetPath', () => {
  it('memetakan akar ke index.html', () => {
    expect(resolveAssetPath('app://gt65/', ROOT)).toBe('/app/dist/index.html');
  });

  it('memetakan halaman biasa', () => {
    expect(resolveAssetPath('app://gt65/lighting.html', ROOT)).toBe('/app/dist/lighting.html');
  });

  it('membuang query dan fragment', () => {
    expect(resolveAssetPath('app://gt65/assets/x.js?v=1#a', ROOT)).toBe('/app/dist/assets/x.js');
  });

  it('menolak host lain', () => {
    expect(resolveAssetPath('app://jahat/index.html', ROOT)).toBeNull();
  });

  it('menolak skema lain', () => {
    expect(resolveAssetPath('http://gt65/index.html', ROOT)).toBeNull();
  });

  it('menolak traversal ter-encode', () => {
    expect(resolveAssetPath('app://gt65/..%2f..%2fetc/passwd', ROOT)).toBeNull();
    expect(resolveAssetPath('app://gt65/%2e%2e%2f%2e%2e%2fetc/passwd', ROOT)).toBeNull();
    expect(resolveAssetPath('app://gt65/foo/..%2f..%2f..%2fetc/passwd', ROOT)).toBeNull();
  });

  it('menolak byte nol', () => {
    expect(resolveAssetPath('app://gt65/index.html%00.png', ROOT)).toBeNull();
  });

  it('menolak persen-encoding rusak', () => {
    expect(resolveAssetPath('app://gt65/%zz', ROOT)).toBeNull();
  });

  it('menolak URL tak valid', () => {
    expect(resolveAssetPath('bukan url', ROOT)).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

```bash
npx vitest run test/resolvePath.test.ts
```

Harapan: GAGAL dengan "Failed to resolve import ../electron/lib/resolvePath".

- [ ] **Step 3: Tulis implementasinya**

Buat `electron/lib/resolvePath.ts`:

```ts
import path from 'node:path';

export const SCHEME = 'app';
export const HOST = 'gt65';

/**
 * Memetakan URL app:// ke lintasan absolut di dalam `root`.
 * Mengembalikan null bila permintaan harus ditolak.
 *
 * Karena skema didaftarkan `standard: true`, parser URL sudah menormalkan
 * segmen '..' yang polos (app://gt65/../x -> /x). Yang TIDAK dinormalkan
 * adalah bentuk ter-encode ('..%2f', '%2e%2e%2f'): itu baru muncul setelah
 * decodeURIComponent dan benar-benar keluar dari root. Penjagaan startsWith
 * di bawah yang menahannya.
 */
export function resolveAssetPath(requestUrl: string, root: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(requestUrl);
  } catch {
    return null;
  }

  // Host tetap. app://gt65 dan app://lain adalah origin berbeda; hanya satu
  // yang boleh dilayani, kalau tidak izin perangkat bisa bocor lintas origin.
  if (parsed.protocol !== `${SCHEME}:` || parsed.hostname !== HOST) return null;

  let rel: string;
  try {
    rel = decodeURIComponent(parsed.pathname);
  } catch {
    return null; // persen-encoding rusak, mis. '%zz'
  }

  if (rel.includes('\0')) return null;
  if (rel === '' || rel === '/') rel = '/index.html';

  const joined = path.normalize(path.join(root, rel));

  // Penjagaan sesungguhnya: hasil akhir harus tetap di dalam root.
  if (joined !== root && !joined.startsWith(root + path.sep)) return null;

  return joined;
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

```bash
npx vitest run test/resolvePath.test.ts
npm test 2>&1 | tail -5
```

Harapan: berkas baru lulus; total menjadi 210 test.

- [ ] **Step 5: Tulis test akses hidraw yang gagal**

Buat `test/hidAccess.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pickGt65Nodes } from '../electron/lib/hidAccess';

describe('pickGt65Nodes', () => {
  it('memilih node yang HID_ID-nya cocok GT65', () => {
    const entries = [
      { name: 'hidraw0', uevent: 'HID_ID=0003:00001EA7:00000066\nHID_NAME=Mouse\n' },
      { name: 'hidraw2', uevent: 'HID_ID=0003:000005AC:0000024F\nHID_NAME=USB Dongle\n' },
      { name: 'hidraw3', uevent: 'HID_ID=0003:000005AC:0000024F\nHID_NAME=USB Dongle\n' },
    ];
    expect(pickGt65Nodes(entries)).toEqual(['/dev/hidraw2', '/dev/hidraw3']);
  });

  it('cocok tanpa peduli besar-kecil huruf', () => {
    const entries = [{ name: 'hidraw1', uevent: 'HID_ID=0003:000005ac:0000024f\n' }];
    expect(pickGt65Nodes(entries)).toEqual(['/dev/hidraw1']);
  });

  it('tidak cocok bila hanya vendor yang sama (keyboard Apple asli)', () => {
    const entries = [{ name: 'hidraw1', uevent: 'HID_ID=0003:000005AC:00000250\n' }];
    expect(pickGt65Nodes(entries)).toEqual([]);
  });

  it('mengembalikan daftar kosong bila tidak ada yang cocok', () => {
    expect(pickGt65Nodes([{ name: 'hidraw0', uevent: 'HID_ID=0003:1:2\n' }])).toEqual([]);
  });

  it('mengabaikan uevent tanpa HID_ID', () => {
    expect(pickGt65Nodes([{ name: 'hidraw0', uevent: 'DEVNAME=hidraw0\n' }])).toEqual([]);
  });
});
```

- [ ] **Step 6: Jalankan test, pastikan gagal**

```bash
npx vitest run test/hidAccess.test.ts
```

Harapan: GAGAL — modulnya belum ada.

- [ ] **Step 7: Tulis implementasinya**

Buat `electron/lib/hidAccess.ts`:

```ts
import { constants, promises as fs } from 'node:fs';
import path from 'node:path';

const VENDOR_ID = 0x05ac;
const PRODUCT_ID = 0x024f;
const SYSFS_HIDRAW = '/sys/class/hidraw';

export interface UeventEntry { name: string; uevent: string }

export interface HidrawStatus {
  /** Node hidraw milik GT65 yang ditemukan. Kosong berarti keyboard tidak terpasang. */
  nodes: string[];
  /** true bila SETIDAKNYA satu node bisa ditulis pengguna ini. */
  writable: boolean;
  /** false bila pemeriksaan tidak bisa dilakukan (bukan Linux, sysfs tak terbaca). */
  checked: boolean;
}

/**
 * HID_ID berbentuk "0003:000005AC:0000024F" — bus:vendor:product, heksadesimal
 * berpadding. Dicocokkan tanpa peduli besar-kecil huruf karena kernel menulis
 * huruf besar tetapi itu bukan bagian dari antarmuka yang dijanjikan.
 */
export function pickGt65Nodes(entries: UeventEntry[]): string[] {
  const want = [VENDOR_ID, PRODUCT_ID]
    .map((n) => n.toString(16).padStart(8, '0'))
    .join(':')
    .toLowerCase();

  return entries
    .filter((e) => {
      const line = e.uevent.split('\n').find((l) => l.startsWith('HID_ID='));
      if (line === undefined) return false;
      const parts = line.slice('HID_ID='.length).trim().toLowerCase().split(':');
      return parts.length === 3 && `${parts[1]}:${parts[2]}` === want;
    })
    .map((e) => `/dev/${e.name}`);
}

/** Membaca sysfs dan memeriksa apakah node GT65 bisa ditulis pengguna ini. */
export async function gt65HidrawStatus(): Promise<HidrawStatus> {
  let names: string[];
  try {
    names = await fs.readdir(SYSFS_HIDRAW);
  } catch {
    return { nodes: [], writable: false, checked: false };
  }

  const entries: UeventEntry[] = [];
  for (const name of names) {
    try {
      const uevent = await fs.readFile(path.join(SYSFS_HIDRAW, name, 'device', 'uevent'), 'utf8');
      entries.push({ name, uevent });
    } catch {
      /* node hilang di tengah jalan — abaikan */
    }
  }

  const nodes = pickGt65Nodes(entries);
  let writable = false;
  for (const node of nodes) {
    try {
      await fs.access(node, constants.W_OK);
      writable = true;
      break;
    } catch {
      /* tidak bisa ditulis */
    }
  }

  return { nodes, writable, checked: true };
}
```

- [ ] **Step 8: Jalankan seluruh suite**

```bash
npx vitest run test/resolvePath.test.ts test/hidAccess.test.ts
npm test 2>&1 | tail -5
```

Harapan: kedua berkas baru lulus; total menjadi 215 test.

- [ ] **Step 9: Commit**

```bash
git add electron/lib test/resolvePath.test.ts test/hidAccess.test.ts
git commit -m "feat: pemetaan URL app:// dan pemeriksaan akses hidraw

Keduanya fungsi murni supaya bisa diuji tanpa menjalankan Electron.
Pemetaan URL menjaga path traversal termasuk bentuk ter-encode; pemeriksaan
hidraw mendeteksi kondisi yang membuat aplikasi rusak secara senyap."
```

---

## Task 5: Proses main Electron

**Interfaces:**
- Consumes: `resolveAssetPath` dari Task 4; `dist/` dari Task 3.
- Produces: `dist-electron/main.cjs` — dikonsumsi Task 8.

**Files:**
- Create: `electron/main.ts`, `scripts/build-electron.mjs`, `scripts/dev-electron.mjs`
- Modify: `tsconfig.json`

- [ ] **Step 1: Tulis skrip build**

Buat `scripts/build-electron.mjs`:

```js
import { build } from 'esbuild';

await build({
  entryPoints: ['electron/main.ts'],
  outfile: 'dist-electron/main.cjs',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['electron'],
  sourcemap: false,
  logLevel: 'info',
});
```

`--bundle` wajib: glob `files` electron-builder tidak menyertakan `node_modules`, jadi
`main.cjs` harus berdiri sendiri.

- [ ] **Step 2: Tulis skrip dev**

Buat `scripts/dev-electron.mjs`:

```js
import { spawn } from 'node:child_process';
import electron from 'electron';

const URL_DEV = 'http://localhost:5173';

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await fetch(url);
      return;
    } catch {
      if (Date.now() > deadline) throw new Error(`vite dev server tidak muncul di ${url}`);
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

const vite = spawn('npx', ['vite', '--port', '5173', '--strictPort'], { stdio: 'inherit' });
await waitForServer(URL_DEV);

const app = spawn(electron, ['dist-electron/main.cjs'], {
  stdio: 'inherit',
  env: { ...process.env, GT65_DEV_SERVER_URL: URL_DEV },
});

const stop = () => { app.kill(); vite.kill(); };
app.on('exit', () => { vite.kill(); process.exit(0); });
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
```

- [ ] **Step 3: Tulis proses main**

Buat `electron/main.ts`. Setiap catatan verifikasi di komentar berasal dari eksekusi
sungguhan pada Electron 44.2.0 dengan GT65 terpasang — jangan dihapus, itu yang
membedakan kode ini dari tebakan.

```ts
/**
 * GT65 Configurator — proses main Electron 44.2.0 (Linux).
 *
 * Fakta yang diverifikasi pada Electron 44.2.0 + GT65 nyata:
 *   - Izin HID TIDAK pernah melewati setPermissionRequestHandler (0 panggilan
 *     selama alur requestDevice penuh). Yang dipanggil adalah
 *     setPermissionCheckHandler dengan permission === 'hid'.
 *   - Tanpa check handler sama sekali, HID DIIZINKAN (bukan ditolak).
 *     Memasang handler ini memperketat, bukan melonggarkan.
 *   - event.preventDefault() pada 'select-hid-device' WAJIB bila callback
 *     dijawab asinkron. Uji A/B: tanpa preventDefault requestDevice selesai
 *     dengan 0 perangkat dalam ~168 ms; dengan preventDefault, 2 perangkat.
 *   - details.deviceList berisi SATU entri per perangkat FISIK. Memanggil
 *     callback dengan satu deviceId memberi izin untuk SELURUH interface.
 *   - details.device pada setDevicePermissionHandler TIDAK punya deviceId.
 *   - Isi `collections` pada deviceList NONDETERMINISTIK antar peluncuran.
 *     Jangan pernah membangun logika di atasnya — diskriminasi interface
 *     adalah tugas findConfigInterface() di renderer.
 */

import { app, BrowserWindow, Menu, net, protocol, session, shell } from 'electron';
import { promises as fs, realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { HOST, SCHEME, resolveAssetPath } from './lib/resolvePath';
import { gt65HidrawStatus } from './lib/hidAccess';

const APP_ORIGIN = `${SCHEME}://${HOST}`;
const VENDOR_ID = 0x05ac;
const PRODUCT_ID = 0x024f;

const DEV_SERVER_URL = process.env.GT65_DEV_SERVER_URL ?? '';
const IS_DEV = DEV_SERVER_URL !== '';
const ALLOWED_ORIGIN = IS_DEV ? new URL(DEV_SERVER_URL).origin : APP_ORIGIN;
const DUMP_HID = process.env.GT65_DUMP_HID === '1';

/**
 * Di-realpath sekali supaya perbandingan containment membandingkan apel
 * dengan apel. Di dalam app.asar ini tetap benar — fs.realpath dan net.fetch
 * sama-sama memperlakukan arsip asar sebagai direktori.
 */
const DIST_ROOT = ((): string => {
  const p = path.join(__dirname, '..', 'dist');
  try {
    return realpathSync(p);
  } catch {
    return p; // dist belum dibangun (mode dev)
  }
})();

const CSP = [
  "default-src 'none'",
  `script-src ${APP_ORIGIN}`,
  `style-src ${APP_ORIGIN} 'unsafe-inline'`,
  `font-src ${APP_ORIGIN} data:`,
  `img-src ${APP_ORIGIN} data: blob:`,
  `connect-src ${APP_ORIGIN}`,
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

// --- 1. Skema privileged — WAJIB sebelum app ready --------------------------
// Memanggil ini setelah app ready melempar:
//   Error: protocol.registerSchemesAsPrivileged should be called before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true },
  },
]);

// --- 2. Melayani dist/ ------------------------------------------------------

const MIME_BY_EXT: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function plain(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

/** Endpoint diagnostik: dipakai renderer untuk memperingatkan soal udev. */
async function serveHidAccess(): Promise<Response> {
  const status = await gt65HidrawStatus();
  return new Response(JSON.stringify(status), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function serveFromDist(request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return plain('Method Not Allowed', 405);
  }

  if (new URL(request.url).pathname === '/__gt65/hid-access') return serveHidAccess();

  const filePath = resolveAssetPath(request.url, DIST_ROOT);
  if (filePath === null) return plain('Forbidden', 403);

  // realpath menutup celah symlink keluar root sekaligus jadi uji keberadaan.
  let real: string;
  try {
    real = await fs.realpath(filePath);
  } catch {
    return plain('Not Found', 404);
  }
  if (real !== DIST_ROOT && !real.startsWith(DIST_ROOT + path.sep)) return plain('Forbidden', 403);

  const stat = await fs.stat(real).catch(() => null);
  if (stat === null || !stat.isFile()) return plain('Not Found', 404);

  // PENTING: untuk berkas yang tidak ada, net.fetch MELEMPAR, bukan 404.
  let upstream: Response;
  try {
    upstream = await net.fetch(pathToFileURL(real).toString());
  } catch {
    return plain('Not Found', 404);
  }
  if (!upstream.ok) return plain('Not Found', 404);

  const ext = path.extname(real).toLowerCase();
  const headers = new Headers();
  headers.set('content-type', MIME_BY_EXT[ext] ?? 'application/octet-stream');
  headers.set(
    'cache-control',
    ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  );
  if (ext === '.html') headers.set('content-security-policy', CSP);

  if (request.method === 'HEAD') {
    await upstream.body?.cancel();
    return new Response(null, { status: 200, headers });
  }
  return new Response(upstream.body, { status: 200, headers });
}

// --- 3. Izin ----------------------------------------------------------------

interface HidLike { vendorId: number; productId: number }

const isGt65 = (d: HidLike): boolean => d.vendorId === VENDOR_ID && d.productId === PRODUCT_ID;
const isAppOrigin = (o: string): boolean => o === ALLOWED_ORIGIN || o === `${ALLOWED_ORIGIN}/`;

/**
 * TIDAK memakai URL#origin: untuk skema non-special seperti app:, WHATWG URL
 * mengembalikan string "null". Menyusun dari protocol + host memberi
 * "app://gt65" yang bisa dibandingkan.
 */
function originOf(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

let pendingChooser: { callback: (id?: string | null) => void; timer: NodeJS.Timeout } | null = null;

function settleChooser(deviceId?: string | null): void {
  if (pendingChooser === null) return;
  clearTimeout(pendingChooser.timer);
  const { callback } = pendingChooser;
  pendingChooser = null;
  callback(deviceId);
}

function installHidHandlers(ses: Electron.Session): void {
  // Gerbang yang benar-benar menentukan boleh-tidaknya navigator.hid.
  // 'clipboard-sanitized-write' HARUS ikut: LogPanel.tsx:75 memakai
  // navigator.clipboard.writeText(); menolaknya mematikan tombol "Salin log".
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin) => {
    if (!isAppOrigin(requestingOrigin)) return false;
    return permission === 'hid' || permission === 'clipboard-sanitized-write';
  });

  ses.setPermissionRequestHandler((_wc, permission, callback, details) => {
    if (permission !== 'clipboard-sanitized-write') { callback(false); return; }
    callback(isAppOrigin(originOf(details.requestingUrl)));
  });

  ses.on('select-hid-device', (event, details, callback) => {
    // WAJIB. Tanpa ini Electron menjawab callback kosong segera setelah
    // listener kembali, sehingga jalur penundaan di bawah gagal senyap.
    event.preventDefault();

    if (DUMP_HID) {
      console.log('[gt65] select-hid-device deviceList:');
      console.log(JSON.stringify(details.deviceList, null, 2));
    }

    settleChooser(undefined);

    // Satu deviceId = satu perangkat fisik; Electron memberi izin untuk SEMUA
    // interface perangkat itu sekaligus. Pemilihan interface konfigurasi tetap
    // tugas findConfigInterface() di renderer.
    const match = details.deviceList.find(isGt65);
    if (match !== undefined) { callback(match.deviceId); return; }

    // Tahan sebentar supaya pengguna yang mencolok keyboard setelah menekan
    // "Sambungkan" tetap terlayani. 10 detik adalah pilihan desain.
    pendingChooser = { callback, timer: setTimeout(() => settleChooser(undefined), 10_000) };
  });

  ses.on('hid-device-added', (_event, details) => {
    if (pendingChooser === null || !isGt65(details.device)) return;
    const id = details.device.deviceId;
    if (typeof id !== 'string' || id === '') return; // callback kosong membatalkan permintaan
    settleChooser(id);
  });

  // Membuat getDevices() menjawab TANPA requestDevice() sejak halaman pertama.
  // Ini BUKAN yang membuat izin bertahan lintas navigasi — itu terjadi tanpanya.
  ses.setDevicePermissionHandler((details) => {
    if (details.deviceType !== 'hid') return false;
    if (details.origin !== ALLOWED_ORIGIN) return false;
    return isGt65(details.device as HidLike);
  });
}

// --- 4. Penguncian navigasi -------------------------------------------------

async function openExternal(target: string): Promise<void> {
  try {
    const { protocol: proto } = new URL(target);
    if (proto === 'http:' || proto === 'https:') await shell.openExternal(target);
  } catch { /* URL tidak valid — abaikan */ }
}

function lockDownNavigation(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (details) => {
      const sameApp = IS_DEV
        ? details.url.startsWith(DEV_SERVER_URL)
        : details.url.startsWith(`${APP_ORIGIN}/`);
      if (!sameApp) { details.preventDefault(); void openExternal(details.url); }
    });
    contents.setWindowOpenHandler(({ url }) => { void openExternal(url); return { action: 'deny' }; });
    contents.on('will-attach-webview', (event) => { event.preventDefault(); });
  });
}

// --- 5. Jendela -------------------------------------------------------------

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 1024, minHeight: 700,
    backgroundColor: '#0b0d10', show: false, title: 'GT65 Configurator',
    webPreferences: {
      // Tidak ada preload: renderer tidak butuh apa pun dari Node. Diverifikasi:
      // HIDDevice.open() berhasil dengan sandbox: true tanpa preload apa pun.
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      webviewTag: false, spellcheck: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  void win.loadURL(IS_DEV ? DEV_SERVER_URL : `${APP_ORIGIN}/index.html`);
}

function buildMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Berkas', submenu: [{ role: 'quit', label: 'Keluar' }] },
    {
      label: 'Tampilan',
      submenu: [
        { role: 'reload', label: 'Muat ulang' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom asal' },
        { role: 'zoomIn', label: 'Perbesar' },
        { role: 'zoomOut', label: 'Perkecil' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Layar penuh' },
        { role: 'toggleDevTools', label: 'Alat pengembang' },
      ],
    },
    {
      label: 'Bantuan',
      submenu: [{
        label: 'Repositori proyek',
        click: () => { void openExternal('https://github.com/RevDonz/gt65-web'); },
      }],
    },
  ]));
}

// --- 6. Daur hidup ----------------------------------------------------------
// Satu instans saja: dua instans berebut hidraw yang sama akan saling menutup
// pegangan perangkat, dan gejalanya terbaca seperti keyboard yang bermasalah.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win !== undefined) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  lockDownNavigation();

  void app.whenReady().then(() => {
    // Mode dev dilayani vite lewat http://localhost, yang sudah secure context.
    if (!IS_DEV) protocol.handle(SCHEME, serveFromDist);
    installHidHandlers(session.defaultSession); // melempar bila dipanggil sebelum ready
    buildMenu();
    createWindow();
  });

  // Linux saja: tidak ada app.on('activate') (macOS).
  app.on('window-all-closed', () => { app.quit(); });
}
```

- [ ] **Step 4: Kecualikan `electron/` dari typecheck renderer**

`tsc --noEmit` proyek ini menyasar renderer. Tambahkan `tsconfig.electron.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "types": ["node"],
    "skipLibCheck": true
  },
  "include": ["electron/**/*.ts"]
}
```

Dan pastikan `tsconfig.json` renderer tidak menyertakan `electron/`. Tambahkan ke
`package.json`:

```json
"typecheck:electron": "tsc -p tsconfig.electron.json"
```

- [ ] **Step 5: Bangun dan jalankan sungguhan**

```bash
npm run build && npm run build:electron
npm run typecheck:electron
GT65_DUMP_HID=1 npx electron dist-electron/main.cjs
```

Yang harus dipastikan sendiri di jendela yang terbuka:

1. Aplikasi tampil, bukan layar kosong.
2. Di DevTools console: `'hid' in navigator` → `true`.
3. `await navigator.hid.getDevices()` → mengembalikan perangkat **tanpa** menekan
   "Sambungkan".
4. Berpindah ke keenam tab; izin tidak diminta ulang.
5. Tombol "Salin log" di tab Log berhasil menyalin.
6. Tidak ada pelanggaran CSP di konsol.

**Kalau nomor 2 gagal, berhenti.** Itu berarti skema protokolnya tidak jalan, dan
semua yang lain tidak ada gunanya.

- [ ] **Step 6: Uji offline**

```bash
sudo ip link set lo up && sudo nmcli networking off 2>/dev/null || true
npx electron dist-electron/main.cjs
# pastikan font tetap benar, lalu:
sudo nmcli networking on 2>/dev/null || true
```

- [ ] **Step 7: Commit**

```bash
git add electron scripts tsconfig.electron.json package.json
git commit -m "feat: proses main Electron dengan skema app:// dan izin HID

WebHID menolak origin buram, jadi loadFile() akan menghasilkan aplikasi
yang tampak normal tapi tidak pernah menemukan keyboard. Skema protokol
kustom memberi origin aman.

Gerbang izin memakai setPermissionCheckHandler — setPermissionRequestHandler
tidak pernah dipanggil untuk HID — dan harus mengizinkan clipboard juga,
kalau tidak tombol Salin log mati."
```

---

## Task 6: Deteksi akses hidraw hanya-baca

**Interfaces:**
- Consumes: `gt65HidrawStatus()` dari Task 4, lewat endpoint
  `app://gt65/__gt65/hid-access` yang dilayani proses main Task 5.
- Produces: komponen `HidAccessBanner` yang dirender `App.tsx`.

Ini satu-satunya perubahan perilaku yang rencana ini izinkan, dan alasannya memaksa.
`services/device/hid/hid_service_linux.cc` membuka perangkat dengan
`FLAG_OPEN | FLAG_READ | FLAG_WRITE` dan **mundur ke hanya-baca bila akses ditolak**.
Tanpa aturan udev, `open()` sukses, `opened` bernilai `true`, dan setiap penulisan
gagal tanpa satu pun galat. AppImage tidak bisa memasang aturan udev, jadi merilisnya
tanpa deteksi ini berarti mengirim aplikasi yang rusak senyap.

Deteksinya memeriksa izin berkas secara langsung, bukan menunggu penulisan gagal —
karena perilaku kegagalan penulisannya sendiri belum diverifikasi, dan menebaknya akan
mengulangi kesalahan yang sama.

**Files:**
- Create: `src/app/HidAccessBanner.tsx`
- Modify: `src/app/App.tsx`, `src/index.css`

- [ ] **Step 1: Buktikan pemeriksaannya benar pada perangkat sungguhan**

Fungsi `gt65HidrawStatus()` sudah ditulis dan diuji di Task 4, tetapi test itu memakai
fixture. Jalankan terhadap sysfs sungguhan:

```bash
npx esbuild electron/lib/hidAccess.ts --bundle --platform=node --format=esm \
  --outfile=/tmp/hidaccess.mjs
node -e "import('/tmp/hidaccess.mjs').then(m => m.gt65HidrawStatus()).then(s => console.log(JSON.stringify(s, null, 2)))"
```

Harapan pada mesin ini (aturan udev sudah terpasang):

```json
{ "nodes": ["/dev/hidraw2", "/dev/hidraw3", "/dev/hidraw4"], "writable": true, "checked": true }
```

- [ ] **Step 2: Buktikan deteksinya benar-benar bisa mendeteksi**

Sebuah pemeriksaan yang tidak pernah terlihat gagal tidak membuktikan apa pun. Cabut
aturan udev sementara dan pastikan hasilnya berubah:

```bash
sudo mv /etc/udev/rules.d/70-gt65.rules /tmp/gt65-rules-backup
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=hidraw --action=change
node -e "import('/tmp/hidaccess.mjs').then(m => m.gt65HidrawStatus()).then(s => console.log(JSON.stringify(s)))"
```

Harapan: `"writable": false` sementara `nodes` tetap terisi. Lalu kembalikan:

```bash
sudo mv /tmp/gt65-rules-backup /etc/udev/rules.d/70-gt65.rules
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=hidraw --action=change
node -e "import('/tmp/hidaccess.mjs').then(m => m.gt65HidrawStatus()).then(s => console.log(JSON.stringify(s)))"
```

Harapan: `"writable": true` lagi. **Kalau nilainya tidak pernah berubah, berhenti** —
berarti pemeriksaannya tidak mengukur apa pun, dan spanduk di bawah tidak akan
berguna.

- [ ] **Step 3: Verifikasi endpoint dilayani proses main**

```bash
npm run build && npm run build:electron
npx electron dist-electron/main.cjs
```

Di DevTools console:

```js
await (await fetch('/__gt65/hid-access')).json()
```

Harapan: objek yang sama dengan Step 1.

- [ ] **Step 4: Tulis spanduk peringatan**

Buat `src/app/HidAccessBanner.tsx`:

```tsx
import { useEffect, useState } from 'react';

const PERINTAH = `sudo install -m644 70-gt65.rules /etc/udev/rules.d/70-gt65.rules
sudo udevadm control --reload-rules && sudo udevadm trigger --subsystem-match=hidraw --action=add`;

interface Status { nodes: string[]; writable: boolean; checked: boolean }

/**
 * Memperingatkan ketika keyboard terpasang tetapi tidak bisa ditulis.
 *
 * Kondisi ini berbahaya justru karena tidak terlihat: Chromium mundur ke
 * hanya-baca ketika akses ditolak, sehingga open() sukses dan setiap tulisan
 * gagal tanpa galat. Endpoint __gt65/hid-access hanya ada di aplikasi desktop;
 * di peramban fetch-nya gagal dan spanduk ini tidak pernah muncul.
 */
export function HidAccessBanner() {
  const [status, setStatus] = useState<Status | null>(null);
  const [disalin, setDisalin] = useState(false);

  useEffect(() => {
    let batal = false;
    fetch('/__gt65/hid-access')
      .then((r) => (r.ok ? r.json() : null))
      .then((s: Status | null) => { if (!batal) setStatus(s); })
      .catch(() => { /* versi web — tidak ada endpoint ini */ });
    return () => { batal = true; };
  }, []);

  if (status === null || !status.checked) return null;
  if (status.nodes.length === 0 || status.writable) return null;

  return (
    <div className="hid-access-banner" role="alert">
      <strong>Keyboard terdeteksi tapi tidak bisa ditulis.</strong>
      <p>
        Aturan udev belum terpasang, jadi konfigurasi apa pun yang Anda terapkan akan
        gagal tanpa pesan galat. Berkas <code>70-gt65.rules</code> ada di dalam paket
        aplikasi ini. Jalankan dua perintah berikut, lalu buka ulang aplikasi.
      </p>
      <pre>{PERINTAH}</pre>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(PERINTAH).then(() => setDisalin(true));
        }}
      >
        {disalin ? 'Perintah tersalin' : 'Salin perintah'}
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Pasang spanduk di shell aplikasi**

Di `src/app/App.tsx`, impor `HidAccessBanner` dan render tepat di bawah bilah
navigasi, sebelum konten panel. Tambahkan gaya `.hid-access-banner` di
`src/index.css` mengikuti pola peringatan yang sudah ada di berkas itu.

- [ ] **Step 6: Pastikan tidak ada regresi**

```bash
npm test 2>&1 | tail -5
npm run build
```

Harapan: seluruh test lulus (215 total), build sukses.

- [ ] **Step 7: Commit**

```bash
git add src/app/HidAccessBanner.tsx src/app/App.tsx src/index.css
git commit -m "feat: peringatkan saat keyboard terpasang tapi tidak bisa ditulis

Tanpa aturan udev, Chromium mundur ke hanya-baca dan open() tetap sukses,
sehingga setiap penulisan gagal tanpa galat. Pengguna AppImage tidak punya
langkah instalasi yang bisa memasang aturan itu, jadi tanpa deteksi ini
mereka akan menerima aplikasi yang rusak secara senyap."
```

---

## Task 7: Aset paket

**Interfaces:**
- Produces: `build/70-gt65.rules`, `build/linux-after-install.sh`,
  `build/linux-after-remove.sh`, `build/icon.png` — dikonsumsi Task 8.

**Files:**
- Create: seluruh isi `build/`

- [ ] **Step 1: Aturan udev**

Buat `build/70-gt65.rules`. Nomor **harus < 73**: `73-seat-late.rules` baris 16 berisi
`TAG=="uaccess", ENV{MAJOR}!="", RUN{builtin}+="uaccess"`, jadi aturan bernomor lebih
besar tidak akan pernah diproses.

```
# VortexSeries GT65 (05AC:024F) - beri akses hidraw ke pengguna sesi lokal.
# Catatan: GT65 memakai Vendor ID milik Apple (05ac), jadi aturan ini juga
# mengenai keyboard Apple asli.
KERNEL=="hidraw*", ATTRS{idVendor}=="05ac", ATTRS{idProduct}=="024f", TAG+="uaccess"
```

- [ ] **Step 2: Skrip pasca-pasang**

Buat `build/linux-after-install.sh`. Berkas ini **diekspansi sebagai template** oleh
electron-builder lewat `.replace(/\$\{([a-zA-Z]+)\}/g, …)`, dan **makro tak dikenal
melempar** — `Macro name is not defined`. Makro sah hanya `${executable}`,
`${sanitizedProductName}`, `${productFilename}`. Untuk variabel shell sendiri, pakai
`$VAR`, jangan `${VAR}`. Ini berlaku **termasuk di dalam komentar**.

```bash
#!/bin/bash

if type update-alternatives >/dev/null 2>&1; then
    if [ -L '/usr/bin/${executable}' -a -e '/usr/bin/${executable}' -a "`readlink '/usr/bin/${executable}'`" != '/etc/alternatives/${executable}' ]; then
        rm -f '/usr/bin/${executable}'
    fi
    update-alternatives --install '/usr/bin/${executable}' '${executable}' '/opt/${sanitizedProductName}/${executable}' 100 || ln -sf '/opt/${sanitizedProductName}/${executable}' '/usr/bin/${executable}'
else
    ln -sf '/opt/${sanitizedProductName}/${executable}' '/usr/bin/${executable}'
fi

if ! { [[ -L /proc/self/ns/user ]] && unshare --user true; }; then
    chmod 4755 '/opt/${sanitizedProductName}/chrome-sandbox' || true
else
    chmod 0755 '/opt/${sanitizedProductName}/chrome-sandbox' || true
fi

if hash update-desktop-database 2>/dev/null; then
    update-desktop-database /usr/share/applications || true
fi

# Terapkan aturan udev tanpa perlu cabut-pasang keyboard.
# action=change, bukan add: 73-seat-late.rules hanya menjaga ACTION=="remove",
# jadi change tetap memicu uaccess tanpa memaksa konsumen hidraw lain
# menginisialisasi ulang.
if command -v udevadm >/dev/null 2>&1; then
    udevadm control --reload-rules || true
    udevadm trigger --subsystem-match=hidraw --action=change || true
else
    echo "PERINGATAN: udevadm tidak ditemukan. Cabut dan pasang kembali keyboard GT65." >&2
fi

if apparmor_status --enabled > /dev/null 2>&1; then
  APPARMOR_PROFILE_SOURCE='/opt/${sanitizedProductName}/resources/apparmor-profile'
  APPARMOR_PROFILE_TARGET='/etc/apparmor.d/${executable}'
  if apparmor_parser --skip-kernel-load --debug "$APPARMOR_PROFILE_SOURCE" > /dev/null 2>&1; then
    cp -f "$APPARMOR_PROFILE_SOURCE" "$APPARMOR_PROFILE_TARGET"
    if ! { [ -x '/usr/bin/ischroot' ] && /usr/bin/ischroot; } && hash apparmor_parser 2>/dev/null; then
      apparmor_parser --replace --write-cache --skip-read-cache "$APPARMOR_PROFILE_TARGET"
    fi
  else
    echo "Melewati pemasangan profil AppArmor: versi AppArmor ini tampaknya tidak mendukungnya"
  fi
fi
```

- [ ] **Step 3: Skrip pasca-hapus**

Buat `build/linux-after-remove.sh`:

```bash
#!/bin/bash

if type update-alternatives >/dev/null 2>&1; then
    update-alternatives --remove '${executable}' '/opt/${sanitizedProductName}/${executable}'
else
    rm -f '/usr/bin/${executable}'
fi

APPARMOR_PROFILE_DEST='/etc/apparmor.d/${executable}'
if [ -f "$APPARMOR_PROFILE_DEST" ]; then
  if apparmor_status --enabled > /dev/null 2>&1; then
    if ! { [ -x '/usr/bin/ischroot' ] && /usr/bin/ischroot; } && hash apparmor_parser 2>/dev/null; then
      apparmor_parser --remove "$APPARMOR_PROFILE_DEST" || true
    fi
  fi
  rm -f "$APPARMOR_PROFILE_DEST"
fi

# Aturan udev sudah dihapus manajer paket; muat ulang basis aturan.
if command -v udevadm >/dev/null 2>&1; then
    udevadm control --reload-rules || true
fi
```

- [ ] **Step 4: Berkas AppStream**

Tanpa ini aplikasi tidak muncul di GNOME Software maupun KDE Discover. electron-builder
tidak menghasilkannya, jadi berkasnya ditulis tangan dan dipasang lewat `fpm` di Task 8.

Buat `build/id.lintas.gt65configurator.metainfo.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>id.lintas.gt65configurator</id>
  <metadata_license>CC0-1.0</metadata_license>
  <project_license>MIT</project_license>

  <name>GT65 Configurator</name>
  <summary>Konfigurator keyboard VortexSeries GT65</summary>
  <summary xml:lang="en">Configurator for the VortexSeries GT65 keyboard</summary>

  <description>
    <p>
      Konfigurator desktop untuk keyboard mekanik VortexSeries GT65. Protokolnya
      hasil rekayasa balik dari driver Windows vendor, sehingga keyboard ini bisa
      diatur dari Linux tanpa Windows.
    </p>
    <p>Yang bisa diatur:</p>
    <ul>
      <li>Pemetaan ulang tombol pada layer utama dan layer Fn</li>
      <li>Pencahayaan RGB: mode, warna, kecepatan, kecerahan, arah</li>
      <li>Pengaturan perangkat dan timeout lampu tidur</li>
      <li>Tester tombol dan log transaksi yang bisa diekspor</li>
    </ul>
    <p>
      Keyboard harus tersambung lewat kabel USB. Mode kering menyala secara bawaan:
      aplikasi menampilkan paket yang akan dikirim sebelum benar-benar mengirimnya.
      Tanpa telemetri dan tanpa proses residen.
    </p>
  </description>

  <launchable type="desktop-id">gt65-configurator.desktop</launchable>
  <url type="homepage">https://github.com/RevDonz/gt65-web</url>
  <url type="bugtracker">https://github.com/RevDonz/gt65-web/issues</url>

  <provides>
    <binary>gt65-configurator</binary>
  </provides>

  <categories>
    <category>Utility</category>
    <category>Settings</category>
  </categories>

  <keywords>
    <keyword>keyboard</keyword>
    <keyword>hid</keyword>
    <keyword>rgb</keyword>
    <keyword>gt65</keyword>
  </keywords>

  <content_rating type="oars-1.1"/>

  <releases>
    <release version="0.1.0" date="2026-09-07">
      <description>
        <p>Rilis pertama sebagai aplikasi desktop Linux.</p>
      </description>
    </release>
  </releases>
</component>
```

Validasi kalau alatnya tersedia — kesalahan di sini membuat berkasnya diabaikan diam-diam:

```bash
command -v appstreamcli >/dev/null 2>&1 \
  && appstreamcli validate build/id.lintas.gt65configurator.metainfo.xml \
  || python3 -c "import xml.dom.minidom as m; m.parse('build/id.lintas.gt65configurator.metainfo.xml'); print('XML sah (appstreamcli tidak terpasang)')"
```

- [ ] **Step 5: Ikon**

Buat `build/icon.png` berukuran 1024×1024. electron-builder menurunkan seluruh ukuran
hicolor dari berkas ini. Kalau belum ada desain, hasilkan placeholder yang jujur —
jangan memakai logo vendor:

```bash
python3 -c "
from PIL import Image, ImageDraw
img = Image.new('RGBA', (1024,1024), (11,13,16,255))
d = ImageDraw.Draw(img)
d.rounded_rectangle([96,256,928,768], radius=64, outline=(120,200,255,255), width=24)
for r in range(4):
    for c in range(8):
        x=176+c*88; y=336+r*88
        d.rounded_rectangle([x,y,x+64,y+64], radius=12, fill=(120,200,255,255))
img.save('build/icon.png')
" 2>/dev/null || echo "Pillow tidak ada — sediakan build/icon.png 1024x1024 secara manual"
```

- [ ] **Step 6: Tetapkan mode berkas**

`fpm` menyalin mode berkas sumber apa adanya. Dengan umask 002, aturan udev akan
terpaket 0664 — bukan yang diinginkan.

```bash
chmod 0644 build/70-gt65.rules build/icon.png build/id.lintas.gt65configurator.metainfo.xml
chmod 0755 build/linux-after-install.sh build/linux-after-remove.sh
ls -l build/
```

- [ ] **Step 7: Commit**

```bash
git add build/
git commit -m "build: aturan udev, skrip maintainer, metainfo, dan ikon"
```

---

## Task 8: Konfigurasi paket dan verifikasi isinya

**Interfaces:**
- Consumes: semua tugas sebelumnya.
- Produces: `release/*.deb`, `release/*.rpm`, `release/*.AppImage`.

**Files:**
- Create: `electron-builder.yml`

- [ ] **Step 1: Tulis konfigurasi**

Buat `electron-builder.yml`. Konfigurasi ini divalidasi terhadap `scheme.json`
`app-builder-lib` 26.15.3 — tidak ada opsi karangan di sini.

```yaml
appId: id.lintas.gt65configurator
productName: GT65 Configurator

directories:
  output: release
  buildResources: build

files:
  - dist/**/*
  - dist-electron/**/*

# Aturan udev ikut ke dalam bundel supaya pengguna AppImage punya berkas yang
# bisa dipasang manual — mereka tidak punya langkah instalasi yang bisa
# memasangnya otomatis.
extraResources:
  - from: build/70-gt65.rules
    to: 70-gt65.rules

npmRebuild: false
publish: null

linux:
  target:
    - target: AppImage
      arch: [x64, arm64]
    - target: deb
      arch: [x64, arm64]
    - target: rpm
      arch: [x64]
  executableName: gt65-configurator
  synopsis: Konfigurator keyboard VortexSeries GT65
  description: >-
    Konfigurator desktop untuk keyboard mekanik VortexSeries GT65 (05AC:024F).
    Pemetaan ulang tombol, pencahayaan RGB, tester tombol, dan pengaturan
    perangkat lewat WebHID. Tanpa telemetri, tanpa proses residen.
  category: Utility
  maintainer: Reva Doni Aprilio <ai@lintas.net.id>
  vendor: Reva Doni Aprilio
  desktop:
    entry:
      Keywords: keyboard;hid;rgb;gt65;vortex;konfigurator;
      StartupNotify: "true"
      StartupWMClass: GT65 Configurator

deb:
  packageName: gt65-configurator
  packageCategory: utils
  priority: optional
  compression: xz
  # Tanpa ini nama berkasnya "GT65 Configurator_0.1.0_amd64.deb" — berspasi.
  artifactName: gt65-configurator_${version}_${arch}.${ext}
  afterInstall: build/linux-after-install.sh
  afterRemove: build/linux-after-remove.sh
  depends:
    - libgtk-3-0
    - libnotify4
    - libnss3
    - libxss1
    - libxtst6
    - xdg-utils
    - libatspi2.0-0
    - libuuid1
    - libsecret-1-0
    - libgbm1
    - libudev1
    - libdrm2
    - libxkbcommon0
    # WAJIB berversi. "libasound2" telanjang tidak bisa di-resolve di Ubuntu
    # 24.04 bersih: ia virtual dengan DUA penyedia, dan apt menolak memilih
    # lalu memasang NOL paket. Debian Policy 7.5: Provides tanpa versi tidak
    # memenuhi dependensi berversi, jadi bentuk berversi menyisakan
    # libasound2t64 sebagai satu-satunya penyedia.
    - libasound2 (>= 1.0.16)
    - libcups2
  # Array kosong itu truthy di JS, jadi cabang customRecommends diambil dan
  # libappindicator3-1 bawaan (tanpa kandidat di 24.04) tidak ikut.
  recommends: []
  fpm:
    - build/70-gt65.rules=/usr/lib/udev/rules.d/70-gt65.rules
    - build/id.lintas.gt65configurator.metainfo.xml=/usr/share/metainfo/id.lintas.gt65configurator.metainfo.xml

rpm:
  packageName: gt65-configurator
  compression: xz
  artifactName: gt65-configurator-${version}.${arch}.${ext}
  afterInstall: build/linux-after-install.sh
  afterRemove: build/linux-after-remove.sh
  # Opsi fpm TIDAK diwariskan dari blok linux: LinuxConfiguration punya
  # additionalProperties:false dan tidak punya properti fpm. Harus diulang.
  fpm:
    - build/70-gt65.rules=/usr/lib/udev/rules.d/70-gt65.rules
    - build/id.lintas.gt65configurator.metainfo.xml=/usr/share/metainfo/id.lintas.gt65configurator.metainfo.xml

appImage:
  artifactName: gt65-configurator-${version}-${arch}.${ext}
```

- [ ] **Step 2: Pasang prasyarat build rpm**

```bash
sudo apt-get update && sudo apt-get install -y rpm xz-utils
```

`fpm` sendiri diunduh electron-builder ke `~/.cache/electron-builder/fpm@2.1.4/` —
Ruby tidak perlu dipasang.

- [ ] **Step 3: Bangun semua paket**

**Jalankan dari akar proyek.** `deb.afterInstall` di-resolve lewat
`path.resolve(projectDir, …)`, tetapi entri `deb.fpm` diteruskan **verbatim** ke fpm
yang dipanggil tanpa opsi `cwd` (`FpmTarget.js:280`). Direktori kerja yang salah
menghasilkan paket yang isinya salah — dan `electron-builder` tetap keluar dengan
status 0. Itulah sebabnya Step 4 memverifikasi isi paket, bukan hanya keberhasilan
build.

```bash
cd "$(git rev-parse --show-toplevel)"
npm run build && npm run build:electron
npx electron-builder --linux --publish never 2>&1 | tail -30
ls -la release/
```

Harapan: lima artefak — deb x64, deb arm64, rpm x64, AppImage x64, AppImage arm64.

- [ ] **Step 4: Verifikasi isi paket — jangan lewati**

```bash
echo "--- aturan udev di deb, harus 0644 bukan 0664:"
dpkg-deb -c release/gt65-configurator_0.1.0_amd64.deb | grep udev

echo "--- dependensi, harus memuat libasound2 berversi:"
dpkg-deb -f release/gt65-configurator_0.1.0_amd64.deb Depends | tr ',' '\n' | grep -i asound

echo "--- aturan udev di rpm:"
rpm -qlp release/gt65-configurator-0.1.0.x86_64.rpm | grep udev

echo "--- desktop entry:"
dpkg-deb -c release/gt65-configurator_0.1.0_amd64.deb | grep '\.desktop'

echo "--- StartupWMClass harus ada di desktop entry:"
dpkg-deb --fsys-tarfile release/gt65-configurator_0.1.0_amd64.deb \
  | tar -xO ./usr/share/applications/gt65-configurator.desktop | grep StartupWMClass

echo "--- metainfo AppStream:"
dpkg-deb -c release/gt65-configurator_0.1.0_amd64.deb | grep metainfo

echo "--- aturan udev ikut ke dalam AppImage:"
./release/gt65-configurator-0.1.0-x86_64.AppImage --appimage-extract resources/70-gt65.rules >/dev/null 2>&1 \
  && ls squashfs-root/resources/70-gt65.rules && rm -rf squashfs-root
```

Setiap baris di atas harus menghasilkan keluaran. **Yang kosong berarti gagal.**

- [ ] **Step 5: Jalankan AppImage hasil build**

```bash
chmod +x release/gt65-configurator-0.1.0-x86_64.AppImage
./release/gt65-configurator-0.1.0-x86_64.AppImage
```

Ulangi kelima pemeriksaan dari Task 5 Step 5 di dalam aplikasi terpaket ini. Kali ini
kode berjalan dari dalam `app.asar` — `fs.realpath` dan `net.fetch` harus tetap
bekerja.

- [ ] **Step 6: Pasang dan lepas `.deb` sungguhan**

```bash
sudo dpkg -i release/gt65-configurator_0.1.0_amd64.deb
ls -l /usr/lib/udev/rules.d/70-gt65.rules   # harus 0644
which gt65-configurator
gt65-configurator &
sleep 5 && pkill -f gt65-configurator
sudo dpkg -r gt65-configurator
ls /usr/lib/udev/rules.d/70-gt65.rules 2>&1  # harus sudah hilang
```

- [ ] **Step 7: Commit**

```bash
git add electron-builder.yml
git commit -m "build: konfigurasi paket Linux dengan aturan udev terpasang otomatis

Kriteria pemilihan format bukan 'bisakah lolos sandbox' melainkan 'bisakah
memasang aturan udev', karena tanpa aturan itu Chromium mundur ke hanya-baca
dan setiap penulisan gagal tanpa galat.

Flatpak dan snap ditolak: flatpak tidak punya hook pasca-instalasi sehingga
tidak menghilangkan satu pun langkah manual, dan snap tidak bisa menyambung
interface hidraw di desktop classic sama sekali."
```

---

## Task 9: Workflow rilis

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Periksa workflow yang ada supaya tidak bentrok**

```bash
cat .github/workflows/pages.yml
```

Pastikan pemicunya tidak sama-sama menyala pada tag `v*`.

- [ ] **Step 2: Tulis workflow**

Buat `.github/workflows/release.yml`. Versi action di bawah diverifikasi dengan
membaca `action.yml` tiap tag, bukan dari nomor rilis.

```yaml
name: Rilis

on:
  push:
    tags: ['v*']

permissions: {}

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm

      # rpmbuild wajib untuk target rpm. fpm diunduh electron-builder sendiri,
      # jadi Ruby tidak perlu dipasang.
      - name: Prasyarat sistem
        run: sudo apt-get update && sudo apt-get install -y rpm xz-utils

      - name: Cache unduhan Electron
        uses: actions/cache@v6
        with:
          path: |
            ~/.cache/electron
            ~/.cache/electron-builder
          key: electron-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
          restore-keys: electron-${{ runner.os }}-

      - run: npm ci

      # Golden test byte adalah mekanisme kebenaran utama proyek ini karena
      # galat protokol gagal senyap. Membangun paket dari kode yang tidak lulus
      # test berarti mendistribusikan sesuatu yang mungkin mengirim byte salah
      # ke hardware yang tidak bisa dibaca balik.
      - run: npm test

      - run: npm run build
      - run: npm run build:electron

      # fpm menyalin mode berkas sumber apa adanya; git tidak menyimpan mode
      # selain bit eksekusi, jadi mode ditetapkan ulang di sini.
      - name: Tetapkan mode berkas paket
        run: |
          chmod 0644 build/70-gt65.rules
          chmod 0755 build/linux-after-install.sh build/linux-after-remove.sh

      - run: npx electron-builder --linux --publish never

      - name: Verifikasi isi paket
        run: |
          set -euo pipefail
          dpkg-deb -c release/gt65-configurator_*_amd64.deb | grep -q 'usr/lib/udev/rules.d/70-gt65.rules'
          dpkg-deb -f release/gt65-configurator_*_amd64.deb Depends | grep -q 'libasound2 (>= 1.0.16)'
          dpkg-deb -c release/gt65-configurator_*_amd64.deb | grep -q 'usr/share/metainfo/'
          rpm -qlp release/gt65-configurator-*.x86_64.rpm | grep -q '70-gt65.rules'
          echo "Isi paket terverifikasi."

      - name: Hitung checksum
        working-directory: release
        run: |
          cp ../build/70-gt65.rules .
          sha256sum *.AppImage *.deb *.rpm 70-gt65.rules > SHA256SUMS.txt
          cat SHA256SUMS.txt

      - name: Terbitkan rilis
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh release create "${{ github.ref_name }}" \
            --title "${{ github.ref_name }}" \
            --prerelease \
            --notes-file .github/RELEASE_NOTES.md \
            release/*.AppImage release/*.deb release/*.rpm \
            release/70-gt65.rules release/SHA256SUMS.txt
```

`gh release create` dipakai, bukan action pihak ketiga: `gh` sudah ada di runner,
tokennya sudah tersedia, dan tidak menambah dependensi yang harus dipercaya.

- [ ] **Step 3: Tulis catatan rilis**

Buat `.github/RELEASE_NOTES.md`:

````markdown
Konfigurator desktop untuk keyboard VortexSeries GT65 di Linux.

## Mana yang harus diunduh

| Distro | Berkas |
|---|---|
| Ubuntu, Debian, Mint, Pop!_OS | `gt65-configurator_*_amd64.deb` |
| Fedora, RHEL, openSUSE | `gt65-configurator-*.x86_64.rpm` |
| Arch, dan lainnya | `gt65-configurator-*-x86_64.AppImage` |
| ARM64 (Asahi, Raspberry Pi) | berkas `arm64` |

`.deb` dan `.rpm` memasang aturan udev secara otomatis. **Pengguna AppImage harus
memasangnya sendiri** — aplikasi akan menampilkan perintahnya, atau:

```
sudo install -m644 70-gt65.rules /etc/udev/rules.d/70-gt65.rules
sudo udevadm control --reload-rules && sudo udevadm trigger --subsystem-match=hidraw --action=add
```

Tanpa aturan itu keyboard akan terdeteksi tetapi setiap perubahan gagal tanpa pesan.

## Syarat

- glibc 2.25 atau lebih baru (`ldd --version`)
- Diuji pada Ubuntu 22.04+, Debian 12+, Fedora 39+
- **Keyboard harus tersambung lewat kabel USB.** Lewat dongle 2.4 GHz, kanal
  konfigurasi tidak tersedia dan aplikasi akan menolak dengan pesan jelas.

## Peringatan

Ini rilis 0.1.0 dan ditandai prerelease. Mode kering menyala secara bawaan —
aplikasi menampilkan paket yang akan dikirim tanpa mengirimnya. Ekspor profil Anda
sebelum menulis apa pun.

Tombol **Pulihkan bawaan** belum pernah diuji pada perangkat fisik dan berisiko
menghapus layer Fn pabrik secara permanen. Jangan pakai sampai
`docs/hardware-checklist.md` Task 14 dijalankan.

Artefak tidak ditandatangani. Verifikasi dengan `sha256sum -c SHA256SUMS.txt`.
````

- [ ] **Step 4: Periksa sintaks workflow**

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/release.yml')); print('YAML sah')"
gh workflow list 2>/dev/null || true
```

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/release.yml .github/RELEASE_NOTES.md
git commit -m "ci: bangun dan terbitkan paket Linux dari tag"
```

---

## Task 10: Dokumentasi

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Tambahkan bagian pemasangan desktop**

Sisipkan setelah bagian "Yang perlu diketahui sebelum memakai" di `README.md`:

````markdown
## Memasang aplikasi desktop

Unduh dari [halaman Rilis](https://github.com/RevDonz/gt65-web/releases).

| Distro | Berkas | Aturan udev |
|---|---|---|
| Ubuntu, Debian, Mint, Pop!_OS | `.deb` | otomatis |
| Fedora, RHEL, openSUSE | `.rpm` | otomatis |
| Arch, Void, Gentoo, NixOS, immutable | `.AppImage` | manual |

```bash
# Debian dan turunannya
sudo dpkg -i gt65-configurator_0.1.0_amd64.deb

# Fedora dan turunannya
sudo rpm -i gt65-configurator-0.1.0.x86_64.rpm

# AppImage
chmod +x gt65-configurator-0.1.0-x86_64.AppImage
./gt65-configurator-0.1.0-x86_64.AppImage
```

Pengguna AppImage harus memasang aturan udev sendiri. Aplikasi akan
memberitahu bila belum terpasang, dan berkasnya ada di dalam bundel:

```bash
sudo install -m644 70-gt65.rules /etc/udev/rules.d/70-gt65.rules
sudo udevadm control --reload-rules && sudo udevadm trigger --subsystem-match=hidraw --action=add
```

Tanpa aturan itu keyboard tetap terdeteksi, tetapi setiap perubahan gagal
tanpa pesan galat — Chromium mundur ke mode hanya-baca secara diam-diam.

Versi web tetap tersedia dan tidak digantikan. Keduanya berbagi basis kode
yang sama.
````

- [ ] **Step 2: Perbarui bagian izin perangkat yang sudah ada**

Bagian "Linux: izin perangkat" di README sekarang menyuruh pengguna menulis aturan
udev dengan `echo`. Ganti rujukannya ke berkas `70-gt65.rules` yang dirilis, supaya
hanya ada satu sumber kebenaran untuk isi aturan itu.

- [ ] **Step 3: Perbarui bagian pengembangan**

````markdown
## Pengembangan

```bash
npm test                # golden test byte, tidak butuh keyboard
npm run build           # renderer
npm run build:electron  # proses main
npm run dev:desktop     # vite + Electron, hot reload
npm run pack:linux      # bangun paket ke release/
```
````

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: petunjuk pemasangan aplikasi desktop per keluarga distro"
```

---

## Task 11: Rilis

- [ ] **Step 1: Verifikasi menyeluruh sebelum merilis**

```bash
npm test 2>&1 | tail -5
npm run build && npm run build:electron
npm run typecheck:electron
npx electron-builder --linux --publish never 2>&1 | tail -5
git status --short
```

Semua harus hijau dan pohon kerja harus bersih. **Jangan lanjut kalau ada yang merah.**

- [ ] **Step 2: Verifikasi hardware — butuh langkah manual**

Colokkan keyboard GT65 dengan **kabel USB**, bukan dongle. Periksa:

```bash
for h in /sys/class/hidraw/hidraw*; do
  grep -H HID_NAME $h/device/uevent
done
```

Harapan: nama selain `USB Dongle`. Lalu jalankan aplikasi dan pastikan kanal
konfigurasi ditemukan — bukan pesan `wrongmode`.

Kalau keyboard tidak bisa dikabelkan sekarang, **catat itu di catatan rilis** alih-alih
mengklaim terverifikasi.

- [ ] **Step 3: Gabungkan ke main**

```bash
git checkout main
git merge --no-ff feat/protocol-core -m "feat: aplikasi desktop Linux dan alur rilis"
```

- [ ] **Step 4: Tandai dan dorong**

```bash
git tag -a v0.1.0 -m "v0.1.0 — aplikasi desktop Linux pertama"
git push origin main
git push origin v0.1.0
```

- [ ] **Step 5: Awasi workflow sampai selesai**

```bash
gh run watch
```

- [ ] **Step 6: Verifikasi rilis yang terbit**

```bash
gh release view v0.1.0
mkdir -p /tmp/rilis && cd /tmp/rilis
gh release download v0.1.0
sha256sum -c SHA256SUMS.txt
```

Semua baris harus `OK`. Lalu jalankan AppImage yang **diunduh dari GitHub**, bukan
yang dibangun lokal — itu artefak yang sebenarnya diterima pengguna.

- [ ] **Step 7: Laporkan apa yang terverifikasi dan apa yang tidak**

Tulis ringkasan jujur: apa yang benar-benar dijalankan dan berhasil, dan apa yang
tidak bisa diuji dari sini — khususnya Ubuntu 24.04 dengan
`apparmor_restrict_unprivileged_userns=1`, karena Linux Mint 22.2 menyetelnya kembali
ke `0` lewat `/etc/sysctl.d/20-apparmor-mint.conf` dan mesin ini tidak akan pernah
mereproduksi masalahnya.
