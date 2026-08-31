import { describe, expect, test } from 'vitest';
import { cmd, data, chunks, PAYLOAD_LEN } from '../src/gt65/protocol';

describe('primitif paket', () => {
  test('cmd menghasilkan payload 64 byte dengan penanda kelas', () => {
    const p = cmd(0x18);
    expect(p.length).toBe(PAYLOAD_LEN);
    expect(p[0]).toBe(0x04);
    expect(p[1]).toBe(0x18);
    expect(p.slice(2).every((b) => b === 0)).toBe(true);
  });

  test('cmd menempatkan field pada offset payload', () => {
    const p = cmd(0x13, { 8: 1 });
    expect(p[8]).toBe(1);
  });

  test('data tidak memakai penanda kelas dan menutup dengan AA 55', () => {
    const p = data({ 0: 0x01 }, 14);
    expect(p[0]).toBe(0x01);
    expect(p[14]).toBe(0xaa);
    expect(p[15]).toBe(0x55);
  });

  test('data menutup di posisi berbeda untuk blok pengaturan', () => {
    const p = data({ 6: 30 }, 62);
    expect(p[62]).toBe(0xaa);
    expect(p[63]).toBe(0x55);
  });

  test('chunks memecah 576 byte menjadi 9 paket 64 byte', () => {
    const buf = new Uint8Array(576).fill(0x7f);
    const out = chunks(buf);
    expect(out.length).toBe(9);
    expect(out.every((c) => c.length === PAYLOAD_LEN)).toBe(true);
    expect(out[8][63]).toBe(0x7f);
  });
});
