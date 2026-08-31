import type { Entry } from './protocol';
import { KEYS } from './layout';

export type Action = { id: string; label: string; entry: Entry };

/** Bitmask modifier HID standar (spec Bagian 5.5). */
export const MODIFIERS = {
  ctrl:  0x01,
  shift: 0x02,
  alt:   0x04,
  gui:   0x08,
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

const { ctrl, alt, gui } = MODIFIERS;

export const SHORTCUTS: Action[] = [
  { id: 'show_desktop',   label: 'Tampilkan desktop (Win+D)', entry: { kind: 'key', mod: gui,  usage: 0x07 } },
  { id: 'my_computer',    label: 'File Explorer (Win+E)',     entry: { kind: 'key', mod: gui,  usage: 0x08 } },
  { id: 'lock',           label: 'Kunci layar (Win+L)',       entry: { kind: 'key', mod: gui,  usage: 0x0f } },
  { id: 'close_window',   label: 'Tutup jendela (Ctrl+W)',    entry: { kind: 'key', mod: ctrl, usage: 0x1a } },
  { id: 'switch_windows', label: 'Ganti jendela (Alt+Tab)',   entry: { kind: 'key', mod: alt,  usage: 0x2b } },
  { id: 'copy',           label: 'Salin (Ctrl+C)',            entry: { kind: 'key', mod: ctrl, usage: 0x06 } },
  { id: 'paste',          label: 'Tempel (Ctrl+V)',           entry: { kind: 'key', mod: ctrl, usage: 0x19 } },
  { id: 'cut',            label: 'Potong (Ctrl+X)',           entry: { kind: 'key', mod: ctrl, usage: 0x1b } },
];

/**
 * Pemilih tombol biasa DIHASILKAN dari `layout.ts` — bukan daftar tulisan
 * tangan. Sebelumnya `HID_KEYS` hanya memuat subset yang ditulis manual
 * (A–Z, 1–9/0, Enter/Esc/Backspace/Tab/Space, F1–F12, empat panah), padahal
 * `layout.ts` sudah memuat ke-66 tombol fisik keyboard ini beserta usage
 * HID aslinya. Akibatnya tombol bisa dipetakan MENJADI huruf tapi tidak
 * bisa dikembalikan ke tanda baca (mis. `;`) — dan pada keyboard yang
 * tidak bisa dibaca balik serta tanpa perintah reset pabrik, itu pintu
 * satu arah: satu-satunya jalan keluar adalah cadangan profil yang mungkin
 * tidak pernah dibuat pengguna.
 *
 * Label setiap opsi memakai field `name` dari `layout.ts`, yaitu tulisan
 * asli di keycap — bukan terjemahan buatan tangan — supaya opsi di
 * dropdown selalu cocok dengan apa yang tercetak di tombol fisik.
 *
 * Papan ini (65%) tidak punya baris F1–F12 maupun Insert/Home/End
 * sebagai tombol fisik, jadi usage tersebut sengaja TIDAK muncul lagi di
 * sini — sesuai cakupan `layout.ts`. Lihat laporan tugas untuk detail.
 */
const KEY_GROUP_LABELS = {
  huruf: 'Huruf',
  angka: 'Angka',
  simbol: 'Simbol',
  kontrol: 'Kontrol',
  navigasi: 'Navigasi',
  modifier: 'Modifier',
  lainnya: 'Lainnya',
} as const;

type KeyGroupId = keyof typeof KEY_GROUP_LABELS;

/** Tombol kontrol/spasi HID standar yang bukan huruf, angka, atau simbol. */
const CONTROL_USAGES = new Set([0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x39]);

/**
 * Klasifikasi berdasar rentang usage HID Keyboard/Keypad Page (spec
 * USB HID Usage Tables §10), bukan lookup per-tombol tulisan tangan —
 * supaya pengelompokan otomatis mengikuti data `layout.ts`.
 */
function classifyUsage(usage: number): KeyGroupId {
  if (usage >= 0x04 && usage <= 0x1d) return 'huruf';
  if (usage >= 0x1e && usage <= 0x27) return 'angka';
  if (usage >= 0x2d && usage <= 0x38) return 'simbol';
  if (CONTROL_USAGES.has(usage)) return 'kontrol';
  if (usage >= 0x49 && usage <= 0x52) return 'navigasi';
  if (usage >= 0xe0 && usage <= 0xe7) return 'modifier';
  return 'lainnya';
}

export type KeyGroup = { id: KeyGroupId; label: string; keys: { usage: number; label: string }[] };

/**
 * Satu opsi per usage DISTINCT di `layout.ts` — sengaja dibangun lewat
 * `Map` berkunci usage, bukan `KEYS.map()` langsung, supaya dua tombol
 * fisik dengan usage yang sama (kalaupun suatu saat terjadi) tidak
 * menghasilkan opsi dropdown ganda. Papan ini kebetulan punya dua tombol
 * "shift" dan dua "alt", tapi usage HID keduanya berbeda (kiri vs kanan)
 * sehingga keduanya tetap tampil sebagai opsi terpisah — itu tetap "satu
 * opsi per usage", bukan pengecualian.
 */
const usageToKey = new Map<number, string>();
for (const k of KEYS) {
  if (!usageToKey.has(k.usage)) usageToKey.set(k.usage, k.name);
}

export const HID_KEY_GROUPS: KeyGroup[] = (Object.keys(KEY_GROUP_LABELS) as KeyGroupId[])
  .map((id) => ({
    id,
    label: KEY_GROUP_LABELS[id],
    keys: [...usageToKey.entries()]
      .filter(([usage]) => classifyUsage(usage) === id)
      .sort(([a], [b]) => a - b)
      .map(([usage, label]) => ({ usage, label })),
  }))
  .filter((g) => g.keys.length > 0);

/** Daftar datar semua opsi tombol biasa, untuk pencarian by-usage. */
export const HID_KEYS: { usage: number; label: string }[] = HID_KEY_GROUPS.flatMap((g) => g.keys);
