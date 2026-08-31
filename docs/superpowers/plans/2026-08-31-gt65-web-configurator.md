# GT65 Web Configurator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Konfigurator browser lintas platform untuk keyboard VortexSeries GT65, menggantikan software vendor yang hanya jalan di Windows.

**Architecture:** Aplikasi statis tanpa backend. Modul protokol murni (`src/gt65/protocol.ts`) mengubah konfigurasi menjadi array byte dan diuji tanpa hardware; modul transport (`src/gt65/device.ts`) mengirimnya lewat WebHID; React menyediakan UI. Batas tegas: `protocol.ts` tidak boleh mengimpor WebHID maupun React.

**Tech Stack:** TypeScript, React 19, Vite 6, Tailwind CSS v4, Vitest, WebHID API.

**Spec:** `docs/superpowers/specs/2026-08-31-gt65-web-configurator-design.md`

## Global Constraints

- Seluruh offset byte memakai koordinat **payload (0–63)**, bukan buffer 65-byte Windows. WebHID membuang Report ID dari argumen data: `device.sendFeatureReport(0, payload64)`.
- `src/gt65/protocol.ts` tidak boleh mengimpor apa pun dari `device.ts`, `app/`, `store/`, atau WebHID. Fungsi murni saja.
- Penanda `AA 55` tidak berada di posisi tetap — posisinya berbeda per transaksi (pencahayaan 14, pengaturan 62, tabel remap 574).
- Hanya mode kabel USB yang didukung. Mode dongle 2.4 GHz harus ditolak dengan pesan jelas, bukan gagal diam-diam.
- Keyboard diasumsikan write-only sampai Task 1 membuktikan sebaliknya.
- VID/PID perangkat: `0x05AC` / `0x024F`.
- Mode kering (dry-run) adalah nilai bawaan aplikasi. Menulis sungguhan harus tindakan sengaja.
- Semua teks UI berbahasa Indonesia.
- Node 22, package manager `npm`.

---

### Task 1: Verifikasi hardware dan izin

Menjawab dua pertanyaan yang mengubah desain kalau jawabannya tak terduga: apakah `open()` berhasil setelah udev rule dipasang, dan apakah keyboard menjawab pembacaan feature report.

**Files:**
- Create: `tools/hidprobe.html`
- Create: `docs/hardware-findings.md`

**Interfaces:**
- Consumes: tidak ada
- Produces: `docs/hardware-findings.md` berisi jawaban write-only dan status izin, dirujuk Task 6.

- [ ] **Step 1: Tulis halaman probe**

Buat `tools/hidprobe.html`:

```html
<!doctype html>
<meta charset="utf-8">
<title>GT65 hardware probe</title>
<button id="go">Sambungkan dan uji</button>
<pre id="out"></pre>
<script>
const out = document.getElementById('out');
const L = s => out.textContent += s + '\n';

document.getElementById('go').onclick = async () => {
  out.textContent = '';
  const devices = await navigator.hid.requestDevice({
    filters: [{ vendorId: 0x05ac, productId: 0x024f }]
  });
  for (const d of devices) {
    const feature = d.collections.flatMap(c => c.featureReports ?? []);
    L(`${d.productName}: ${d.collections.length} collection, ${feature.length} feature report`);
    if (!feature.length) continue;

    try {
      await d.open();
      L('  open(): BERHASIL');
    } catch (e) {
      L(`  open(): GAGAL — ${e.name}: ${e.message}`);
      L('  -> pasang udev rule, lihat langkah berikutnya');
      continue;
    }

    try {
      const view = await d.receiveFeatureReport(0);
      const hex = [...new Uint8Array(view.buffer)]
        .map(b => b.toString(16).padStart(2, '0')).join(' ');
      L('  receiveFeatureReport(0): BERHASIL — perangkat BISA dibaca');
      L('  ' + hex);
    } catch (e) {
      L(`  receiveFeatureReport(0): GAGAL — ${e.name}`);
      L('  -> perangkat write-only, sesuai asumsi spec');
    }
    await d.close();
  }
};
</script>
```

- [ ] **Step 2: Pasang udev rule**

```bash
echo 'KERNEL=="hidraw*", ATTRS{idVendor}=="05ac", ATTRS{idProduct}=="024f", TAG+="uaccess"' \
  | sudo tee /etc/udev/rules.d/70-gt65.rules
sudo udevadm control --reload-rules && sudo udevadm trigger
```

Cabut dan colok ulang keyboard. Verifikasi:

```bash
ls -l /dev/hidraw* | grep -v 'root root'
```

Expected: minimal satu baris muncul (ACL memberi akses ke user login).

- [ ] **Step 3: Jalankan probe**

```bash
npx --yes http-server tools -p 8765 -a 127.0.0.1
```

Buka `http://localhost:8765/hidprobe.html` di Brave/Chrome, klik tombol, pilih `hfd.cn USB DEVICE`.

Expected: baris `open(): BERHASIL`. Catat hasil `receiveFeatureReport`.

- [ ] **Step 4: Catat temuan**

Tulis `docs/hardware-findings.md` berisi keluaran probe apa adanya, ditambah satu kalimat kesimpulan: apakah perangkat write-only atau bisa dibaca.

Kalau ternyata **bisa dibaca**, hentikan dan laporkan — Bagian 3.3 spec dan Task 6 perlu direvisi sebelum lanjut.

- [ ] **Step 5: Commit**

```bash
git add tools/hidprobe.html docs/hardware-findings.md
git commit -m "chore: verifikasi izin hidraw dan sifat write-only perangkat"
```

---

### Task 2: Scaffold proyek dan primitif protokol

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/index.css`
- Create: `src/gt65/protocol.ts`
- Test: `test/protocol.test.ts`

**Interfaces:**
- Consumes: tidak ada
- Produces: `cmd(op: number, fields?: Fields): Uint8Array`, `data(fields: Fields, termAt: number): Uint8Array`, `chunks(buf: Uint8Array): Uint8Array[]`, konstanta `CLASS = 0x04`, `PAYLOAD_LEN = 64`, tipe `Fields = Record<number, number>`. Dipakai Task 3, 4, 5, 12.

- [ ] **Step 1: Buat manifest dan konfigurasi**

`package.json`:

```json
{
  "name": "gt65-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/w3c-web-hid": "^1.0.6",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["w3c-web-hid", "vite/client"]
  },
  "include": ["src", "test"]
}
```

`vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
});
```

`index.html`:

```html
<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>GT65 Configurator</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/index.css`:

```css
@import "tailwindcss";
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="p-8 text-slate-100">GT65</div>
  </StrictMode>,
);
```

Jalankan `npm install`.

- [ ] **Step 2: Tulis test yang gagal**

`test/protocol.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { cmd, data, chunks, PAYLOAD_LEN } from '../src/gt65/protocol';

describe('primitif paket', () => {
  test('cmd menghasilkan payload 64 byte dengan penanda kelas', () => {
    const p = cmd(0x18);
    expect(p.length).toBe(PAYLOAD_LEN);
    expect(p[0]).toBe(0x04);
    expect(p[1]).toBe(0x18);
    expect(p.slice(2).every((b) => b === 0)).toBe(true);
  });

  test('cmd menempatkan field pada offset payload', () => {
    const p = cmd(0x13, { 8: 1 });
    expect(p[8]).toBe(1);
  });

  test('data tidak memakai penanda kelas dan menutup dengan AA 55', () => {
    const p = data({ 0: 0x01 }, 14);
    expect(p[0]).toBe(0x01);
    expect(p[14]).toBe(0xaa);
    expect(p[15]).toBe(0x55);
  });

  test('data menutup di posisi berbeda untuk blok pengaturan', () => {
    const p = data({ 6: 30 }, 62);
    expect(p[62]).toBe(0xaa);
    expect(p[63]).toBe(0x55);
  });

  test('chunks memecah 576 byte menjadi 9 paket 64 byte', () => {
    const buf = new Uint8Array(576).fill(0x7f);
    const out = chunks(buf);
    expect(out.length).toBe(9);
    expect(out.every((c) => c.length === PAYLOAD_LEN)).toBe(true);
    expect(out[8][63]).toBe(0x7f);
  });
});
```

- [ ] **Step 3: Jalankan test untuk memastikan gagal**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "../src/gt65/protocol"`

- [ ] **Step 4: Tulis implementasi minimal**

`src/gt65/protocol.ts`:

```ts
export const CLASS = 0x04;
export const PAYLOAD_LEN = 64;

export type Fields = Record<number, number>;

function applyFields(p: Uint8Array, fields: Fields): void {
  for (const key of Object.keys(fields)) {
    const off = Number(key);
    if (off < 0 || off >= PAYLOAD_LEN) {
      throw new RangeError(`offset ${off} di luar payload 0..63`);
    }
    p[off] = fields[off] & 0xff;
  }
}

/** Paket perintah: payload[0] = 0x04, payload[1] = opcode. */
export function cmd(op: number, fields: Fields = {}): Uint8Array {
  const p = new Uint8Array(PAYLOAD_LEN);
  p[0] = CLASS;
  p[1] = op & 0xff;
  applyFields(p, fields);
  return p;
}

/**
 * Paket data: tanpa penanda kelas. `termAt` adalah offset payload tempat
 * penanda AA 55 diletakkan — posisinya berbeda tiap transaksi.
 */
export function data(fields: Fields, termAt: number): Uint8Array {
  if (termAt < 0 || termAt + 1 >= PAYLOAD_LEN) {
    throw new RangeError(`termAt ${termAt} tidak muat dalam payload`);
  }
  const p = new Uint8Array(PAYLOAD_LEN);
  applyFields(p, fields);
  p[termAt] = 0xaa;
  p[termAt + 1] = 0x55;
  return p;
}

/** Pecah buffer besar menjadi paket-paket 64 byte. */
export function chunks(buf: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let i = 0; i < buf.length; i += PAYLOAD_LEN) {
    const c = new Uint8Array(PAYLOAD_LEN);
    c.set(buf.subarray(i, i + PAYLOAD_LEN));
    out.push(c);
  }
  return out;
}
```

- [ ] **Step 5: Jalankan test untuk memastikan lulus**

Run: `npm test`
Expected: PASS, 5 test.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src test
git commit -m "feat: scaffold proyek dan primitif paket protokol"
```

---

### Task 3: Transaksi pencahayaan dan pengaturan

**Files:**
- Modify: `src/gt65/protocol.ts`
- Modify: `test/protocol.test.ts`

**Interfaces:**
- Consumes: `cmd`, `data` dari Task 2
- Produces: tipe `Lighting`, `Settings`; fungsi `lighting(c: Lighting): Uint8Array[]`, `settings(c: Settings): Uint8Array[]`. Dipakai Task 8, 9, 12.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan ke `test/protocol.test.ts`:

```ts
import { lighting, settings } from '../src/gt65/protocol';

describe('transaksi pencahayaan', () => {
  const cfg = { mode: 1, r: 0xff, g: 0x40, b: 0x00,
                speed: 3, brightness: 4, direction: 0 };

  test('menghasilkan lima paket dengan urutan benar', () => {
    const p = lighting(cfg);
    expect(p.length).toBe(5);
    expect([p[0][0], p[0][1]]).toEqual([0x04, 0x18]);
    expect([p[1][0], p[1][1]]).toEqual([0x04, 0x13]);
    expect(p[1][8]).toBe(1);
    expect([p[3][0], p[3][1]]).toEqual([0x04, 0x02]);
    expect([p[4][0], p[4][1]]).toEqual([0x04, 0xf0]);
  });

  test('paket data memuat mode, RGB, dan penanda di byte 14-15', () => {
    const d = lighting(cfg)[2];
    expect(d[0]).toBe(1);
    expect([d[1], d[2], d[3]]).toEqual([0xff, 0x40, 0x00]);
    expect(d[14]).toBe(0xaa);
    expect(d[15]).toBe(0x55);
  });

  test('speed dan brightness dinaikkan satu', () => {
    const d = lighting(cfg)[2];
    expect(d[9]).toBe(4);
    expect(d[10]).toBe(5);
  });
});

describe('transaksi pengaturan', () => {
  const cfg = { flags: [true, false, true, false, true] as
                  [boolean, boolean, boolean, boolean, boolean],
                sleepTimeout: 30 };

  test('menghasilkan empat paket tanpa finalisasi', () => {
    const p = settings(cfg);
    expect(p.length).toBe(4);
    expect([p[0][0], p[0][1]]).toEqual([0x04, 0x18]);
    expect([p[1][0], p[1][1]]).toEqual([0x04, 0x17]);
    expect(p[1][8]).toBe(1);
    expect([p[3][0], p[3][1]]).toEqual([0x04, 0x02]);
  });

  test('flag dipetakan ke byte 1..5 dan timeout ke byte 6', () => {
    const d = settings(cfg)[2];
    expect([d[1], d[2], d[3], d[4], d[5]]).toEqual([1, 0, 1, 0, 1]);
    expect(d[6]).toBe(30);
    expect(d[62]).toBe(0xaa);
    expect(d[63]).toBe(0x55);
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npm test`
Expected: FAIL — `lighting is not a function`

- [ ] **Step 3: Implementasi**

Tambahkan ke `src/gt65/protocol.ts`:

```ts
export type Lighting = {
  mode: number;
  r: number; g: number; b: number;
  speed: number;       // basis nol di UI
  brightness: number;  // basis nol di UI
  direction: number;
};

/**
 * Byte 9 dan 10 dikirim berbasis satu; software vendor menaikkan
 * keduanya dengan `inc al` sebelum menyimpan ke paket.
 */
export function lighting(c: Lighting): Uint8Array[] {
  return [
    cmd(0x18),
    cmd(0x13, { 8: 1 }),
    data({
      0: c.mode,
      1: c.r, 2: c.g, 3: c.b,
      9: c.speed + 1,
      10: c.brightness + 1,
      11: c.direction,
    }, 14),
    cmd(0x02),
    cmd(0xf0),
  ];
}

export type Settings = {
  /**
   * Lima boolean di payload[1..5]. Pemetaan indeks ke makna belum
   * ditentukan — lihat spec Bagian 5.4. Sampai selesai, UI tidak boleh
   * memberi label pasti pada tiap flag.
   */
  flags: [boolean, boolean, boolean, boolean, boolean];
  sleepTimeout: number;
  profileIndex?: number;
};

export function settings(c: Settings): Uint8Array[] {
  const f: Fields = { 6: c.sleepTimeout };
  c.flags.forEach((v, i) => { f[i + 1] = v ? 1 : 0; });
  return [
    cmd(0x18),
    cmd(0x17, { 2: c.profileIndex ?? 0, 8: 1 }),
    data(f, 62),
    cmd(0x02),
  ];
}
```

- [ ] **Step 4: Jalankan test**

Run: `npm test`
Expected: PASS, 10 test.

- [ ] **Step 5: Commit**

```bash
git add src/gt65/protocol.ts test/protocol.test.ts
git commit -m "feat: transaksi pencahayaan dan pengaturan sistem"
```

---

### Task 4: Encoding entri tombol dan transaksi remap

**Files:**
- Modify: `src/gt65/protocol.ts`
- Modify: `test/protocol.test.ts`

**Interfaces:**
- Consumes: `cmd`, `chunks` dari Task 2
- Produces: tipe `Entry`; `encodeEntry(e: Entry): [number, number, number, number]`, `buildTable(entries: Entry[]): Uint8Array`, `remap(layer: Layer, entries: Entry[]): Uint8Array[]`, tipe `Layer = 'top' | 'fn'`, konstanta `TABLE_ENTRIES = 144`, `TABLE_BYTES = 576`. Dipakai Task 6, 11, 12.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan ke `test/protocol.test.ts`:

```ts
import { encodeEntry, buildTable, remap, TABLE_BYTES } from '../src/gt65/protocol';
import type { Entry } from '../src/gt65/protocol';

describe('encoding entri tombol', () => {
  test('none menghasilkan entri nol', () => {
    expect(encodeEntry({ kind: 'none' })).toEqual([0, 0, 0, 0]);
  });

  test('tombol keyboard menyimpan modifier dan usage', () => {
    expect(encodeEntry({ kind: 'key', mod: 0x00, usage: 0x04 }))
      .toEqual([0x02, 0x00, 0x04, 0]);
  });

  test('Win+D ter-encode sesuai preset vendor', () => {
    expect(encodeEntry({ kind: 'key', mod: 0x08, usage: 0x07 }))
      .toEqual([0x02, 0x08, 0x07, 0]);
  });

  test('multimedia menyimpan consumer usage di byte 1', () => {
    expect(encodeEntry({ kind: 'media', usage: 0xcd }))
      .toEqual([0x03, 0xcd, 0, 0]);
  });

  test('fungsi mouse menyimpan jenis kejadian dan nilai', () => {
    expect(encodeEntry({ kind: 'mouse', ev: 1, val: 0x01 }))
      .toEqual([0x01, 1, 0x01, 0]);
    expect(encodeEntry({ kind: 'mouse', ev: 3, val: 0xff }))
      .toEqual([0x01, 3, 0xff, 0]);
  });
});

describe('tabel remap', () => {
  test('berukuran 576 byte dan ditutup AA 55', () => {
    const t = buildTable([]);
    expect(t.length).toBe(TABLE_BYTES);
    expect(t[574]).toBe(0xaa);
    expect(t[575]).toBe(0x55);
  });

  test('entri ditulis pada indeks dikali empat', () => {
    const e: Entry[] = new Array(144).fill({ kind: 'none' });
    e[66] = { kind: 'key', mod: 0x02, usage: 0x34 };
    const t = buildTable(e);
    expect([t[264], t[265], t[266], t[267]]).toEqual([0x02, 0x02, 0x34, 0]);
  });

  test('transaksi remap memakai opcode berbeda per layer', () => {
    const e: Entry[] = new Array(144).fill({ kind: 'none' });
    const top = remap('top', e);
    const fn = remap('fn', e);
    expect(top.length).toBe(13);      // 18, selektor, 9 chunk, 02, F0
    expect([top[1][0], top[1][1]]).toEqual([0x04, 0x11]);
    expect([fn[1][0], fn[1][1]]).toEqual([0x04, 0x27]);
    expect(top[1][8]).toBe(9);
    expect([top[12][0], top[12][1]]).toEqual([0x04, 0xf0]);
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npm test`
Expected: FAIL — `encodeEntry is not a function`

- [ ] **Step 3: Implementasi**

Tambahkan ke `src/gt65/protocol.ts`:

```ts
export type Entry =
  | { kind: 'none' }
  | { kind: 'key'; mod: number; usage: number }
  | { kind: 'media'; usage: number }
  | { kind: 'mouse'; ev: 1 | 3; val: number }
  | { kind: 'macro'; slot: number; mode: number; repeat: number };

export type Layer = 'top' | 'fn';

export const TABLE_ENTRIES = 144;
export const TABLE_BYTES = TABLE_ENTRIES * 4;

/** entry[0] tag tipe, entry[1] modifier, entry[2] usage/nilai, entry[3] tambahan. */
export function encodeEntry(e: Entry): [number, number, number, number] {
  switch (e.kind) {
    case 'none':  return [0x00, 0, 0, 0];
    case 'mouse': return [0x01, e.ev, e.val & 0xff, 0];
    case 'key':   return [0x02, e.mod & 0xff, e.usage & 0xff, 0];
    case 'media': return [0x03, e.usage & 0xff, 0, 0];
    case 'macro': return [0x06, e.slot & 0xff, e.mode & 0xff, e.repeat & 0xff];
  }
}

/**
 * 144 entri x 4 byte. Indeks tabel adalah `key_index` dari
 * KeyboardLayout.xml (tertinggi 121), sehingga slot sisanya tetap nol.
 * Dua byte terakhir dipakai penanda AA 55, menimpa sebagian slot 143
 * yang memang tak terpakai — sama seperti software vendor.
 */
export function buildTable(entries: Entry[]): Uint8Array {
  const t = new Uint8Array(TABLE_BYTES);
  for (let i = 0; i < Math.min(entries.length, TABLE_ENTRIES); i++) {
    t.set(encodeEntry(entries[i]), i * 4);
  }
  t[TABLE_BYTES - 2] = 0xaa;
  t[TABLE_BYTES - 1] = 0x55;
  return t;
}

export function remap(layer: Layer, entries: Entry[]): Uint8Array[] {
  return [
    cmd(0x18),
    cmd(layer === 'fn' ? 0x27 : 0x11, { 8: 9 }),
    ...chunks(buildTable(entries)),
    cmd(0x02),
    cmd(0xf0),
  ];
}
```

- [ ] **Step 4: Jalankan test**

Run: `npm test`
Expected: PASS, 18 test.

- [ ] **Step 5: Commit**

```bash
git add src/gt65/protocol.ts test/protocol.test.ts
git commit -m "feat: encoding entri tombol dan transaksi remap dua layer"
```

---

### Task 5: Tabel kode tombol

**Files:**
- Create: `src/gt65/keycodes.ts`
- Test: `test/keycodes.test.ts`

**Interfaces:**
- Consumes: tipe `Entry` dari Task 4
- Produces: `MODIFIERS`, `HID_KEYS`, `MEDIA_ACTIONS`, `MOUSE_ACTIONS`, `SHORTCUTS` — masing-masing array `{ id: string; label: string; entry: Entry }` kecuali `MODIFIERS` dan `HID_KEYS`. Dipakai Task 11.

- [ ] **Step 1: Tulis test yang gagal**

`test/keycodes.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { MEDIA_ACTIONS, SHORTCUTS, MOUSE_ACTIONS } from '../src/gt65/keycodes';
import { encodeEntry } from '../src/gt65/protocol';

describe('katalog aksi', () => {
  test('Play/Pause memakai consumer usage 0xCD', () => {
    const a = MEDIA_ACTIONS.find((x) => x.id === 'play_pause')!;
    expect(encodeEntry(a.entry)).toEqual([0x03, 0xcd, 0, 0]);
  });

  test('semua kode multimedia sesuai HID Consumer Page', () => {
    const want: Record<string, number> = {
      play_pause: 0xcd, stop: 0xb7, prev: 0xb6, next: 0xb5,
      vol_up: 0xe9, vol_down: 0xea, mute: 0xe2,
    };
    for (const [id, code] of Object.entries(want)) {
      const a = MEDIA_ACTIONS.find((x) => x.id === id)!;
      expect(encodeEntry(a.entry)[1]).toBe(code);
    }
  });

  test('shortcut Alt+Tab ter-encode sebagai modifier 0x04 usage 0x2B', () => {
    const a = SHORTCUTS.find((x) => x.id === 'switch_windows')!;
    expect(encodeEntry(a.entry)).toEqual([0x02, 0x04, 0x2b, 0]);
  });

  test('scroll turun memakai delta -1', () => {
    const a = MOUSE_ACTIONS.find((x) => x.id === 'scroll_down')!;
    expect(encodeEntry(a.entry)).toEqual([0x01, 3, 0xff, 0]);
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npm test`
Expected: FAIL — modul tidak ditemukan.

- [ ] **Step 3: Implementasi**

`src/gt65/keycodes.ts`:

```ts
import type { Entry } from './protocol';

export type Action = { id: string; label: string; entry: Entry };

export const MODIFIERS = {
  ctrl: 0x01,
  shift: 0x02,
  alt: 0x04,
  gui: 0x08,
} as const;

export const MEDIA_ACTIONS: Action[] = [
  { id: 'play_pause', label: 'Play / Pause', entry: { kind: 'media', usage: 0xcd } },
  { id: 'stop',       label: 'Stop',         entry: { kind: 'media', usage: 0xb7 } },
  { id: 'prev',       label: 'Sebelumnya',   entry: { kind: 'media', usage: 0xb6 } },
  { id: 'next',       label: 'Berikutnya',   entry: { kind: 'media', usage: 0xb5 } },
  { id: 'vol_up',     label: 'Volume +',     entry: { kind: 'media', usage: 0xe9 } },
  { id: 'vol_down',   label: 'Volume −',     entry: { kind: 'media', usage: 0xea } },
  { id: 'mute',       label: 'Bisukan',      entry: { kind: 'media', usage: 0xe2 } },
];

export const MOUSE_ACTIONS: Action[] = [
  { id: 'left',        label: 'Klik kiri',    entry: { kind: 'mouse', ev: 1, val: 0x01 } },
  { id: 'right',       label: 'Klik kanan',   entry: { kind: 'mouse', ev: 1, val: 0x02 } },
  { id: 'middle',      label: 'Klik tengah',  entry: { kind: 'mouse', ev: 1, val: 0x04 } },
  { id: 'button4',     label: 'Tombol 4',     entry: { kind: 'mouse', ev: 1, val: 0x08 } },
  { id: 'button5',     label: 'Tombol 5',     entry: { kind: 'mouse', ev: 1, val: 0x10 } },
  { id: 'double',      label: 'Klik ganda',   entry: { kind: 'mouse', ev: 1, val: 0x03 } },
  { id: 'scroll_up',   label: 'Scroll naik',  entry: { kind: 'mouse', ev: 3, val: 0x01 } },
  { id: 'scroll_down', label: 'Scroll turun', entry: { kind: 'mouse', ev: 3, val: 0xff } },
];

export const SHORTCUTS: Action[] = [
  { id: 'show_desktop',   label: 'Tampilkan desktop (Win+D)', entry: { kind: 'key', mod: 0x08, usage: 0x07 } },
  { id: 'my_computer',    label: 'File Explorer (Win+E)',     entry: { kind: 'key', mod: 0x08, usage: 0x08 } },
  { id: 'lock',           label: 'Kunci layar (Win+L)',       entry: { kind: 'key', mod: 0x08, usage: 0x0f } },
  { id: 'close_window',   label: 'Tutup jendela (Ctrl+W)',    entry: { kind: 'key', mod: 0x01, usage: 0x1a } },
  { id: 'switch_windows', label: 'Ganti jendela (Alt+Tab)',   entry: { kind: 'key', mod: 0x04, usage: 0x2b } },
  { id: 'copy',           label: 'Salin (Ctrl+C)',            entry: { kind: 'key', mod: 0x01, usage: 0x06 } },
  { id: 'paste',          label: 'Tempel (Ctrl+V)',           entry: { kind: 'key', mod: 0x01, usage: 0x19 } },
  { id: 'cut',            label: 'Potong (Ctrl+X)',           entry: { kind: 'key', mod: 0x01, usage: 0x1b } },
];

/** Subset HID usage yang bisa dipilih sebagai tombol biasa. */
export const HID_KEYS: { usage: number; label: string }[] = [
  ...Array.from({ length: 26 }, (_, i) => ({
    usage: 0x04 + i, label: String.fromCharCode(65 + i),
  })),
  ...Array.from({ length: 9 }, (_, i) => ({
    usage: 0x1e + i, label: String(i + 1),
  })),
  { usage: 0x27, label: '0' },
  { usage: 0x28, label: 'Enter' },
  { usage: 0x29, label: 'Esc' },
  { usage: 0x2a, label: 'Backspace' },
  { usage: 0x2b, label: 'Tab' },
  { usage: 0x2c, label: 'Space' },
  ...Array.from({ length: 12 }, (_, i) => ({
    usage: 0x3a + i, label: `F${i + 1}`,
  })),
  { usage: 0x4f, label: 'Kanan' },
  { usage: 0x50, label: 'Kiri' },
  { usage: 0x51, label: 'Bawah' },
  { usage: 0x52, label: 'Atas' },
];
```

- [ ] **Step 4: Jalankan test**

Run: `npm test`
Expected: PASS, 22 test.

- [ ] **Step 5: Commit**

```bash
git add src/gt65/keycodes.ts test/keycodes.test.ts
git commit -m "feat: katalog kode tombol, multimedia, mouse, dan shortcut"
```

---

### Task 6: Layout keyboard dari XML

**Files:**
- Create: `scripts/gen-layout.mjs`
- Create: `src/gt65/layout.ts` (dihasilkan skrip)
- Test: `test/layout.test.ts`

**Interfaces:**
- Consumes: tidak ada
- Produces: `KEYS: KeyDef[]` dengan `type KeyDef = { usage: number; name: string; x: number; y: number; w: number; h: number; keyIndex: number; lightIndex: number }`, dan `LAYOUT_SIZE = { width: 800, height: 300 }`. Dipakai Task 11.

- [ ] **Step 1: Tulis generator**

`scripts/gen-layout.mjs`:

```js
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

// Nilai atribut boleh memuat '>' (tombol `>`), jadi kelas karakter polos
// [^>] akan menelan tombol itu diam-diam. Perlakukan nilai berkutip sebagai
// satu kesatuan.
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
```

- [ ] **Step 2: Jalankan generator**

```bash
node scripts/gen-layout.mjs ~/Projects/gt65-re/config/KeyboardLayout.xml
```

Expected: `ditulis 66 tombol ke src/gt65/layout.ts`

- [ ] **Step 3: Tulis test**

`test/layout.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { KEYS } from '../src/gt65/layout';
import { TABLE_ENTRIES } from '../src/gt65/protocol';

describe('layout keyboard', () => {
  test('memuat 66 tombol', () => {
    expect(KEYS.length).toBe(66);
  });

  test('semua key_index muat dalam tabel remap', () => {
    for (const k of KEYS) {
      expect(k.keyIndex).toBeGreaterThanOrEqual(0);
      expect(k.keyIndex).toBeLessThan(TABLE_ENTRIES);
    }
  });

  test('key_index unik', () => {
    const seen = new Set(KEYS.map((k) => k.keyIndex));
    expect(seen.size).toBe(KEYS.length);
  });

  test('tombol Esc memakai usage 0x29', () => {
    const esc = KEYS.find((k) => k.name === 'esc')!;
    expect(esc.usage).toBe(0x29);
  });

  test('tombol kutip terbaca benar meski XML rusak', () => {
    expect(KEYS.some((k) => k.name === '"')).toBe(true);
  });
});
```

- [ ] **Step 4: Jalankan test**

Run: `npm test`
Expected: PASS, 27 test.

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-layout.mjs src/gt65/layout.ts test/layout.test.ts
git commit -m "feat: layout 66 tombol dihasilkan dari KeyboardLayout.xml vendor"
```

---

### Task 7: Transport WebHID

**Files:**
- Create: `src/gt65/device.ts`
- Test: `test/device.test.ts`

**Interfaces:**
- Consumes: `PAYLOAD_LEN` dari Task 2
- Produces: `VENDOR_ID`, `PRODUCT_ID`, `class DeviceError extends Error { kind: DeviceErrorKind }`, `type DeviceErrorKind = 'unsupported' | 'notfound' | 'permission' | 'wrongmode'`, `findConfigInterface(devices: HIDDevice[]): HIDDevice | null`, `requestDevice(): Promise<HIDDevice>`, `sendTransaction(dev: HIDDevice, packets: Uint8Array[], gapMs?: number): Promise<void>`, `onVendorInput(dev: HIDDevice, cb: (bytes: Uint8Array) => void): () => void`. Dipakai Task 8, 10, 11, 12.

- [ ] **Step 1: Tulis test yang gagal**

`test/device.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest';
import { findConfigInterface, sendTransaction, DeviceError } from '../src/gt65/device';

const withFeature = {
  productName: 'USB DEVICE',
  collections: [{ usagePage: 0x01, usage: 0x06,
                  featureReports: [{ reportId: 0, items: [{ reportSize: 8, reportCount: 64 }] }] }],
} as unknown as HIDDevice;

const noFeature = {
  productName: 'USB DEVICE',
  collections: [{ usagePage: 0x0c, usage: 0x01, inputReports: [{ reportId: 3 }] }],
} as unknown as HIDDevice;

const dongle = {
  productName: 'USB Dongle',
  collections: [{ usagePage: 0xffb5, usage: 0x01,
                  outputReports: [{ reportId: 0xb5 }] }],
} as unknown as HIDDevice;

describe('pemilihan interface', () => {
  test('memilih interface dengan feature report 64 byte', () => {
    expect(findConfigInterface([noFeature, withFeature])).toBe(withFeature);
  });

  test('mengembalikan null bila tidak ada', () => {
    expect(findConfigInterface([noFeature])).toBeNull();
  });

  test('perangkat dongle tidak dianggap kanal konfigurasi', () => {
    expect(findConfigInterface([dongle])).toBeNull();
  });

  test('DeviceError membawa kind untuk dibedakan pemanggil', () => {
    const e = new DeviceError('mode dongle', 'wrongmode');
    expect(e.kind).toBe('wrongmode');
    expect(e).toBeInstanceOf(Error);
  });
});

describe('pengiriman transaksi', () => {
  test('mengirim tiap paket sebagai feature report 0 sepanjang 64 byte', async () => {
    const sendFeatureReport = vi.fn().mockResolvedValue(undefined);
    const dev = { opened: true, sendFeatureReport } as unknown as HIDDevice;
    const packets = [new Uint8Array(64), new Uint8Array(64)];

    await sendTransaction(dev, packets, 0);

    expect(sendFeatureReport).toHaveBeenCalledTimes(2);
    const [reportId, payload] = sendFeatureReport.mock.calls[0];
    expect(reportId).toBe(0);
    expect(payload.length).toBe(64);
  });

  test('menolak paket berukuran salah', async () => {
    const dev = { opened: true, sendFeatureReport: vi.fn() } as unknown as HIDDevice;
    await expect(sendTransaction(dev, [new Uint8Array(65)], 0))
      .rejects.toThrow(/64 byte/);
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npm test`
Expected: FAIL — modul tidak ditemukan.

- [ ] **Step 3: Implementasi**

`src/gt65/device.ts`:

```ts
import { PAYLOAD_LEN } from './protocol';

export const VENDOR_ID = 0x05ac;
export const PRODUCT_ID = 0x024f;
export const FEATURE_REPORT_ID = 0;
export const VENDOR_INPUT_REPORT_ID = 5;

export type DeviceErrorKind = 'unsupported' | 'notfound' | 'permission' | 'wrongmode';

export class DeviceError extends Error {
  constructor(message: string, readonly kind: DeviceErrorKind) {
    super(message);
    this.name = 'DeviceError';
  }
}

function reportBytes(r: { items?: { reportSize?: number; reportCount?: number }[] }): number {
  let bits = 0;
  for (const it of r.items ?? []) bits += (it.reportSize ?? 0) * (it.reportCount ?? 0);
  return Math.ceil(bits / 8);
}

/** Interface konfigurasi adalah yang punya feature report >= 60 byte. */
export function findConfigInterface(devices: HIDDevice[]): HIDDevice | null {
  for (const d of devices) {
    for (const c of d.collections ?? []) {
      for (const r of c.featureReports ?? []) {
        if (reportBytes(r) >= 60) return d;
      }
    }
  }
  return null;
}

function looksLikeDongle(devices: HIDDevice[]): boolean {
  return devices.some((d) =>
    (d.collections ?? []).some((c) => c.usagePage === 0xffb5));
}

export async function requestDevice(): Promise<HIDDevice> {
  if (!('hid' in navigator)) {
    throw new DeviceError(
      'Browser ini tidak mendukung WebHID. Pakai Chrome, Edge, atau Brave.',
      'unsupported');
  }

  const devices = await navigator.hid.requestDevice({
    filters: [{ vendorId: VENDOR_ID, productId: PRODUCT_ID }],
  });

  if (devices.length === 0) {
    throw new DeviceError('Tidak ada perangkat dipilih.', 'notfound');
  }

  const dev = findConfigInterface(devices);
  if (!dev) {
    if (looksLikeDongle(devices)) {
      throw new DeviceError(
        'Keyboard tersambung lewat dongle 2.4 GHz. Konfigurasi hanya bisa ' +
        'lewat kabel USB — cabut dongle dan colok kabelnya.',
        'wrongmode');
    }
    throw new DeviceError(
      'Kanal konfigurasi tidak ditemukan pada perangkat ini.', 'notfound');
  }

  if (!dev.opened) {
    try {
      await dev.open();
    } catch (e) {
      throw new DeviceError(
        'Tidak bisa membuka perangkat. Di Linux, pasang udev rule: ' +
        'KERNEL=="hidraw*", ATTRS{idVendor}=="05ac", ATTRS{idProduct}=="024f", ' +
        'TAG+="uaccess" — lalu colok ulang keyboard.',
        'permission');
    }
  }
  return dev;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sendTransaction(
  dev: HIDDevice,
  packets: Uint8Array[],
  gapMs = 1,
): Promise<void> {
  for (const p of packets) {
    if (p.length !== PAYLOAD_LEN) {
      throw new RangeError(`paket harus 64 byte, dapat ${p.length}`);
    }
  }
  for (const p of packets) {
    await dev.sendFeatureReport(FEATURE_REPORT_ID, p);
    if (gapMs > 0) await sleep(gapMs);
  }
}

/** Berlangganan Report ID 5 dari interface vendor. Mengembalikan fungsi berhenti. */
export function onVendorInput(
  dev: HIDDevice,
  cb: (bytes: Uint8Array) => void,
): () => void {
  const handler = (e: HIDInputReportEvent) => {
    if (e.reportId !== VENDOR_INPUT_REPORT_ID) return;
    cb(new Uint8Array(e.data.buffer));
  };
  dev.addEventListener('inputreport', handler as EventListener);
  return () => dev.removeEventListener('inputreport', handler as EventListener);
}
```

- [ ] **Step 4: Jalankan test**

Run: `npm test`
Expected: PASS, 33 test.

- [ ] **Step 5: Commit**

```bash
git add src/gt65/device.ts test/device.test.ts
git commit -m "feat: transport WebHID dengan deteksi mode dongle dan galat izin"
```

---

### Task 8: Store profil

**Files:**
- Create: `src/store/profile.ts`
- Test: `test/profile.test.ts`

**Interfaces:**
- Consumes: `Entry`, `TABLE_ENTRIES`, `Lighting`, `Settings` dari Task 3–4; `KEYS` dari Task 6
- Produces: `type Profile`, `defaultProfile(): Profile`, `loadProfile(): Profile`, `saveProfile(p: Profile): void`, `exportProfile(p: Profile): string`, `importProfile(json: string): Profile`, konstanta `STORAGE_KEY`. Dipakai Task 9–12.

- [ ] **Step 1: Tulis test yang gagal**

`test/profile.test.ts`:

```ts
import { beforeEach, describe, expect, test } from 'vitest';
import { defaultProfile, loadProfile, saveProfile,
         exportProfile, importProfile } from '../src/store/profile';
import { KEYS } from '../src/gt65/layout';
import { TABLE_ENTRIES } from '../src/gt65/protocol';

beforeEach(() => localStorage.clear());

describe('profil bawaan', () => {
  test('punya 144 entri di tiap layer', () => {
    const p = defaultProfile();
    expect(p.layers.top.length).toBe(TABLE_ENTRIES);
    expect(p.layers.fn.length).toBe(TABLE_ENTRIES);
  });

  test('layer atas memetakan tiap tombol ke usage aslinya', () => {
    const p = defaultProfile();
    for (const k of KEYS) {
      expect(p.layers.top[k.keyIndex]).toEqual(
        { kind: 'key', mod: 0, usage: k.usage });
    }
  });

  test('slot yang tidak dipakai bernilai none', () => {
    const p = defaultProfile();
    const used = new Set(KEYS.map((k) => k.keyIndex));
    for (let i = 0; i < TABLE_ENTRIES; i++) {
      if (!used.has(i)) expect(p.layers.top[i]).toEqual({ kind: 'none' });
    }
  });
});

describe('persistensi', () => {
  test('menyimpan lalu memuat kembali profil yang sama', () => {
    const p = defaultProfile();
    p.lighting.r = 0x12;
    saveProfile(p);
    expect(loadProfile().lighting.r).toBe(0x12);
  });

  test('memuat bawaan bila penyimpanan kosong', () => {
    expect(loadProfile().name).toBe(defaultProfile().name);
  });

  test('memuat bawaan bila data rusak', () => {
    localStorage.setItem('gt65.profile', '{bukan json');
    expect(loadProfile().layers.top.length).toBe(TABLE_ENTRIES);
  });

  test('ekspor dan impor bolak-balik', () => {
    const p = defaultProfile();
    p.name = 'Uji';
    expect(importProfile(exportProfile(p)).name).toBe('Uji');
  });

  test('impor menolak versi tak dikenal', () => {
    expect(() => importProfile('{"version":99}')).toThrow(/versi/i);
  });
});
```

Tambahkan `environment: 'jsdom'` agar `localStorage` tersedia — buat `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'jsdom' },
});
```

dan pasang `jsdom`:

```bash
npm install -D jsdom
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npm test`
Expected: FAIL — modul tidak ditemukan.

- [ ] **Step 3: Implementasi**

`src/store/profile.ts`:

```ts
import { TABLE_ENTRIES } from '../gt65/protocol';
import type { Entry, Lighting, Settings } from '../gt65/protocol';
import { KEYS } from '../gt65/layout';

export const STORAGE_KEY = 'gt65.profile';
const VERSION = 1;

export type Profile = {
  version: number;
  name: string;
  layers: { top: Entry[]; fn: Entry[] };
  lighting: Lighting;
  settings: Settings;
};

function emptyLayer(): Entry[] {
  return Array.from({ length: TABLE_ENTRIES }, () => ({ kind: 'none' }) as Entry);
}

/**
 * Profil bawaan memetakan tiap tombol ke usage aslinya. Ini juga
 * berfungsi sebagai jalur pemulihan: menulis profil ini mengembalikan
 * keyboard ke keadaan wajar tanpa perlu software vendor.
 */
export function defaultProfile(): Profile {
  const top = emptyLayer();
  for (const k of KEYS) {
    top[k.keyIndex] = { kind: 'key', mod: 0, usage: k.usage };
  }
  return {
    version: VERSION,
    name: 'Bawaan',
    layers: { top, fn: emptyLayer() },
    lighting: { mode: 0, r: 0xff, g: 0xff, b: 0xff,
                speed: 2, brightness: 4, direction: 0 },
    settings: { flags: [false, false, false, false, false], sleepTimeout: 0 },
  };
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProfile();
    const p = JSON.parse(raw) as Profile;
    if (p.version !== VERSION) return defaultProfile();
    if (p.layers?.top?.length !== TABLE_ENTRIES) return defaultProfile();
    return p;
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // penyimpanan penuh atau diblokir; abaikan, profil tetap hidup di memori
  }
}

export function exportProfile(p: Profile): string {
  return JSON.stringify(p, null, 2);
}

export function importProfile(json: string): Profile {
  const p = JSON.parse(json) as Profile;
  if (p.version !== VERSION) {
    throw new Error(`Versi profil ${p.version} tidak dikenal, harus ${VERSION}.`);
  }
  if (p.layers?.top?.length !== TABLE_ENTRIES) {
    throw new Error('Profil rusak: jumlah entri layer tidak sesuai.');
  }
  return p;
}
```

- [ ] **Step 4: Jalankan test**

Run: `npm test`
Expected: PASS, 41 test.

- [ ] **Step 5: Commit**

```bash
git add src/store/profile.ts test/profile.test.ts vitest.config.ts package.json package-lock.json
git commit -m "feat: model profil dengan persistensi localStorage dan ekspor JSON"
```

---

### Task 9: Shell aplikasi, bar perangkat, dan mode kering

**Files:**
- Create: `src/app/App.tsx`, `src/app/DeviceBar.tsx`, `src/app/useDevice.ts`, `src/app/hex.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `requestDevice`, `sendTransaction`, `DeviceError` dari Task 7; `loadProfile`, `saveProfile` dari Task 8
- Produces: hook `useDevice()` mengembalikan `{ device, status, error, connect, send }` di mana `send(packets: Uint8Array[]): Promise<void>` menghormati mode kering; `formatHex(packets: Uint8Array[]): string`. Dipakai Task 10–12.

- [ ] **Step 1: Tulis pemformat hex dan testnya**

`src/app/hex.ts`:

```ts
export function formatHex(packets: Uint8Array[]): string {
  return packets
    .map((p, i) => {
      const rows: string[] = [];
      for (let o = 0; o < p.length; o += 16) {
        const bytes = [...p.subarray(o, o + 16)]
          .map((b) => b.toString(16).padStart(2, '0')).join(' ');
        rows.push(`  ${o.toString(16).padStart(2, '0')}: ${bytes}`);
      }
      return `paket ${i + 1}/${packets.length}\n${rows.join('\n')}`;
    })
    .join('\n\n');
}
```

`test/hex.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { formatHex } from '../src/app/hex';

describe('pemformat hex', () => {
  test('menampilkan nomor paket dan empat baris per paket', () => {
    const p = new Uint8Array(64);
    p[0] = 0x04; p[1] = 0x18;
    const s = formatHex([p]);
    expect(s).toContain('paket 1/1');
    expect(s).toContain('00: 04 18 00');
    expect(s.split('\n').filter((l) => l.includes(':')).length).toBe(4);
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal, lalu lulus**

Run: `npm test`
Expected: FAIL, lalu setelah file ada: PASS, 42 test.

- [ ] **Step 3: Tulis hook perangkat**

`src/app/useDevice.ts`:

```tsx
import { useCallback, useState } from 'react';
import { requestDevice, sendTransaction, DeviceError } from '../gt65/device';

export type Status = 'idle' | 'connecting' | 'connected' | 'error';

export function useDevice(dryRun: boolean) {
  const [device, setDevice] = useState<HIDDevice | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastPackets, setLastPackets] = useState<Uint8Array[]>([]);

  const connect = useCallback(async () => {
    setStatus('connecting');
    setError(null);
    try {
      setDevice(await requestDevice());
      setStatus('connected');
    } catch (e) {
      setStatus('error');
      setError(e instanceof DeviceError ? e.message : String(e));
    }
  }, []);

  const send = useCallback(async (packets: Uint8Array[]) => {
    setLastPackets(packets);
    if (dryRun) return;
    if (!device) {
      setError('Belum tersambung ke keyboard.');
      return;
    }
    setError(null);
    try {
      await sendTransaction(device, packets);
    } catch (e) {
      setError(`Gagal mengirim: ${String(e)}`);
    }
  }, [device, dryRun]);

  return { device, status, error, connect, send, lastPackets };
}
```

- [ ] **Step 4: Tulis bar perangkat dan shell**

`src/app/DeviceBar.tsx`:

```tsx
import type { Status } from './useDevice';

const LABEL: Record<Status, string> = {
  idle: 'Belum tersambung',
  connecting: 'Menyambungkan…',
  connected: 'Tersambung',
  error: 'Gagal',
};

export function DeviceBar({ status, error, dryRun, onConnect, onToggleDryRun }: {
  status: Status; error: string | null; dryRun: boolean;
  onConnect: () => void; onToggleDryRun: (v: boolean) => void;
}) {
  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-slate-700 px-6 py-3">
      <span className="font-semibold">GT65</span>
      <button onClick={onConnect}
              className="rounded border border-slate-600 px-3 py-1 hover:bg-slate-800">
        Sambungkan keyboard
      </button>
      <span className={status === 'connected' ? 'text-emerald-400' : 'text-slate-400'}>
        {LABEL[status]}
      </span>
      <label className="ml-auto flex items-center gap-2">
        <input type="checkbox" checked={dryRun}
               onChange={(e) => onToggleDryRun(e.target.checked)} />
        Mode kering (tidak menulis ke keyboard)
      </label>
      {error && <p className="w-full text-sm text-rose-400">{error}</p>}
    </header>
  );
}
```

`src/app/App.tsx`:

```tsx
import { useState } from 'react';
import { DeviceBar } from './DeviceBar';
import { useDevice } from './useDevice';
import { formatHex } from './hex';
import { loadProfile, saveProfile } from '../store/profile';
import type { Profile } from '../store/profile';

const TABS = ['Remap', 'Lampu', 'Pengaturan', 'Monitor'] as const;
type Tab = (typeof TABS)[number];

export function App() {
  const [dryRun, setDryRun] = useState(true);
  const [tab, setTab] = useState<Tab>('Lampu');
  const [profile, setProfileState] = useState<Profile>(loadProfile);
  const dev = useDevice(dryRun);

  const setProfile = (p: Profile) => { setProfileState(p); saveProfile(p); };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <DeviceBar status={dev.status} error={dev.error} dryRun={dryRun}
                 onConnect={dev.connect} onToggleDryRun={setDryRun} />
      <nav className="flex gap-2 px-6 py-3">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
                  className={`rounded px-3 py-1 ${
                    tab === t ? 'bg-slate-700' : 'hover:bg-slate-800'}`}>
            {t}
          </button>
        ))}
      </nav>
      <main className="px-6 pb-10">
        <p className="text-slate-400">
          Profil <strong>{profile.name}</strong> — tab {tab}, panel diisi pada task berikutnya.
        </p>
        <button onClick={() => setProfile({ ...profile, name: profile.name })}
                className="mt-2 rounded border border-slate-600 px-3 py-1">
          Simpan profil
        </button>
        {dev.lastPackets.length > 0 && (
          <pre className="mt-6 overflow-x-auto rounded bg-slate-950 p-4 text-xs">
            {formatHex(dev.lastPackets)}
          </pre>
        )}
      </main>
    </div>
  );
}
```

Ubah `src/main.tsx` agar merender `<App />`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
```

- [ ] **Step 5: Verifikasi build dan jalankan**

Run: `npm run build && npm run dev`
Expected: build sukses; halaman memuat, tombol sambung muncul, mode kering tercentang.

- [ ] **Step 6: Commit**

```bash
git add src/app src/main.tsx test/hex.test.ts
git commit -m "feat: shell aplikasi, bar perangkat, dan mode kering"
```

---

### Task 10: Panel pencahayaan dan pemetaan nilai mode

**Files:**
- Create: `src/app/panels/LightingPanel.tsx`
- Modify: `src/app/App.tsx`
- Modify: `docs/superpowers/specs/2026-08-31-gt65-web-configurator-design.md`

**Interfaces:**
- Consumes: `lighting` dari Task 3; `useDevice().send` dari Task 9; `Profile` dari Task 8
- Produces: komponen `<LightingPanel profile onChange onApply />`

- [ ] **Step 1: Tulis panel**

`src/app/panels/LightingPanel.tsx`:

```tsx
import type { Profile } from '../../store/profile';

export function LightingPanel({ profile, onChange, onApply }: {
  profile: Profile;
  onChange: (p: Profile) => void;
  onApply: () => void;
}) {
  const l = profile.lighting;
  const set = (patch: Partial<typeof l>) =>
    onChange({ ...profile, lighting: { ...l, ...patch } });

  const hex = `#${[l.r, l.g, l.b].map((v) =>
    v.toString(16).padStart(2, '0')).join('')}`;

  return (
    <section className="flex max-w-md flex-col gap-4">
      <label className="flex items-center justify-between gap-4">
        Mode
        <input type="number" min={0} max={30} value={l.mode}
               onChange={(e) => set({ mode: Number(e.target.value) })}
               className="w-24 rounded bg-slate-800 px-2 py-1" />
      </label>

      <label className="flex items-center justify-between gap-4">
        Warna
        <input type="color" value={hex}
               onChange={(e) => {
                 const v = e.target.value;
                 set({ r: parseInt(v.slice(1, 3), 16),
                       g: parseInt(v.slice(3, 5), 16),
                       b: parseInt(v.slice(5, 7), 16) });
               }} />
      </label>

      <label className="flex items-center justify-between gap-4">
        Kecepatan
        <input type="range" min={0} max={4} value={l.speed}
               onChange={(e) => set({ speed: Number(e.target.value) })} />
      </label>

      <label className="flex items-center justify-between gap-4">
        Kecerahan
        <input type="range" min={0} max={4} value={l.brightness}
               onChange={(e) => set({ brightness: Number(e.target.value) })} />
      </label>

      <label className="flex items-center justify-between gap-4">
        Arah
        <input type="number" min={0} max={3} value={l.direction}
               onChange={(e) => set({ direction: Number(e.target.value) })}
               className="w-24 rounded bg-slate-800 px-2 py-1" />
      </label>

      <button onClick={onApply}
              className="rounded bg-emerald-700 px-4 py-2 hover:bg-emerald-600">
        Terapkan pencahayaan
      </button>
    </section>
  );
}
```

- [ ] **Step 2: Sambungkan ke App**

Di `src/app/App.tsx`, impor `LightingPanel` dan `lighting`, lalu ganti isi `<main>` untuk tab `Lampu`:

```tsx
{tab === 'Lampu' && (
  <LightingPanel profile={profile} onChange={setProfile}
                 onApply={() => dev.send(lighting(profile.lighting))} />
)}
```

- [ ] **Step 3: Verifikasi mode kering**

Run: `npm run dev`

Buka aplikasi, ubah warna, klik Terapkan dengan mode kering aktif.
Expected: blok hex muncul; paket kedua diawali `04 13` dengan byte offset 8 bernilai `01`; paket ketiga memuat RGB di byte 1–3 dan `aa 55` di byte 14–15.

- [ ] **Step 4: Pemetaan nilai mode pada hardware**

Sambungkan keyboard, **matikan mode kering**. Untuk `mode` = 0 sampai efek berhenti berubah (biasanya di bawah 20), klik Terapkan dan catat efek lampu yang terlihat.

Ini eksperimen paling aman dalam proyek: hasilnya terlihat seketika dan kegagalan terburuknya hanya warna yang salah.

- [ ] **Step 5: Catat temuan ke spec**

Di spec Bagian 5.4, ganti paragraf "Yang belum pasti: daftar nilai `mode` yang sah" dengan tabel nilai hasil pengamatan. Lalu ganti input angka `Mode` di panel menjadi `<select>` berisi nama-nama mode tersebut.

- [ ] **Step 6: Commit**

```bash
git add src/app docs/superpowers/specs
git commit -m "feat: panel pencahayaan dan pemetaan nilai mode hasil pengamatan"
```

---

### Task 11: Panel pengaturan dan pemetaan flag

**Files:**
- Create: `src/app/panels/SettingsPanel.tsx`
- Modify: `src/app/App.tsx`
- Modify: `docs/superpowers/specs/2026-08-31-gt65-web-configurator-design.md`

**Interfaces:**
- Consumes: `settings` dari Task 3; `useDevice().send` dari Task 9
- Produces: komponen `<SettingsPanel profile onChange onApply />`

- [ ] **Step 1: Tulis panel dengan label sementara**

`src/app/panels/SettingsPanel.tsx`:

```tsx
import type { Profile } from '../../store/profile';

/**
 * Label masih berupa nomor offset karena pemetaan flag ke makna belum
 * ditentukan — lihat spec Bagian 5.4. Step 3 task ini menggantinya.
 */
export function SettingsPanel({ profile, onChange, onApply }: {
  profile: Profile;
  onChange: (p: Profile) => void;
  onApply: () => void;
}) {
  const s = profile.settings;

  const setFlag = (i: number, v: boolean) => {
    const flags = [...s.flags] as typeof s.flags;
    flags[i] = v;
    onChange({ ...profile, settings: { ...s, flags } });
  };

  return (
    <section className="flex max-w-md flex-col gap-4">
      {s.flags.map((v, i) => (
        <label key={i} className="flex items-center gap-3">
          <input type="checkbox" checked={v}
                 onChange={(e) => setFlag(i, e.target.checked)} />
          Flag byte {i + 1} <span className="text-slate-500">(belum diberi nama)</span>
        </label>
      ))}

      <label className="flex items-center justify-between gap-4">
        Timeout lampu tidur (menit)
        <input type="number" min={0} max={255} value={s.sleepTimeout}
               onChange={(e) => onChange({
                 ...profile,
                 settings: { ...s, sleepTimeout: Number(e.target.value) },
               })}
               className="w-24 rounded bg-slate-800 px-2 py-1" />
      </label>

      <button onClick={onApply}
              className="rounded bg-emerald-700 px-4 py-2 hover:bg-emerald-600">
        Terapkan pengaturan
      </button>
    </section>
  );
}
```

Sambungkan di `App.tsx` seperti pola Task 10, memakai `settings(profile.settings)`.

- [ ] **Step 2: Verifikasi mode kering**

Run: `npm run dev`
Expected: empat paket; paket kedua `04 17` dengan byte 8 = `01`; paket ketiga memuat flag di byte 1–5 dan `aa 55` di byte 62–63.

- [ ] **Step 3: Pemetaan flag pada hardware**

Matikan mode kering. Untuk tiap `i` dari 0 sampai 4: centang hanya flag ke-`i`, klik Terapkan, lalu uji perilaku keyboard:

- tekan tombol Win — masih berfungsi?
- coba Alt+Tab
- coba Alt+F4
- amati apakah game mode aktif

Catat flag mana memicu perilaku mana. Setelah selesai, kosongkan semua flag dan terapkan ulang untuk mengembalikan keadaan.

- [ ] **Step 4: Ganti label dan tipe**

Setelah pemetaan diketahui, ubah `Settings.flags` di `src/gt65/protocol.ts` dari tuple boolean menjadi objek bernama, misalnya:

```ts
export type Settings = {
  gameMode: boolean;
  disableWin: boolean;
  disableAltTab: boolean;
  disableAltF4: boolean;
  reserved: boolean;
  sleepTimeout: number;
  profileIndex?: number;
};
```

Perbarui `settings()` agar menulis tiap field ke offset yang benar sesuai temuan, perbarui test di `test/protocol.test.ts`, `defaultProfile()` di store, dan label di panel. Naikkan `VERSION` profil ke 2 dan buang profil lama pada `loadProfile()`.

- [ ] **Step 5: Jalankan test**

Run: `npm test`
Expected: PASS, seluruh test hijau dengan nama field baru.

- [ ] **Step 6: Catat ke spec dan commit**

Perbarui spec Bagian 5.4 dengan pemetaan final.

```bash
git add src test docs/superpowers/specs
git commit -m "feat: panel pengaturan dengan pemetaan flag hasil pengamatan"
```

---

### Task 12: Panel monitor

**Files:**
- Create: `src/app/panels/MonitorPanel.tsx`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes: `onVendorInput` dari Task 7
- Produces: komponen `<MonitorPanel device />`

- [ ] **Step 1: Tulis panel**

`src/app/panels/MonitorPanel.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { onVendorInput } from '../../gt65/device';

type Line = { at: string; hex: string; index: number };

export function MonitorPanel({ device }: { device: HIDDevice | null }) {
  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => {
    if (!device) return;
    const stop = onVendorInput(device, (bytes) => {
      setLines((prev) => [{
        at: new Date().toLocaleTimeString(),
        hex: [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' '),
        index: bytes[1] ?? 0,
      }, ...prev].slice(0, 200));
    });
    return stop;
  }, [device]);

  if (!device) {
    return <p className="text-slate-400">Sambungkan keyboard untuk memantau.</p>;
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <button onClick={() => setLines([])}
                className="rounded border border-slate-600 px-3 py-1 hover:bg-slate-800">
          Bersihkan
        </button>
        <span className="text-slate-400">{lines.length} event</span>
      </div>
      <ul className="max-h-96 overflow-y-auto rounded bg-slate-950 p-3 font-mono text-xs">
        {lines.map((l, i) => (
          <li key={i}>{l.at} · indeks {l.index} · {l.hex}</li>
        ))}
      </ul>
    </section>
  );
}
```

Sambungkan di `App.tsx` untuk tab `Monitor`, meneruskan `dev.device`.

Catatan: `bytes` di sini adalah isi report **tanpa** Report ID, sehingga indeks aksi yang di spec disebut `payload[2]` berada di `bytes[1]`.

- [ ] **Step 2: Verifikasi pada hardware**

Run: `npm run dev`

Sambungkan keyboard, buka tab Monitor. Kalau ada tombol yang sudah dipetakan ke aksi sisi PC oleh software vendor, menekannya akan memunculkan baris. Kalau tidak ada, daftar akan tetap kosong — itu hasil yang sah dan harus dicatat.

- [ ] **Step 3: Commit**

```bash
git add src/app
git commit -m "feat: panel monitor event vendor Report ID 5"
```

---

### Task 13: Grid keyboard dan panel remap

**Files:**
- Create: `src/app/KeyboardGrid.tsx`, `src/app/panels/RemapPanel.tsx`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes: `KEYS`, `LAYOUT_SIZE` dari Task 6; `MEDIA_ACTIONS`, `MOUSE_ACTIONS`, `SHORTCUTS`, `HID_KEYS` dari Task 5; `remap` dari Task 4
- Produces: komponen `<KeyboardGrid keys selected onSelect entries />` dan `<RemapPanel profile layer onChangeLayer onChange onApply />`

- [ ] **Step 1: Tulis grid**

`src/app/KeyboardGrid.tsx`:

```tsx
import { KEYS, LAYOUT_SIZE } from '../gt65/layout';
import type { Entry } from '../gt65/protocol';

const TAG_COLOR: Record<string, string> = {
  none: 'bg-slate-800', key: 'bg-slate-700', media: 'bg-indigo-800',
  mouse: 'bg-amber-800', macro: 'bg-fuchsia-800',
};

export function KeyboardGrid({ entries, selected, onSelect }: {
  entries: Entry[];
  selected: number | null;
  onSelect: (keyIndex: number) => void;
}) {
  return (
    <div className="relative mx-auto"
         style={{ width: LAYOUT_SIZE.width, height: LAYOUT_SIZE.height }}>
      {KEYS.map((k) => {
        const e = entries[k.keyIndex] ?? { kind: 'none' };
        const isSel = selected === k.keyIndex;
        return (
          <button key={k.keyIndex} onClick={() => onSelect(k.keyIndex)}
            style={{ left: k.x, top: k.y, width: k.w, height: k.h }}
            className={`absolute rounded text-[10px] leading-tight ${
              TAG_COLOR[e.kind]} ${
              isSel ? 'ring-2 ring-emerald-400' : 'hover:brightness-125'}`}>
            {k.name}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Tulis panel remap**

`src/app/panels/RemapPanel.tsx`:

```tsx
import { useState } from 'react';
import { KeyboardGrid } from '../KeyboardGrid';
import { MEDIA_ACTIONS, MOUSE_ACTIONS, SHORTCUTS, HID_KEYS } from '../../gt65/keycodes';
import type { Entry, Layer } from '../../gt65/protocol';
import type { Profile } from '../../store/profile';

export function RemapPanel({ profile, onChange, onApply }: {
  profile: Profile;
  onChange: (p: Profile) => void;
  onApply: (layer: Layer) => void;
}) {
  const [layer, setLayer] = useState<Layer>('top');
  const [selected, setSelected] = useState<number | null>(null);
  const entries = profile.layers[layer];

  const assign = (e: Entry) => {
    if (selected === null) return;
    const next = [...entries];
    next[selected] = e;
    onChange({ ...profile, layers: { ...profile.layers, [layer]: next } });
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="flex gap-2">
        {(['top', 'fn'] as Layer[]).map((l) => (
          <button key={l} onClick={() => setLayer(l)}
                  className={`rounded px-3 py-1 ${
                    layer === l ? 'bg-slate-700' : 'hover:bg-slate-800'}`}>
            {l === 'top' ? 'Layer utama' : 'Layer Fn'}
          </button>
        ))}
        <button onClick={() => onApply(layer)}
                className="ml-auto rounded bg-emerald-700 px-4 py-2 hover:bg-emerald-600">
          Terapkan layer ini
        </button>
      </div>

      <KeyboardGrid entries={entries} selected={selected} onSelect={setSelected} />

      {selected === null ? (
        <p className="text-slate-400">Klik satu tombol untuk mengubah fungsinya.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-4">
          <Group title="Tombol">
            <select onChange={(e) => assign({
                      kind: 'key', mod: 0, usage: Number(e.target.value) })}
                    className="w-full rounded bg-slate-800 px-2 py-1">
              <option>— pilih —</option>
              {HID_KEYS.map((k) => (
                <option key={k.usage} value={k.usage}>{k.label}</option>
              ))}
            </select>
          </Group>
          <Group title="Shortcut">
            {SHORTCUTS.map((a) => (
              <Btn key={a.id} onClick={() => assign(a.entry)}>{a.label}</Btn>
            ))}
          </Group>
          <Group title="Multimedia">
            {MEDIA_ACTIONS.map((a) => (
              <Btn key={a.id} onClick={() => assign(a.entry)}>{a.label}</Btn>
            ))}
          </Group>
          <Group title="Mouse">
            {MOUSE_ACTIONS.map((a) => (
              <Btn key={a.id} onClick={() => assign(a.entry)}>{a.label}</Btn>
            ))}
            <Btn onClick={() => assign({ kind: 'none' })}>Nonaktifkan</Btn>
          </Group>
        </div>
      )}
    </section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs uppercase tracking-wide text-slate-400">{title}</h3>
      {children}
    </div>
  );
}

function Btn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
            className="rounded bg-slate-800 px-2 py-1 text-left hover:bg-slate-700">
      {children}
    </button>
  );
}
```

Sambungkan di `App.tsx` untuk tab `Remap`, dengan `onApply={(l) => dev.send(remap(l, profile.layers[l]))}`.

- [ ] **Step 3: Verifikasi mode kering**

Run: `npm run dev`
Expected: 13 paket; paket kedua `04 11` (layer utama) atau `04 27` (layer Fn) dengan byte 8 = `09`; paket terakhir `04 f0`.

- [ ] **Step 4: Uji pada hardware**

Ini penulisan paling berisiko dalam proyek. Sebelum mematikan mode kering, ekspor profil sebagai cadangan.

Ubah **satu** tombol yang tidak kritis — misalnya tombol kutip di baris rumah — lalu terapkan dan uji. Kalau berhasil, lanjut ke perubahan lain.

Kalau keyboard jadi tidak wajar, gunakan tombol Pulihkan bawaan dari Task 14.

- [ ] **Step 5: Commit**

```bash
git add src/app
git commit -m "feat: grid keyboard dan panel remap dua layer"
```

---

### Task 14: Pulihkan bawaan

**Files:**
- Modify: `src/app/App.tsx`
- Create: `src/app/RestoreButton.tsx`

**Interfaces:**
- Consumes: `defaultProfile` dari Task 8; `remap`, `lighting`, `settings` dari Task 3–4; `useDevice().send` dari Task 9
- Produces: komponen `<RestoreButton onRestore />`

- [ ] **Step 1: Tulis tombol pemulihan**

`src/app/RestoreButton.tsx`:

```tsx
import { useState } from 'react';

export function RestoreButton({ onRestore }: { onRestore: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)}
              className="rounded border border-amber-600 px-3 py-1 text-amber-400
                         hover:bg-amber-950">
        Pulihkan bawaan
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-sm">
      Tulis ulang seluruh konfigurasi ke bawaan?
      <button onClick={() => { setConfirming(false); onRestore(); }}
              className="rounded bg-amber-700 px-3 py-1">Ya, tulis</button>
      <button onClick={() => setConfirming(false)}
              className="rounded border border-slate-600 px-3 py-1">Batal</button>
    </span>
  );
}
```

- [ ] **Step 2: Sambungkan ke App**

Tambahkan di `App.tsx`, di dalam `<nav>`:

```tsx
<RestoreButton onRestore={async () => {
  const d = defaultProfile();
  setProfile(d);
  await dev.send(remap('top', d.layers.top));
  await dev.send(remap('fn', d.layers.fn));
  await dev.send(lighting(d.lighting));
  await dev.send(settings(d.settings));
}} />
```

- [ ] **Step 3: Verifikasi mode kering**

Run: `npm run dev`
Expected: klik memunculkan konfirmasi; menyetujui menghasilkan empat transaksi berturut-turut, blok hex terakhir menampilkan transaksi pengaturan.

- [ ] **Step 4: Uji pada hardware**

Matikan mode kering, klik Pulihkan bawaan, dan pastikan seluruh tombol kembali ke fungsi aslinya. Ini yang membuat Task 13 aman untuk bereksperimen.

- [ ] **Step 5: Commit**

```bash
git add src/app
git commit -m "feat: pulihkan bawaan sebagai jalur pemulihan tanpa Windows"
```

---

### Task 15: Berkas README dan deploy

**Files:**
- Create: `README.md`
- Create: `.github/workflows/pages.yml`

**Interfaces:**
- Consumes: seluruh task sebelumnya
- Produces: situs statis ter-deploy

- [ ] **Step 1: Tulis README**

`README.md`:

````markdown
# GT65 Configurator

Konfigurator berbasis browser untuk keyboard VortexSeries GT65, sebagai
pengganti software vendor yang hanya tersedia di Windows.

Protokolnya hasil rekayasa balik dari `DeviceDriver.exe` dan diverifikasi
terhadap hardware: report descriptor keyboard identik byte-per-byte dengan
yang diekstrak dari firmware.

## Yang perlu diketahui sebelum memakai

**Hanya Chromium.** Aplikasi memakai WebHID, yang hanya ada di Chrome, Edge,
Brave, dan Opera. Firefox dan Safari tidak mendukungnya dan tidak akan bisa.

**Hanya mode kabel.** Sambungkan keyboard dengan kabel USB. Lewat dongle
2.4 GHz, keyboard menampilkan layout HID berbeda yang tidak memuat kanal
konfigurasi; aplikasi akan menolak dengan pesan jelas.

**Keyboard tidak bisa dibaca.** Perangkat hanya menerima tulisan, tidak
mengembalikan konfigurasinya. Karena itu **aplikasi ini yang menjadi sumber
kebenaran**, bukan keyboard. Profil disimpan di browser, dan tombol Terapkan
selalu menulis ulang seluruh konfigurasi. Ekspor profil Anda sebagai cadangan.

**Mode kering aktif secara bawaan.** Aplikasi menampilkan paket yang akan
dikirim tanpa benar-benar mengirimnya. Matikan hanya kalau Anda siap menulis.

## Linux: izin perangkat

`/dev/hidraw*` bawaannya hanya bisa diakses root, sehingga browser tidak bisa
membuka keyboard. Pasang udev rule:

```bash
echo 'KERNEL=="hidraw*", ATTRS{idVendor}=="05ac", ATTRS{idProduct}=="024f", TAG+="uaccess"' \
  | sudo tee /etc/udev/rules.d/70-gt65.rules
sudo udevadm control --reload-rules && sudo udevadm trigger
```

Colok ulang keyboard setelahnya.

Catatan: GT65 memakai Vendor ID milik Apple (`05AC`) tanpa hak, jadi rule di
atas juga mengenai keyboard Apple asli.

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

WebHID menolak `file://`, jadi aplikasi harus diakses lewat `http://localhost`
atau HTTPS.

## Pengembangan

```bash
npm test        # golden test byte, tidak butuh keyboard
npm run build
```

Kesalahan protokol tidak memunculkan error — keyboard mengabaikan paket yang
salah tanpa memberi tahu. Golden test byte adalah jaring pengaman utamanya.

## Pemulihan

Tombol **Pulihkan bawaan** menulis ulang seluruh konfigurasi ke keadaan
wajar. Tidak ada perintah reset pabrik di protokol keyboard — software vendor
pun melakukan hal yang sama, sehingga pemulihan tidak memerlukan Windows.

## Dokumentasi

- `docs/superpowers/specs/` — desain dan spesifikasi protokol lengkap
- `docs/hardware-findings.md` — hasil verifikasi pada hardware
````

- [ ] **Step 2: Tulis workflow deploy**

`.github/workflows/pages.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: github-pages
    steps:
      - uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Verifikasi build bersih**

Run: `npm ci && npm test && npm run build`
Expected: seluruh test lulus, `dist/` terbentuk.

- [ ] **Step 4: Commit**

```bash
git add README.md .github
git commit -m "docs: README dan workflow deploy GitHub Pages"
```

---

## Catatan untuk pelaksana

**Kesalahan protokol tidak memunculkan error.** Keyboard mengabaikan paket yang salah tanpa memberi tahu. Karena itu golden test byte adalah jaring pengaman utama — jangan longgarkan.

**Dua langkah penemuan wajib.** Task 10 Step 4 (nilai mode) dan Task 11 Step 3 (pemetaan flag) tidak bisa dilewati; keduanya menghasilkan informasi yang tidak ada di binary vendor. Catat hasilnya kembali ke spec.

**Urutan risiko sudah disengaja.** Pencahayaan lebih dulu karena paling aman, remap terakhir karena paling berisiko, dan pemulihan tersedia sebelum remap diuji sungguhan.
