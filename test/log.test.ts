import { describe, expect, test } from 'vitest';
import {
  bytesEqual, makeReadbackList, makeLogEntry, pushLogEntry, formatLogText,
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

describe('makeReadbackList', () => {
  test('paket perintah mendapat status dari payload[3] balikan', () => {
    const sent = new Uint8Array(64);
    sent[0] = 0x04; // CLASS
    const got = new Uint8Array(64);
    got[3] = 1;
    const list = makeReadbackList([sent], [got]);
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe(1);
    expect(list[0].hex.length).toBeGreaterThan(0);
  });

  test('paket data tidak pernah dibaca sebagai status (status null)', () => {
    const sent = new Uint8Array(64); // payload[0] !== 0x04
    const got = new Uint8Array(64);
    got[3] = 0x42; // mis. kanal biru pada paket pencahayaan
    const list = makeReadbackList([sent], [got]);
    expect(list[0].status).toBeNull();
  });

  test('balikan kosong (pembacaan gagal) menghasilkan hex kosong dan status null', () => {
    const sent = new Uint8Array(64);
    sent[0] = 0x04;
    const list = makeReadbackList([sent], [new Uint8Array(0)]);
    expect(list[0].hex).toBe('');
    expect(list[0].status).toBeNull();
  });

  test('hanya memasukkan paket yang sempat punya balikan', () => {
    const sent = [new Uint8Array(64), new Uint8Array(64)];
    const got = [new Uint8Array(64)]; // transaksi berhenti sebelum paket kedua
    expect(makeReadbackList(sent, got)).toHaveLength(1);
  });
});

describe('makeLogEntry', () => {
  test('merangkum paket, keputusan, dan balikan jadi satu entri', () => {
    const entry = makeLogEntry({
      at: '2026-08-31T00:00:00.000Z',
      label: 'Terapkan pencahayaan',
      decision: 'send',
      packets: [new Uint8Array(64)],
      connected: true,
      outcome: 'ok',
      readbacks: [{ hex: '00 00', status: 1 }],
    });
    expect(entry.packetCount).toBe(1);
    expect(entry.connected).toBe(true);
    expect(entry.decision).toBe('send');
    expect(entry.packetsHex).toContain('paket 1/1');
    expect(entry.readbacks).toEqual([{ hex: '00 00', status: 1 }]);
  });

  test('larik balikan kosong ketika tidak dicoba (mis. mode kering)', () => {
    const entry = makeLogEntry({
      at: '2026-08-31T00:00:00.000Z',
      label: 'Terapkan pengaturan',
      decision: 'dry',
      packets: [new Uint8Array(64)],
      connected: false,
      outcome: 'ok',
      readbacks: [],
    });
    expect(entry.readbacks).toEqual([]);
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
    readbacks: [],
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
        readbacks: [{ hex: '01 02 03', status: 1 }],
      },
      {
        at: '2026-08-31T00:01:00.000Z',
        label: 'Terapkan pengaturan',
        decision: 'nodevice',
        packetCount: 1,
        connected: false,
        packetsHex: 'paket 1/1\n  00: 04 05 06',
        outcome: 'Belum tersambung ke keyboard.',
        readbacks: [],
      },
    ];

    const text = formatLogText(entries, { dryRun: false, productName: 'GT65 Keyboard' });

    expect(text).not.toContain('{');
    expect(text).toContain('Mode kering: nonaktif');
    expect(text).toContain('Perangkat: GT65 Keyboard');
    expect(text).toContain('Jumlah entri: 2');
    expect(text).toContain('Total paket: 2');
    expect(text).toContain('Terapkan pencahayaan');
    expect(text).toContain('status 1');
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
