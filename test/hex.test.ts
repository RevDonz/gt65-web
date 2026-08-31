import { describe, expect, test } from 'vitest';
import { formatHex, hexLine } from '../src/app/hex';

describe('pemformat hex', () => {
  test('menampilkan nomor paket dan empat baris per paket', () => {
    const p = new Uint8Array(64);
    p[0] = 0x04; p[1] = 0x18;
    const s = formatHex([p]);
    expect(s).toContain('paket 1/1');
    expect(s).toContain('00: 04 18 00');
    expect(s.split('\n').filter((l) => l.includes(':')).length).toBe(4);
  });
});

describe('hexLine', () => {
  test('menggabungkan byte jadi satu baris hex dipisah spasi', () => {
    expect(hexLine(new Uint8Array([0x04, 0x18, 0xff]))).toBe('04 18 ff');
  });

  test('larik kosong menghasilkan string kosong', () => {
    expect(hexLine(new Uint8Array([]))).toBe('');
  });
});
