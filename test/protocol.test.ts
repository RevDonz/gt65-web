import { describe, expect, test } from 'vitest';
import { cmd, data, chunks, PAYLOAD_LEN } from '../src/gt65/protocol';
import { lighting, settings } from '../src/gt65/protocol';
import { encodeEntry, buildTable, remap, TABLE_BYTES } from '../src/gt65/protocol';
import type { Entry } from '../src/gt65/protocol';

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

describe('transaksi pencahayaan', () => {
  const cfg = { mode: 1, r: 0xff, g: 0x40, b: 0x00,
                speed: 3, brightness: 4, direction: 0 };

  test('menghasilkan lima paket dengan urutan benar', () => {
    const p = lighting(cfg);
    expect(p.length).toBe(5);
    expect([p[0][0], p[0][1]]).toEqual([0x04, 0x18]);
    expect([p[1][0], p[1][1]]).toEqual([0x04, 0x13]);
    expect(p[1][8]).toBe(1);
    expect([p[3][0], p[3][1]]).toEqual([0x04, 0x02]);
    expect([p[4][0], p[4][1]]).toEqual([0x04, 0xf0]);
  });

  test('paket data memuat mode, RGB, dan penanda di byte 14-15', () => {
    const d = lighting(cfg)[2];
    expect(d[0]).toBe(1);
    expect([d[1], d[2], d[3]]).toEqual([0xff, 0x40, 0x00]);
    expect(d[14]).toBe(0xaa);
    expect(d[15]).toBe(0x55);
  });

  test('speed dan brightness dinaikkan satu', () => {
    const d = lighting(cfg)[2];
    expect(d[9]).toBe(4);
    expect(d[10]).toBe(5);
  });
});

describe('transaksi pengaturan', () => {
  const cfg = { flags: [true, false, true, false, true] as
                  [boolean, boolean, boolean, boolean, boolean],
                sleepTimeout: 30 };

  test('menghasilkan empat paket tanpa finalisasi', () => {
    const p = settings(cfg);
    expect(p.length).toBe(4);
    expect([p[0][0], p[0][1]]).toEqual([0x04, 0x18]);
    expect([p[1][0], p[1][1]]).toEqual([0x04, 0x17]);
    expect(p[1][8]).toBe(1);
    expect([p[3][0], p[3][1]]).toEqual([0x04, 0x02]);
  });

  test('flag dipetakan ke byte 1..5 dan timeout ke byte 6', () => {
    const d = settings(cfg)[2];
    expect([d[1], d[2], d[3], d[4], d[5]]).toEqual([1, 0, 1, 0, 1]);
    expect(d[6]).toBe(30);
    expect(d[62]).toBe(0xaa);
    expect(d[63]).toBe(0x55);
  });
});

describe('encoding entri tombol', () => {
  test('none menghasilkan entri nol', () => {
    expect(encodeEntry({ kind: 'none' })).toEqual([0, 0, 0, 0]);
  });

  test('tombol keyboard menyimpan modifier dan usage', () => {
    expect(encodeEntry({ kind: 'key', mod: 0x00, usage: 0x04 }))
      .toEqual([0x02, 0x00, 0x04, 0]);
  });

  test('Win+D ter-encode sesuai preset vendor', () => {
    expect(encodeEntry({ kind: 'key', mod: 0x08, usage: 0x07 }))
      .toEqual([0x02, 0x08, 0x07, 0]);
  });

  test('multimedia menyimpan consumer usage di byte 1', () => {
    expect(encodeEntry({ kind: 'media', usage: 0xcd }))
      .toEqual([0x03, 0xcd, 0, 0]);
  });

  test('fungsi mouse menyimpan jenis kejadian dan nilai', () => {
    expect(encodeEntry({ kind: 'mouse', ev: 1, val: 0x01 }))
      .toEqual([0x01, 1, 0x01, 0]);
    expect(encodeEntry({ kind: 'mouse', ev: 3, val: 0xff }))
      .toEqual([0x01, 3, 0xff, 0]);
  });
});

describe('tabel remap', () => {
  test('berukuran 576 byte dan ditutup AA 55', () => {
    const t = buildTable([]);
    expect(t.length).toBe(TABLE_BYTES);
    expect(t[574]).toBe(0xaa);
    expect(t[575]).toBe(0x55);
  });

  test('entri ditulis pada indeks dikali empat', () => {
    const e: Entry[] = new Array(144).fill({ kind: 'none' });
    e[66] = { kind: 'key', mod: 0x02, usage: 0x34 };
    const t = buildTable(e);
    expect([t[264], t[265], t[266], t[267]]).toEqual([0x02, 0x02, 0x34, 0]);
  });

  test('transaksi remap memakai opcode berbeda per layer', () => {
    const e: Entry[] = new Array(144).fill({ kind: 'none' });
    const top = remap('top', e);
    const fn = remap('fn', e);
    expect(top.length).toBe(13);      // 18, selektor, 9 chunk, 02, F0
    expect([top[1][0], top[1][1]]).toEqual([0x04, 0x11]);
    expect([fn[1][0], fn[1][1]]).toEqual([0x04, 0x27]);
    expect(top[1][8]).toBe(9);
    expect([top[12][0], top[12][1]]).toEqual([0x04, 0xf0]);
  });
});
