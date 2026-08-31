import { describe, expect, test } from 'vitest';
import { MEDIA_ACTIONS, SHORTCUTS, MOUSE_ACTIONS, HID_KEYS, HID_KEY_GROUPS, EXTRA_USAGES } from '../src/gt65/keycodes';
import { encodeEntry } from '../src/gt65/protocol';
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
