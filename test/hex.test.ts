import { describe, expect, test } from 'vitest';
import { formatHex } from '../src/app/hex';

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
