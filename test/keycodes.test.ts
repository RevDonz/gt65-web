import { describe, expect, test } from 'vitest';
import {
  MEDIA_ACTIONS, SHORTCUTS, MOUSE_ACTIONS, HID_KEYS, HID_KEY_GROUPS, EXTRA_USAGES,
  entryLabel, entriesEqual,
} from '../src/gt65/keycodes';
import { encodeEntry } from '../src/gt65/protocol';
import type { Entry } from '../src/gt65/protocol';
import { KEYS } from '../src/gt65/layout';

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

/**
 * Bug nyata di hardware: pengguna memetakan ulang tombol titik-koma (;)
 * menjadi "A", lalu tidak bisa mengembalikannya karena dropdown pemilih
 * tombol tidak memuat titik-koma. Pemilih HANYA memuat subset tulisan
 * tangan (huruf, angka, beberapa kontrol) — bukan ke-66 tombol fisik
 * sungguhan yang sudah dijelaskan `layout.ts`. Pada keyboard yang tidak
 * bisa dibaca balik dan tanpa perintah reset pabrik, itu pintu satu arah:
 * satu-satunya jalan keluar adalah cadangan profil yang mungkin tidak
 * pernah dibuat pengguna.
 *
 * Tes ini adalah jaminannya: setiap usage yang ADA di keyboard sungguhan
 * harus BISA dipilih lagi lewat dropdown, apa pun bentuk pengelompokannya.
 */
describe('pemilih tombol memuat seluruh tombol fisik keyboard', () => {
  test('setiap usage di layout.ts tersedia di HID_KEYS', () => {
    const offered = new Set(HID_KEYS.map((k) => k.usage));
    const missing = KEYS.filter((k) => !offered.has(k.usage));
    expect(missing.map((k) => `${k.name} (0x${k.usage.toString(16)})`)).toEqual([]);
  });

  test('tombol titik-koma (;) yang memicu bug asli kini tersedia', () => {
    const semicolon = KEYS.find((k) => k.name === ';')!;
    const opt = HID_KEYS.find((k) => k.usage === semicolon.usage);
    expect(opt?.label).toBe(';');
  });

  test('label opsi memakai field name dari layout.ts, bukan terjemahan', () => {
    for (const k of KEYS) {
      const opt = HID_KEYS.find((o) => o.usage === k.usage)!;
      expect(opt.label).toBe(k.name);
    }
  });

  test('tidak ada usage duplikat di HID_KEYS', () => {
    const usages = HID_KEYS.map((k) => k.usage);
    expect(new Set(usages).size).toBe(usages.length);
  });

  test('dua tombol shift dan dua tombol alt tetap tampil sebagai opsi terpisah', () => {
    expect(HID_KEYS.filter((k) => k.label === 'shift')).toHaveLength(2);
    expect(HID_KEYS.filter((k) => k.label === 'alt')).toHaveLength(2);
  });

  test('setiap grup optgroup tidak kosong dan gabungannya sama dengan HID_KEYS', () => {
    for (const g of HID_KEY_GROUPS) {
      expect(g.keys.length).toBeGreaterThan(0);
    }
    expect(HID_KEY_GROUPS.flatMap((g) => g.keys)).toEqual(HID_KEYS);
  });
});

/**
 * Regresi kedua: menurunkan `HID_KEYS` murni dari `layout.ts` (fix di atas)
 * menghapus F1–F12 dan Insert/Home/End/PrtSc/Scroll Lock/Pause dari
 * pemilih, padahal semuanya fungsi nyata di papan ini lewat kombinasi Fn
 * menurut manual vendor. Pengguna yang ingin memetakan tombol langsung ke
 * F5 tidak bisa lagi melakukannya. Tiga tes berikut — usage layout.ts
 * tersedia (di atas), usage EXTRA_USAGES tersedia, dan tidak ada usage
 * dobel — bersama menjaga dari kedua regresi: yang lama (usage fisik
 * hilang) maupun yang baru (usage tanpa tombol fisik hilang).
 */
describe('pemilih tombol juga menawarkan usage tanpa tombol fisik (F1-F12, Insert/Home/End, dst.)', () => {
  test('setiap usage di EXTRA_USAGES tersedia di HID_KEYS', () => {
    const offered = new Map(HID_KEYS.map((k) => [k.usage, k.label]));
    const missing = EXTRA_USAGES.filter((e) => !offered.has(e.usage));
    expect(missing.map((e) => `${e.label} (0x${e.usage.toString(16)})`)).toEqual([]);
  });

  test('tidak ada usage yang tampil dua kali di seluruh pemilih', () => {
    const allSourceUsages = [...KEYS.map((k) => k.usage), ...EXTRA_USAGES.map((e) => e.usage)];
    const distinctSourceCount = new Set(allSourceUsages).size;
    const hidKeyUsages = HID_KEYS.map((k) => k.usage);
    expect(new Set(hidKeyUsages).size).toBe(hidKeyUsages.length);
    expect(HID_KEYS.length).toBe(distinctSourceCount);
  });
});

/**
 * `entryLabel` adalah legenda utama keycap di tab Remap — apa yang SEKARANG
 * dilakukan tombol, dalam bentuk sesingkat mungkin. Diuji lintas SEMUA
 * jenis Entry (termasuk 'none' dan 'macro') dan dipastikan tidak pernah
 * jatuh ke hex mentah, sesuai janji doc comment-nya.
 */
describe('entryLabel — legenda utama keycap', () => {
  test('none → "Nonaktif"', () => {
    expect(entryLabel({ kind: 'none' })).toBe('Nonaktif');
  });

  test('tombol biasa memakai label dari katalog pemilih (HID_KEYS)', () => {
    const semicolon = KEYS.find((k) => k.name === ';')!;
    expect(entryLabel({ kind: 'key', mod: 0, usage: semicolon.usage })).toBe(';');
    const a = KEYS.find((k) => k.name === 'A')!;
    expect(entryLabel({ kind: 'key', mod: 0, usage: a.usage })).toBe('A');
  });

  /**
   * Skenario tepat yang diminta: titik-koma dipetakan ulang menjadi "A" —
   * kepala tombol harus terbaca "A", bukan ";" dan bukan hex usage-nya.
   */
  test('tombol yang dipetakan ulang membaca hasilnya, bukan tombol fisiknya', () => {
    const a = KEYS.find((k) => k.name === 'A')!;
    expect(entryLabel({ kind: 'key', mod: 0, usage: a.usage })).toBe('A');
  });

  test('shortcut ber-modifier digabung ringkas dari MOD_NAMES + HID_KEYS', () => {
    const winD = SHORTCUTS.find((s) => s.id === 'show_desktop')!.entry as
      { kind: 'key'; mod: number; usage: number };
    expect(entryLabel(winD)).toBe('Win+D');
    const ctrlC = SHORTCUTS.find((s) => s.id === 'copy')!.entry as
      { kind: 'key'; mod: number; usage: number };
    expect(entryLabel(ctrlC)).toBe('Ctrl+C');
  });

  test('multimedia memakai bentuk singkat kalau ada, label penuh kalau tidak', () => {
    expect(entryLabel({ kind: 'media', usage: 0xcd })).toBe('Play');   // play_pause
    expect(entryLabel({ kind: 'media', usage: 0xe9 })).toBe('Vol+');   // vol_up
    expect(entryLabel({ kind: 'media', usage: 0xe2 })).toBe('Bisu');   // mute
    expect(entryLabel({ kind: 'media', usage: 0xb7 })).toBe('Stop');   // tanpa short, jatuh ke label
  });

  test('mouse memakai bentuk singkat kalau ada, label penuh kalau tidak', () => {
    expect(entryLabel({ kind: 'mouse', ev: 1, val: 0x01 })).toBe('Klik kiri');
    expect(entryLabel({ kind: 'mouse', ev: 3, val: 0x01 })).toBe('Scroll ↑'); // scroll_up
  });

  test('macro → "Makro <slot>"', () => {
    expect(entryLabel({ kind: 'macro', slot: 3, mode: 0, repeat: 0 })).toBe('Makro 3');
  });

  test('tidak pernah menampilkan hex mentah, untuk entri apa pun di seluruh katalog', () => {
    const all: Entry[] = [
      { kind: 'none' },
      { kind: 'macro', slot: 99, mode: 1, repeat: 2 },
      ...KEYS.map((k): Entry => ({ kind: 'key', mod: 0, usage: k.usage })),
      ...SHORTCUTS.map((s) => s.entry),
      ...MEDIA_ACTIONS.map((a) => a.entry),
      ...MOUSE_ACTIONS.map((a) => a.entry),
      // Usage yang tidak dikenal katalog mana pun — harus tetap jatuh ke
      // plakat non-hex, bukan "0x.." mentah.
      { kind: 'key', mod: 0, usage: 0xff },
      { kind: 'media', usage: 0xff },
      { kind: 'mouse', ev: 1, val: 0xff },
    ];
    for (const e of all) {
      expect(entryLabel(e)).not.toMatch(/0x/i);
    }
  });
});

describe('entriesEqual', () => {
  test('sama kalau kind dan seluruh field kunci sama', () => {
    expect(entriesEqual({ kind: 'none' }, { kind: 'none' })).toBe(true);
    expect(entriesEqual(
      { kind: 'key', mod: 0, usage: 4 }, { kind: 'key', mod: 0, usage: 4 })).toBe(true);
    expect(entriesEqual(
      { kind: 'macro', slot: 1, mode: 2, repeat: 3 },
      { kind: 'macro', slot: 1, mode: 2, repeat: 3 })).toBe(true);
  });

  test('beda kalau kind beda atau salah satu field kunci beda', () => {
    expect(entriesEqual({ kind: 'none' }, { kind: 'key', mod: 0, usage: 4 })).toBe(false);
    expect(entriesEqual(
      { kind: 'key', mod: 0, usage: 4 }, { kind: 'key', mod: 0, usage: 5 })).toBe(false);
    expect(entriesEqual(
      { kind: 'mouse', ev: 1, val: 1 }, { kind: 'mouse', ev: 3, val: 1 })).toBe(false);
  });
});
