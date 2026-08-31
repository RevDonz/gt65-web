import { describe, expect, test } from 'vitest';
import {
  bytesEqual, makeEchoResult, makeLogEntry, pushLogEntry, formatLogText,
} from '../src/app/log';
import type { LogEntry } from '../src/app/log';

describe('bytesEqual', () => {
  test('larik identik dianggap sama', () => {
    expect(bytesEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
  });

  test('isi beda dianggap tak sama', () => {
    expect(bytesEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
  });

  test('panjang beda dianggap tak sama tanpa melempar error', () => {
    expect(bytesEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))).toBe(false);
  });
});

describe('makeEchoResult', () => {
  test('cocok ketika echo sama dengan paket terakhir', () => {
    const packet = new Uint8Array([1, 2, 3]);
    const r = makeEchoResult(new Uint8Array([1, 2, 3]), packet);
    expect(r).toEqual({ ok: true, hex: '01 02 03', matched: true });
  });

  test('tak cocok ketika echo beda dari paket terakhir', () => {
    const r = makeEchoResult(new Uint8Array([9, 9, 9]), new Uint8Array([1, 2, 3]));
    expect(r.ok).toBe(true);
    expect(r).toMatchObject({ matched: false });
  });

  test('tak cocok ketika tidak ada paket terakhir (larik kosong)', () => {
    const r = makeEchoResult(new Uint8Array([1, 2, 3]), undefined);
    expect(r).toMatchObject({ matched: false });
  });
});

describe('makeLogEntry', () => {
  test('merangkum paket, keputusan, dan echo jadi satu entri', () => {
    const entry = makeLogEntry({
      at: '2026-08-31T00:00:00.000Z',
      label: 'Terapkan pencahayaan',
      decision: 'send',
      packets: [new Uint8Array(64)],
      connected: true,
      outcome: 'ok',
      echo: { ok: true, hex: '00 00', matched: true },
    });
    expect(entry.packetCount).toBe(1);
    expect(entry.connected).toBe(true);
    expect(entry.decision).toBe('send');
    expect(entry.packetsHex).toContain('paket 1/1');
    expect(entry.echo).toEqual({ ok: true, hex: '00 00', matched: true });
  });

  test('echo null ketika tidak dicoba (mis. mode kering)', () => {
    const entry = makeLogEntry({
      at: '2026-08-31T00:00:00.000Z',
      label: 'Terapkan pengaturan',
      decision: 'dry',
      packets: [new Uint8Array(64)],
      connected: false,
      outcome: 'ok',
      echo: null,
    });
    expect(entry.echo).toBeNull();
  });
});

describe('pushLogEntry', () => {
  const mk = (label: string): LogEntry => ({
    at: '2026-08-31T00:00:00.000Z',
    label,
    decision: 'dry',
    packetCount: 1,
    connected: false,
    packetsHex: '',
    outcome: 'ok',
    echo: null,
  });

  test('entri baru ditaruh di depan (terbaru dulu)', () => {
    const log = pushLogEntry([mk('lama')], mk('baru'));
    expect(log.map((e) => e.label)).toEqual(['baru', 'lama']);
  });

  test('membatasi panjang log sesuai cap', () => {
    let log: LogEntry[] = [];
    for (let i = 0; i < 5; i++) {
      log = pushLogEntry(log, mk(`entri-${i}`), 3);
    }
    expect(log).toHaveLength(3);
    expect(log.map((e) => e.label)).toEqual(['entri-4', 'entri-3', 'entri-2']);
  });
});

describe('formatLogText', () => {
  test('menyertakan header dan detail tiap entri sebagai teks polos', () => {
    const entries: LogEntry[] = [
      {
        at: '2026-08-31T00:00:00.000Z',
        label: 'Terapkan pencahayaan',
        decision: 'send',
        packetCount: 1,
        connected: true,
        packetsHex: 'paket 1/1\n  00: 01 02 03',
        outcome: 'ok',
        echo: { ok: true, hex: '01 02 03', matched: true },
      },
      {
        at: '2026-08-31T00:01:00.000Z',
        label: 'Terapkan pengaturan',
        decision: 'nodevice',
        packetCount: 1,
        connected: false,
        packetsHex: 'paket 1/1\n  00: 04 05 06',
        outcome: 'Belum tersambung ke keyboard.',
        echo: null,
      },
    ];

    const text = formatLogText(entries, { dryRun: false, productName: 'GT65 Keyboard' });

    expect(text).not.toContain('{');
    expect(text).toContain('Mode kering: nonaktif');
    expect(text).toContain('Perangkat: GT65 Keyboard');
    expect(text).toContain('Jumlah entri: 2');
    expect(text).toContain('Total paket: 2');
    expect(text).toContain('Terapkan pencahayaan');
    expect(text).toContain('COCOK');
    expect(text).toContain('Terapkan pengaturan');
    expect(text).toContain('tidak dicoba');
    expect(text).toContain('Belum tersambung ke keyboard.');
  });

  test('menampilkan "tidak tersambung" ketika tidak ada perangkat', () => {
    const text = formatLogText([], { dryRun: true, productName: null });
    expect(text).toContain('Mode kering: aktif');
    expect(text).toContain('Perangkat: tidak tersambung');
    expect(text).toContain('Jumlah entri: 0');
  });
});
