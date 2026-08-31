import { describe, expect, test } from 'vitest';
import { KEYS } from '../src/gt65/layout';
import { TABLE_ENTRIES } from '../src/gt65/protocol';
import { FN_USAGE, isRemappable } from '../src/app/KeyboardGrid';

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

/**
 * Fn adalah satu-satunya jalan ke layer Fn, jadi ia satu-satunya tombol yang
 * tidak boleh bisa dipetakan ulang — dan penguncian itu harus mengenai tepat
 * satu tombol, bukan lebih.
 */
describe('tombol yang dikunci', () => {
  test('tepat satu tombol memakai penanda Fn vendor 0xAF', () => {
    expect(KEYS.filter((k) => k.usage === FN_USAGE)).toHaveLength(1);
    expect(KEYS.find((k) => k.usage === FN_USAGE)!.name).toBe('fn');
  });

  test('hanya Fn yang tidak bisa dipetakan ulang', () => {
    const locked = KEYS.filter((k) => !isRemappable(k.usage));
    expect(locked.map((k) => k.name)).toEqual(['fn']);
  });

  test('tombol biasa tetap bisa dipetakan ulang', () => {
    const esc = KEYS.find((k) => k.name === 'esc')!;
    expect(isRemappable(esc.usage)).toBe(true);
  });
});
