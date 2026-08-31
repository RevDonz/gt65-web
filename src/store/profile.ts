import { TABLE_ENTRIES } from '../gt65/protocol';
import type { Entry, Lighting, Settings } from '../gt65/protocol';
import { KEYS } from '../gt65/layout';

export const STORAGE_KEY = 'gt65.profile';
const VERSION = 2;

/**
 * Asal-usul profil di browser ini. `'default'` berarti belum pernah
 * disentuh sama sekali — belum diedit di sini, belum diimpor. Itu satu
 * momen berbahaya: keyboard tidak bisa dibaca balik, jadi kalau profilnya
 * masih bawaan, aplikasi ini TIDAK TAHU apa yang sesungguhnya tersimpan di
 * perangkat (bisa saja pemetaan dari software vendor di komputer lain).
 * Menerapkan remap saat itu menimpanya tanpa peringatan — lihat
 * `needsOverwriteWarning`. Begitu diedit atau diimpor, provenance berubah
 * permanen dan peringatan itu tidak muncul lagi.
 */
export type Provenance = 'default' | 'edited' | 'imported';

export type Profile = {
  version: number;
  name: string;
  provenance: Provenance;
  /** Sudah pernah diekspor atau diimpor di browser ini — lihat App.tsx. */
  backedUp: boolean;
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
 *
 * DUA ASUMSI BELUM TERVERIFIKASI, keduanya tepat di jalur pemulihan:
 *
 * 1. Tombol Fn. XML vendor memberinya `code="0xaf"` (key_index 96), dan
 *    0xAF adalah *Reserved* di HID Keyboard usage page — jadi itu penanda
 *    internal vendor, bukan usage HID sungguhan. Apakah menuliskannya
 *    sebagai `{kind:'key', usage:0xAF}` mempertahankan perilaku
 *    layer-shift atau justru mengubah Fn menjadi tombol mati bergantung
 *    pada firmware, dan belum pernah diuji.
 *
 * 2. Layer Fn ditulis nol seluruhnya. Tabel tag spec Bagian 5.5 menyebut
 *    `0x00` sebagai "default / nonaktif" — dua makna yang berlawanan.
 *    Kalau artinya "default firmware", pemulihan ini benar. Kalau artinya
 *    "nonaktif", pemulihan justru MENGHAPUS layer Fn pabrik, dan aplikasi
 *    tidak bisa membangunnya kembali karena XML vendor hanya memuat satu
 *    layer. Itu hilangnya fungsi secara permanen dan tak terpulihkan,
 *    disebabkan oleh tombol pemulihan itu sendiri.
 *
 * Keduanya harus dipastikan sebelum "Pulihkan bawaan" boleh disebut aman.
 * Lihat docs/hardware-checklist.md, Task 14 — uji "semua tombol kembali
 * normal" saja tidak akan menangkap hilangnya layer Fn.
 *
 * NILAI SEMENTARA: `settings.flags` di bawah masih penampung, bukan nilai
 * terkonfirmasi — makna kelima flag masih menunggu langkah hardware (spec
 * Bagian 5.4).
 *
 * `lighting.mode`, `lighting.speed`, dan `lighting.brightness` TIDAK lagi
 * sementara — ketiganya terkonfirmasi di hardware sungguhan (2026-08-31):
 * mode 6 ("Breath") ada di rentang 1..19 yang terbukti menyalakan lampu
 * (0, 20, 21 terbukti tidak menyalakan apa pun); payload[9] terbukti
 * kecerahan dan payload[10] terbukti kecepatan (kebalikan dari dugaan
 * awal berdasar urutan field di disassembly). Nilai 2 untuk speed/
 * brightness DIPILIH KARENA, bukan meski, `lighting()` mengirim value+1:
 * itu menghasilkan wire byte 3, satu-satunya nilai yang terbukti langsung
 * di perangkat fisik (halaman diagnostik mengirim byte mentah tanpa +1).
 * Ini BUKAN titik tengah rentang UI — ini jalur pemulihan ("Pulihkan
 * bawaan"), satu-satunya tombol yang tersedia saat keyboard salah
 * konfigurasi dan tidak ada perintah factory-reset. Nilai di luar rentang
 * kabel 1..5 (lihat rgb-keyboard.xml vendor: speed_max=5, brightness_max=5)
 * akan membuat tombol penyelamat ini justru mematikan lampu.
 *
 * Yang BELUM DIPASTIKAN: mode mana saja yang benar-benar dipengaruhi oleh
 * `r`/`g`/`b` — lihat catatan di LightingPanel.
 */
export function defaultProfile(): Profile {
  const top = emptyLayer();
  for (const k of KEYS) {
    top[k.keyIndex] = { kind: 'key', mod: 0, usage: k.usage };
  }
  return {
    version: VERSION,
    name: 'Bawaan',
    provenance: 'default',
    backedUp: false,
    layers: { top, fn: emptyLayer() },
    lighting: { mode: 6, r: 0xff, g: 0xff, b: 0xff,
                speed: 2, brightness: 2, direction: 0 },
    settings: { flags: [false, false, false, false, false], sleepTimeout: 0 },
  };
}

// --- Validasi -------------------------------------------------------------
//
// Keyboard ini tidak bisa dibaca balik, jadi profil yang bentuknya salah
// tidak menimbulkan error apa pun — ia hanya menulis byte yang salah ke
// perangkat, atau membuat panel UI crash saat render (tanpa error boundary,
// crash render mengosongkan halaman dan satu-satunya jalan keluar adalah
// menghapus data situs). Karena itu profil dari sumber luar — berkas impor
// maupun localStorage yang bisa diedit tangan — harus lolos pemeriksaan
// bentuk lengkap sebelum dipakai.

function fail(msg: string): never {
  throw new Error(msg);
}

/** Semua angka di protokol ini muat dalam satu byte payload. */
function byte(v: unknown, what: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 255) {
    fail(`Profil rusak: ${what} harus bilangan bulat 0-255.`);
  }
  return v;
}

function parseEntry(v: unknown, where: string): Entry {
  if (typeof v !== 'object' || v === null) {
    fail(`Profil rusak: entri ${where} bukan objek.`);
  }
  const e = v as Record<string, unknown>;
  switch (e.kind) {
    case 'none':
      return { kind: 'none' };
    case 'key':
      return { kind: 'key',
               mod: byte(e.mod, `modifier entri ${where}`),
               usage: byte(e.usage, `usage entri ${where}`) };
    case 'media':
      return { kind: 'media', usage: byte(e.usage, `usage media entri ${where}`) };
    case 'mouse':
      if (e.ev !== 1 && e.ev !== 3) {
        fail(`Profil rusak: jenis kejadian mouse entri ${where} harus 1 atau 3.`);
      }
      return { kind: 'mouse', ev: e.ev, val: byte(e.val, `nilai mouse entri ${where}`) };
    case 'macro':
      return { kind: 'macro',
               slot: byte(e.slot, `slot makro entri ${where}`),
               mode: byte(e.mode, `mode makro entri ${where}`),
               repeat: byte(e.repeat, `pengulangan makro entri ${where}`) };
    default:
      fail(`Profil rusak: jenis entri "${String(e.kind)}" tidak dikenal (${where}).`);
  }
}

function parseLayer(v: unknown, name: string): Entry[] {
  if (!Array.isArray(v) || v.length !== TABLE_ENTRIES) {
    fail(`Profil rusak: layer ${name} harus berisi tepat ${TABLE_ENTRIES} entri.`);
  }
  return v.map((e, i) => parseEntry(e, `${name}[${i}]`));
}

function parseLighting(v: unknown): Lighting {
  if (typeof v !== 'object' || v === null) {
    fail('Profil rusak: blok pencahayaan tidak ada.');
  }
  const l = v as Record<string, unknown>;
  return {
    mode: byte(l.mode, 'mode lampu'),
    r: byte(l.r, 'komponen merah'),
    g: byte(l.g, 'komponen hijau'),
    b: byte(l.b, 'komponen biru'),
    speed: byte(l.speed, 'kecepatan lampu'),
    brightness: byte(l.brightness, 'kecerahan lampu'),
    direction: byte(l.direction, 'arah lampu'),
  };
}

function parseProvenance(v: unknown): Provenance {
  if (v !== 'default' && v !== 'edited' && v !== 'imported') {
    fail(`Profil rusak: provenance "${String(v)}" tidak dikenal.`);
  }
  return v;
}

function parseSettings(v: unknown): Settings {
  if (typeof v !== 'object' || v === null) {
    fail('Profil rusak: blok pengaturan tidak ada.');
  }
  const s = v as Record<string, unknown>;
  const flags = s.flags;
  if (!Array.isArray(flags) || flags.length !== 5 ||
      !flags.every((f) => typeof f === 'boolean')) {
    fail('Profil rusak: pengaturan harus punya tepat 5 flag boolean.');
  }
  const out: Settings = {
    flags: [flags[0], flags[1], flags[2], flags[3], flags[4]],
    sleepTimeout: byte(s.sleepTimeout, 'timeout lampu tidur'),
  };
  if (s.profileIndex !== undefined) {
    out.profileIndex = byte(s.profileIndex, 'indeks profil');
  }
  return out;
}

/**
 * VERSION 1 tidak punya `provenance`/`backedUp` — keduanya ditambahkan saat
 * VERSION dinaikkan ke 2. Sebelum fungsi ini ada, profil v1 tersimpan
 * gagal pemeriksaan versi di `parseProfile` dan `loadProfile` diam-diam
 * menimpanya dengan `defaultProfile()` — pada keyboard yang tidak bisa
 * dibaca balik, itu MEMBUANG satu-satunya catatan konfigurasi pengguna.
 *
 * Migrasi di sini mempertahankan `layers`/`lighting`/`settings`/`name` apa
 * adanya (lewat pemeriksa bentuk yang sama dengan v2, supaya profil yang
 * bentuknya salah tetap jatuh ke `defaultProfile()`, bukan lolos setengah
 * matang) dan secara eksplisit menyatakan:
 *
 * - `provenance: 'edited'` — profil v1 tersimpan hanya ada karena seseorang
 *   pernah menyunting/menyimpannya; menandainya `'default'` akan membuat
 *   `needsOverwriteWarning` salah baca profil yang sudah disentuh sebagai
 *   belum pernah disentuh, dan melewatkan peringatan menimpa yang justru
 *   dibutuhkan di sini.
 * - `backedUp: false` — v1 tidak melacak status cadangan sama sekali.
 */
function migrateV1(p: Record<string, unknown>): Profile {
  if (typeof p.name !== 'string') {
    fail('Profil rusak: nama profil bukan teks.');
  }
  if (typeof p.layers !== 'object' || p.layers === null) {
    fail('Profil rusak: blok layer tidak ada.');
  }
  const layers = p.layers as Record<string, unknown>;
  return {
    version: VERSION,
    name: p.name,
    provenance: 'edited',
    backedUp: false,
    layers: {
      top: parseLayer(layers.top, 'utama'),
      fn: parseLayer(layers.fn, 'Fn'),
    },
    lighting: parseLighting(p.lighting),
    settings: parseSettings(p.settings),
  };
}

/**
 * Satu-satunya gerbang masuk profil dari luar memori. Melempar `Error`
 * berbahasa Indonesia (UI menampilkannya apa adanya) dan mengembalikan
 * objek baru yang sudah dinormalkan — bukan referensi ke masukan — agar
 * field asing tidak ikut terbawa ke penyimpanan atau ke perangkat.
 *
 * VERSION 1 dimigrasi lewat `migrateV1` alih-alih ditolak — lihat doc
 * comment-nya. Versi lain (bukan 1, bukan VERSION saat ini) tetap ditolak.
 */
export function parseProfile(v: unknown): Profile {
  if (typeof v !== 'object' || v === null) {
    fail('Profil rusak: isinya bukan objek JSON.');
  }
  const p = v as Record<string, unknown>;
  if (p.version === 1) {
    return migrateV1(p);
  }
  if (p.version !== VERSION) {
    fail(`Versi profil ${String(p.version)} tidak dikenal, harus ${VERSION}.`);
  }
  if (typeof p.name !== 'string') {
    fail('Profil rusak: nama profil bukan teks.');
  }
  if (typeof p.backedUp !== 'boolean') {
    fail('Profil rusak: status cadangan bukan boolean.');
  }
  if (typeof p.layers !== 'object' || p.layers === null) {
    fail('Profil rusak: blok layer tidak ada.');
  }
  const layers = p.layers as Record<string, unknown>;
  return {
    version: VERSION,
    name: p.name,
    provenance: parseProvenance(p.provenance),
    backedUp: p.backedUp,
    layers: {
      top: parseLayer(layers.top, 'utama'),
      fn: parseLayer(layers.fn, 'Fn'),
    },
    lighting: parseLighting(p.lighting),
    settings: parseSettings(p.settings),
  };
}

// --- Penyimpanan ----------------------------------------------------------

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProfile();
    return parseProfile(JSON.parse(raw));
  } catch {
    return defaultProfile();
  }
}

/**
 * localStorage masih salinan utama profil, jadi kegagalan menyimpan
 * (kuota penuh, penyimpanan diblokir) berarti suntingan pengguna bisa
 * hilang. Kembalikan hasilnya supaya UI bisa memberitahu.
 */
export function saveProfile(p: Profile): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}

export function exportProfile(p: Profile): string {
  return JSON.stringify(p, null, 2);
}

/**
 * Berkas yang diimpor selalu menjadi provenance `'imported'`, apa pun nilai
 * provenance yang tersimpan di dalam berkasnya sendiri — bahkan kalau
 * isinya kebetulan identik dengan `defaultProfile()`. Titik baliknya
 * adalah TINDAKAN mengimpor, bukan isi berkasnya: begitu pengguna memilih
 * berkas secara sadar, profil di browser ini bukan lagi "belum pernah
 * disentuh". `parseProfile` sendiri tidak melakukan penimpaan ini karena ia
 * juga dipakai `loadProfile` untuk localStorage, yang provenance-nya harus
 * bertahan apa adanya lintas muat ulang halaman.
 */
export function importProfile(json: string): Profile {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    fail('Berkas ini bukan JSON yang sah.');
  }
  const p = parseProfile(raw);
  return { ...p, provenance: 'imported', backedUp: true };
}

// --- Pengaman menimpa konfigurasi tak terlihat -----------------------------

function sameContent(a: Profile, b: Profile): boolean {
  return JSON.stringify(a.layers) === JSON.stringify(b.layers)
      && JSON.stringify(a.lighting) === JSON.stringify(b.lighting)
      && JSON.stringify(a.settings) === JSON.stringify(b.settings);
}

/**
 * Titik tumpu TUNGGAL promosi provenance ke `'edited'`. Dipanggil oleh
 * pembungkus `setProfile` di App.tsx untuk SETIAP perubahan profil, apa pun
 * sumbernya (panel remap/lampu/pengaturan, impor berkas, atau "Pulihkan
 * bawaan") — supaya panel baru di masa depan tidak bisa lupa menandai
 * suntingannya sendiri seperti yang harus dilakukan lima panel kalau
 * pemeriksaan ini disebar ke tiap `onChange`.
 *
 * Hanya menaikkan ke `'edited'` saat KEDUA provenance — lama maupun baru —
 * masih `'default'` dan isinya (layer/lighting/settings) benar-benar
 * berbeda. Panel menyalin `profile` lama apa adanya (`{...profile, ...}`)
 * sehingga provenance ikut terbawa tanpa diubah; import dan "Pulihkan
 * bawaan" selalu menyatakan provenance mereka sendiri secara eksplisit
 * (`'imported'`/`'default'`) sehingga tidak pernah masuk cabang ini —
 * import tetap `'imported'`, dan pemulihan bawaan tetap `'default'` (benar:
 * setelah dipulihkan, profilnya sungguh-sungguh identik dengan bawaan
 * pabrik lagi).
 */
export function promoteProvenance(prev: Profile, next: Profile): Profile {
  if (prev.provenance === 'default' && next.provenance === 'default'
      && !sameContent(prev, next)) {
    return { ...next, provenance: 'edited' };
  }
  return next;
}

/**
 * Satu-satunya pertanyaan yang harus dijawab sebelum menerapkan remap:
 * apakah profil di browser ini masih bawaan yang belum pernah disentuh?
 * Kalau ya, keyboard mungkin masih menyimpan pemetaan tombol dari komputer
 * lain yang tidak bisa dibaca ulang — menerapkan remap akan menimpanya
 * tanpa jejak (lihat insiden di App.tsx). Dipisah sebagai fungsi murni
 * supaya bisa diuji tanpa merender modalnya, mengikuti pola `sendDecision`
 * di useDevice.ts.
 */
export function needsOverwriteWarning(profile: Profile): boolean {
  return profile.provenance === 'default';
}
