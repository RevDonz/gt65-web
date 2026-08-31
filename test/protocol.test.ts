import { describe, expect, test } from 'vitest';
import { cmd, data, chunks, PAYLOAD_LEN } from '../src/gt65/protocol';
import { lighting, settings } from '../src/gt65/protocol';
import { encodeEntry, buildTable, remap, TABLE_BYTES, TABLE_ENTRIES } from '../src/gt65/protocol';
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

  /**
   * Isi buffer harus posisional. Buffer seragam (mis. semuanya 0x7f) tidak
   * bisa membedakan potongan yang tertukar urutannya atau tergeser satu
   * byte — persis kegagalan yang paling mungkin terjadi di sini.
   */
  test('chunks memecah 576 byte menjadi 9 paket 64 byte berurutan', () => {
    const buf = new Uint8Array(TABLE_BYTES).map((_, i) => i & 0xff);
    const out = chunks(buf);
    expect(out.length).toBe(TABLE_BYTES / PAYLOAD_LEN);
    expect(out.every((c) => c.length === PAYLOAD_LEN)).toBe(true);
    out.forEach((c, n) => {
      const start = n * PAYLOAD_LEN;
      expect(c[0]).toBe(buf[start]);
      expect(c[PAYLOAD_LEN - 1]).toBe(buf[start + PAYLOAD_LEN - 1]);
    });
  });

  test('chunks mempertahankan seluruh isi buffer tanpa celah', () => {
    const buf = new Uint8Array(TABLE_BYTES).map((_, i) => i & 0xff);
    const flat = Uint8Array.from(chunks(buf).flatMap((c) => [...c]));
    expect([...flat]).toEqual([...buf]);
  });
});

describe('transaksi pencahayaan', () => {
  /**
   * Tiap field bernilai berbeda dan bukan nol. Payload diinisialisasi nol,
   * jadi fixture dengan `b: 0` atau `direction: 0` lolos bahkan kalau field
   * itu tidak pernah ditulis sama sekali.
   */
  const cfg = { mode: 0x07, r: 0x11, g: 0x22, b: 0x33,
                speed: 3, brightness: 2, direction: 4 };

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
    expect(d[0]).toBe(0x07);
    expect([d[1], d[2], d[3]]).toEqual([0x11, 0x22, 0x33]);
    expect(d[14]).toBe(0xaa);
    expect(d[15]).toBe(0x55);
  });

  test('speed dan brightness dinaikkan satu, arah tidak', () => {
    const d = lighting(cfg)[2];
    expect(d[9]).toBe(4);
    expect(d[10]).toBe(3);
    expect(d[11]).toBe(4);
  });

  test('offset yang tidak dipakai tetap nol', () => {
    const d = lighting(cfg)[2];
    expect([d[4], d[5], d[6], d[7], d[8]]).toEqual([0, 0, 0, 0, 0]);
    expect([d[12], d[13]]).toEqual([0, 0]);
    expect([...d.subarray(16)].every((b) => b === 0)).toBe(true);
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

/**
 * Transaksi terbesar dan paling berisiko: 576 byte tabel yang harus mendarat
 * di paket yang tepat, pada offset yang tepat, dalam urutan yang tepat.
 * Menguji `buildTable()` saja tidak cukup — yang dikirim ke keyboard adalah
 * keluaran `remap()`, dan keyboard tidak bisa dibaca balik untuk memeriksa
 * hasilnya. Semua indeks di bawah dihitung dari konstanta protokol, bukan
 * ditulis sebagai angka tebakan.
 */
describe('remap: posisi byte di paket yang benar-benar dikirim', () => {
  const ENTRY_BYTES = TABLE_BYTES / TABLE_ENTRIES;         // 4
  const CHUNK_COUNT = TABLE_BYTES / PAYLOAD_LEN;           // 9
  const PROLOGUE = 2;   // cmd(0x18) + selektor layer — ditegaskan di bawah
  const EPILOGUE = 2;   // cmd(0x02) + cmd(0xF0)      — ditegaskan di bawah

  /** Offset tabel -> (indeks paket dalam transaksi, offset byte di paket). */
  const at = (tableOffset: number) => ({
    packet: PROLOGUE + Math.floor(tableOffset / PAYLOAD_LEN),
    byte: tableOffset % PAYLOAD_LEN,
  });

  /** Tiap slot bernilai unik, supaya potongan yang tertukar terlihat. */
  const distinctEntries = (): Entry[] =>
    Array.from({ length: TABLE_ENTRIES }, (_, i) =>
      ({ kind: 'key', mod: i & 0xff, usage: (i * 7) & 0xff }) as Entry);

  test('bingkai transaksi persis prolog + 9 potongan + epilog', () => {
    const p = remap('top', distinctEntries());
    expect(p.length).toBe(PROLOGUE + CHUNK_COUNT + EPILOGUE);
    expect([p[0][0], p[0][1]]).toEqual([0x04, 0x18]);
    expect([p[1][0], p[1][1]]).toEqual([0x04, 0x11]);
    expect([p[p.length - 2][0], p[p.length - 2][1]]).toEqual([0x04, 0x02]);
    expect([p[p.length - 1][0], p[p.length - 1][1]]).toEqual([0x04, 0xf0]);
  });

  test('paket 3 sampai 11 memuat tabel utuh dan berurutan', () => {
    const entries = distinctEntries();
    const p = remap('top', entries);
    const sent = Uint8Array.from(
      p.slice(PROLOGUE, PROLOGUE + CHUNK_COUNT).flatMap((c) => [...c]));
    expect(sent.length).toBe(TABLE_BYTES);
    expect([...sent]).toEqual([...buildTable(entries)]);
  });

  test('penanda AA 55 mendarat di dua byte terakhir paket potongan terakhir', () => {
    const p = remap('top', distinctEntries());
    const hi = at(TABLE_BYTES - 2);
    const lo = at(TABLE_BYTES - 1);
    expect(hi).toEqual({ packet: 10, byte: 62 });
    expect(lo).toEqual({ packet: 10, byte: 63 });
    expect(p[hi.packet][hi.byte]).toBe(0xaa);
    expect(p[lo.packet][lo.byte]).toBe(0x55);
  });

  test('entri key_index 66 mendarat di offset paket yang benar', () => {
    const KEY = 66;
    const entries: Entry[] = new Array(TABLE_ENTRIES).fill({ kind: 'none' });
    entries[KEY] = { kind: 'key', mod: 0x02, usage: 0x34 };
    const p = remap('top', entries);

    const base = KEY * ENTRY_BYTES;                        // offset tabel 264
    expect(base).toBe(264);
    const slot = at(base);
    expect(slot).toEqual({ packet: 6, byte: 8 });

    expect([
      p[slot.packet][slot.byte],
      p[slot.packet][slot.byte + 1],
      p[slot.packet][slot.byte + 2],
      p[slot.packet][slot.byte + 3],
    ]).toEqual([0x02, 0x02, 0x34, 0x00]);

    // dan tidak bocor ke slot tetangga di paket yang sama
    expect(p[slot.packet][slot.byte - 1]).toBe(0);
    expect(p[slot.packet][slot.byte + 4]).toBe(0);
  });

  test('layer Fn memakai jalur byte yang sama, hanya selektornya berbeda', () => {
    const entries = distinctEntries();
    const top = remap('top', entries);
    const fn = remap('fn', entries);
    for (let i = PROLOGUE; i < PROLOGUE + CHUNK_COUNT; i++) {
      expect([...fn[i]]).toEqual([...top[i]]);
    }
    expect(fn[1][1]).toBe(0x27);
    expect(top[1][1]).toBe(0x11);
  });
});
