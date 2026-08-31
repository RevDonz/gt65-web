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
