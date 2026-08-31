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
 * awal berdasar urutan field di disassembly). Nilai 7 untuk speed/
 * brightness adalah titik tengah rentang UI 0-15, dipilih sebagai bawaan
 * yang wajar, bukan hasil pengukuran spesifik.
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
    layers: { top, fn: emptyLayer() },
    lighting: { mode: 6, r: 0xff, g: 0xff, b: 0xff,
                speed: 7, brightness: 7, direction: 0 },
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
 * Satu-satunya gerbang masuk profil dari luar memori. Melempar `Error`
 * berbahasa Indonesia (UI menampilkannya apa adanya) dan mengembalikan
 * objek baru yang sudah dinormalkan — bukan referensi ke masukan — agar
 * field asing tidak ikut terbawa ke penyimpanan atau ke perangkat.
 */
export function parseProfile(v: unknown): Profile {
  if (typeof v !== 'object' || v === null) {
    fail('Profil rusak: isinya bukan objek JSON.');
  }
  const p = v as Record<string, unknown>;
  if (p.version !== VERSION) {
    fail(`Versi profil ${String(p.version)} tidak dikenal, harus ${VERSION}.`);
  }
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

export function importProfile(json: string): Profile {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    fail('Berkas ini bukan JSON yang sah.');
  }
  return parseProfile(raw);
}
