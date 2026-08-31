import { describe, expect, test } from 'vitest';
import { FN_USAGE_FROM_CODE, knownCodes, reachableUsages, usageForCode } from '../src/gt65/keyevents';
import { KEYS } from '../src/gt65/layout';
import { EXTRA_USAGES } from '../src/gt65/keycodes';
import { FN_USAGE } from '../src/app/KeyboardGrid';

describe('usageForCode', () => {
  test('memetakan contoh dari tiap blok papan ketik', () => {
    const want: Record<string, number> = {
      KeyA: 0x04, Digit1: 0x1e, Semicolon: 0x33, Backslash: 0x31,
      ArrowUp: 0x52, F1: 0x3a, Escape: 0x29, Space: 0x2c,
      ShiftLeft: 0xe1, ShiftRight: 0xe5, MetaLeft: 0xe3, AltRight: 0xe6,
    };
    for (const [code, usage] of Object.entries(want)) {
      expect(`${code}=${usageForCode(code)}`).toBe(`${code}=${usage}`);
    }
  });

  test('kode tak dikenal menghasilkan null, bukan tebakan', () => {
    expect(usageForCode('KeyTidakAda')).toBeNull();
    expect(usageForCode('')).toBeNull();
  });

  /**
   * Tabel disimpan sebagai `Map`, bukan objek biasa. Kalau suatu saat
   * diganti objek literal, lookup anggota prototipe akan bocor sebagai
   * "usage" — dan di Tester itu tampil sebagai tombol yang seolah
   * terdeteksi padahal tidak pernah ditekan.
   */
  test('nama anggota prototipe tidak bocor jadi usage', () => {
    expect(usageForCode('constructor')).toBeNull();
    expect(usageForCode('__proto__')).toBeNull();
    expect(usageForCode('toString')).toBeNull();
  });

  test('semua usage berada dalam satu byte', () => {
    for (const code of knownCodes()) {
      const usage = usageForCode(code)!;
      expect(Number.isInteger(usage)).toBe(true);
      expect(usage).toBeGreaterThanOrEqual(0);
      expect(usage).toBeLessThanOrEqual(0xff);
    }
  });
});

/**
 * Tester hanya berguna kalau setiap tombol fisik papan ini bisa dinyalakan
 * oleh sebuah event DOM. Satu tombol yang tak terjangkau berarti pengguna
 * menyapu seluruh papan dan menyimpulkan tombol itu rusak, padahal yang
 * hilang cuma satu baris di tabel pemetaan. Karena itu tesnya MENYEBUT
 * tombol mana yang tak terjangkau, bukan sekadar gagal dengan
 * `expect(true).toBe(false)`.
 */
describe('jangkauan terhadap layout', () => {
  test('setiap tombol fisik terjangkau minimal satu code', () => {
    const reachable = reachableUsages();
    const missing = KEYS
      .filter((k) => !reachable.has(k.usage))
      .map((k) => `${k.name} (usage 0x${k.usage.toString(16)})`);
    expect(missing).toEqual([]);
  });

  test('usage tambahan di keycodes.ts juga terjangkau', () => {
    const reachable = reachableUsages();
    const missing = EXTRA_USAGES
      .filter((e) => !reachable.has(e.usage))
      .map((e) => `${e.label} (usage 0x${e.usage.toString(16)})`);
    expect(missing).toEqual([]);
  });

  /**
   * `keyevents.ts` sengaja tidak mengimpor apa pun (termasuk `FN_USAGE`
   * dari `app/`) supaya tetap murni; tes ini yang menjaga kedua salinan
   * nilai itu tidak pernah berselisih.
   */
  test('penanda Fn sama dengan yang dipakai KeyboardGrid', () => {
    expect(FN_USAGE_FROM_CODE).toBe(FN_USAGE);
    expect(usageForCode('Fn')).toBe(FN_USAGE);
  });
});
