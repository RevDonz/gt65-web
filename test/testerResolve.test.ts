import { describe, expect, test } from 'vitest';
import { defaultProfile } from '../src/store/profile';
import { KEYS } from '../src/gt65/layout';
import { keyIndicesForUsage } from '../src/app/testerResolve';

function keyIndexOf(name: string): number {
  return KEYS.find((k) => k.name === name)!.keyIndex;
}

describe('keyIndicesForUsage', () => {
  /**
   * Kasus nyata pengguna: tombol fisik "del" (keyIndex 119, usage pabrik
   * 0x4C) dipetakan ulang ke Home (usage 0x4A). Keyboard fisik mengirim
   * 0x4A saat tombol itu ditekan, dan resolver harus menunjuk balik ke
   * "del" — bukan menyatakannya di luar papan.
   */
  test('del dipetakan ulang ke Home menunjuk balik ke keyIndex 119', () => {
    const p = defaultProfile();
    const del = keyIndexOf('del');
    expect(del).toBe(119);
    p.layers.top[del] = { kind: 'key', mod: 0, usage: 0x4a };

    expect(keyIndicesForUsage(p, 0x4a)).toEqual([119]);
  });

  test('usage yang hanya ada di profil (hasil pemetaan ulang) tetap terselesaikan', () => {
    const p = defaultProfile();
    const esc = keyIndexOf('esc');
    // Petakan Esc ke usage yang bukan bawaan tombol mana pun di papan ini.
    p.layers.top[esc] = { kind: 'key', mod: 0, usage: 0x3a }; // F1
    expect(keyIndicesForUsage(p, 0x3a)).toEqual([esc]);
  });

  test('usage yang hanya ada di layout pabrik tetap terselesaikan lewat fallback', () => {
    const p = defaultProfile();
    const del = keyIndexOf('del');
    // Pindahkan tombol yang tadinya membawa usage pabrik "del" (0x4C) ke
    // fungsi lain, sehingga 0x4C tidak lagi ada di layer utama profil sama
    // sekali — satu-satunya sumber yang tersisa adalah layout pabrik.
    p.layers.top[del] = { kind: 'none' };
    expect(keyIndicesForUsage(p, 0x4c)).toEqual([del]);
  });

  test('usage yang dipetakan ke dua tombol mengembalikan keduanya', () => {
    const p = defaultProfile();
    const esc = keyIndexOf('esc');
    const tab = keyIndexOf('tab');
    p.layers.top[esc] = { kind: 'key', mod: 0, usage: 0x2b }; // Tab
    p.layers.top[tab] = { kind: 'key', mod: 0, usage: 0x2b }; // Tab juga

    const result = keyIndicesForUsage(p, 0x2b);
    expect(result).toHaveLength(2);
    expect(new Set(result)).toEqual(new Set([esc, tab]));
  });

  test('usage tak dikenal (tidak ada di profil maupun layout) menghasilkan larik kosong', () => {
    const p = defaultProfile();
    expect(keyIndicesForUsage(p, 0xff)).toEqual([]);
  });

  test('modifier entri diabaikan saat mencocokkan usage', () => {
    const p = defaultProfile();
    const esc = keyIndexOf('esc');
    p.layers.top[esc] = { kind: 'key', mod: 0x02, usage: 0x06 }; // Shift+C
    expect(keyIndicesForUsage(p, 0x06)).toContain(esc);
  });
});
