import { describe, expect, test } from 'vitest';
import { keySelectValue, parseKeyChoice } from '../src/app/panels/RemapPanel';
import { encodeEntry } from '../src/gt65/protocol';
import type { Entry } from '../src/gt65/protocol';

/**
 * Dropdown tombol adalah satu-satunya kontrol remap yang punya state DOM
 * sendiri, jadi ia satu-satunya yang bisa menampilkan sesuatu yang berbeda
 * dari apa yang ditulis ke keyboard. Karena keyboard tidak bisa dibaca
 * balik, selisih itu tidak akan pernah terlihat di perangkat.
 */
describe('nilai dropdown tombol', () => {
  test('menampilkan usage entri tombol biasa', () => {
    expect(keySelectValue({ kind: 'key', mod: 0, usage: 0x04 })).toBe('4');
  });

  test('kosong kalau belum ada entri', () => {
    expect(keySelectValue(undefined)).toBe('');
  });

  test('kosong untuk slot yang dinonaktifkan', () => {
    expect(keySelectValue({ kind: 'none' })).toBe('');
  });

  test('kosong untuk shortcut ber-modifier — dropdown tak punya opsinya', () => {
    expect(keySelectValue({ kind: 'key', mod: 0x08, usage: 0x07 })).toBe('');
  });

  test('kosong untuk multimedia dan mouse', () => {
    expect(keySelectValue({ kind: 'media', usage: 0xcd })).toBe('');
    expect(keySelectValue({ kind: 'mouse', ev: 1, val: 0x01 })).toBe('');
  });

  test('kosong untuk usage yang tidak ada di daftar dropdown', () => {
    expect(keySelectValue({ kind: 'key', mod: 0, usage: 0xff })).toBe('');
  });

  /**
   * Inti bug: dua tombol berbeda dengan binding sama harus menghasilkan
   * nilai yang sama, dan binding berbeda harus menghasilkan nilai berbeda,
   * supaya `change` betul-betul menyala saat pilihan berpindah tombol.
   */
  test('dua tombol dengan binding sama memberi nilai select yang sama', () => {
    const a: Entry = { kind: 'key', mod: 0, usage: 0x04 };
    expect(keySelectValue(a)).toBe(keySelectValue({ ...a }));
    expect(keySelectValue(a)).not.toBe(
      keySelectValue({ kind: 'key', mod: 0, usage: 0x05 }));
  });
});

describe('pilihan dropdown tombol', () => {
  test('menerima usage yang sah', () => {
    expect(parseKeyChoice('4')).toBe(4);
    expect(parseKeyChoice('82')).toBe(82);
  });

  test('menolak plakat "— pilih —" yang lama bernilai NaN', () => {
    expect(parseKeyChoice('— pilih —')).toBeNull();
  });

  test('menolak nilai kosong yang lama bernilai 0', () => {
    expect(parseKeyChoice('')).toBeNull();
  });

  test('menolak pecahan dan teks lain', () => {
    expect(parseKeyChoice('4.5')).toBeNull();
    expect(parseKeyChoice('abc')).toBeNull();
  });

  /**
   * Kalau plakat lolos, `encodeEntry` menulis tag 0x02 dengan usage 0x00 —
   * tombol keyboard yang tidak melakukan apa-apa, bukan slot `none`.
   */
  test('plakat yang lolos akan menulis tag tombol dengan usage nol', () => {
    expect(encodeEntry({ kind: 'key', mod: 0, usage: Number('— pilih —') }))
      .toEqual([0x02, 0, 0, 0]);
    expect(encodeEntry({ kind: 'none' })).toEqual([0, 0, 0, 0]);
  });
});
