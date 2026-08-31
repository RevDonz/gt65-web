import { describe, expect, test, vi } from 'vitest';
import { findConfigInterface, sendTransaction, DeviceError, onVendorInput,
         receiveFeatureEcho, VENDOR_INPUT_REPORT_ID } from '../src/gt65/device';

const withFeature = {
  productName: 'USB DEVICE',
  collections: [{ usagePage: 0x01, usage: 0x06,
                  featureReports: [{ reportId: 0, items: [{ reportSize: 8, reportCount: 64 }] }] }],
} as unknown as HIDDevice;

const noFeature = {
  productName: 'USB DEVICE',
  collections: [{ usagePage: 0x0c, usage: 0x01, inputReports: [{ reportId: 3 }] }],
} as unknown as HIDDevice;

const dongle = {
  productName: 'USB Dongle',
  collections: [{ usagePage: 0xffb5, usage: 0x01,
                  outputReports: [{ reportId: 0xb5 }] }],
} as unknown as HIDDevice;

describe('pemilihan interface', () => {
  test('memilih interface dengan feature report 64 byte', () => {
    expect(findConfigInterface([noFeature, withFeature])).toBe(withFeature);
  });

  test('mengembalikan null bila tidak ada', () => {
    expect(findConfigInterface([noFeature])).toBeNull();
  });

  test('perangkat dongle tidak dianggap kanal konfigurasi', () => {
    expect(findConfigInterface([dongle])).toBeNull();
  });

  test('DeviceError membawa kind untuk dibedakan pemanggil', () => {
    const e = new DeviceError('mode dongle', 'wrongmode');
    expect(e.kind).toBe('wrongmode');
    expect(e).toBeInstanceOf(Error);
  });
});

describe('pengiriman transaksi', () => {
  test('mengirim tiap paket sebagai feature report 0 sepanjang 64 byte', async () => {
    const sendFeatureReport = vi.fn().mockResolvedValue(undefined);
    const dev = { opened: true, sendFeatureReport } as unknown as HIDDevice;
    const packets = [new Uint8Array(64), new Uint8Array(64)];

    await sendTransaction(dev, packets, 0);

    expect(sendFeatureReport).toHaveBeenCalledTimes(2);
    const [reportId, payload] = sendFeatureReport.mock.calls[0];
    expect(reportId).toBe(0);
    expect(payload.length).toBe(64);
  });

  test('menolak paket berukuran salah', async () => {
    const dev = { opened: true, sendFeatureReport: vi.fn() } as unknown as HIDDevice;
    await expect(sendTransaction(dev, [new Uint8Array(65)], 0))
      .rejects.toThrow(/64 byte/);
  });
});

describe('echo feature report', () => {
  test('meneruskan hanya byte milik DataView, bukan seluruh ArrayBuffer', async () => {
    // ArrayBuffer besar dengan padding di depan dan belakang bagian yang
    // sebenarnya jadi DataView — persis pola bug offset/byteLength yang
    // sudah dua kali ditemukan di codebase ini (lihat onVendorInput).
    const buf = new ArrayBuffer(70);
    new Uint8Array(buf).set([9, 9, 9, 9, ...Array(64).fill(0).map((_, i) => i)]);
    const view = new DataView(buf, 4, 64);
    const receiveFeatureReport = vi.fn().mockResolvedValue(view);
    const dev = { receiveFeatureReport } as unknown as HIDDevice;

    const echo = await receiveFeatureEcho(dev);

    expect(receiveFeatureReport).toHaveBeenCalledWith(0);
    expect(echo.length).toBe(64);
    expect(echo[0]).toBe(0);
    expect(echo[63]).toBe(63);
  });
});

describe('input vendor', () => {
  test('meneruskan hanya byte milik DataView, bukan seluruh ArrayBuffer', () => {
    let handler: ((e: HIDInputReportEvent) => void) | undefined;
    const dev = {
      addEventListener: vi.fn((_type: string, h: (e: HIDInputReportEvent) => void) => {
        handler = h;
      }),
      removeEventListener: vi.fn(),
    } as unknown as HIDDevice;

    const received: Uint8Array[] = [];
    onVendorInput(dev, (bytes) => received.push(bytes));
    expect(handler).toBeDefined();

    // ArrayBuffer besar; laporan yang sebenarnya cuma sepotong di tengahnya,
    // dibungkus offset & panjang non-nol — persis kasus yang mungkin dikirim
    // implementasi WebHID lain, bukan cuma DataView yang mulai dari byte 0.
    const buf = new ArrayBuffer(20);
    new Uint8Array(buf).set([9, 9, 9, 9, 1, 2, 3, 4, 5, 6]);
    const view = new DataView(buf, 4, 6);

    handler!({
      reportId: VENDOR_INPUT_REPORT_ID,
      data: view,
    } as unknown as HIDInputReportEvent);

    expect(received).toHaveLength(1);
    expect(Array.from(received[0])).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test('mengabaikan laporan dengan report ID lain', () => {
    let handler: ((e: HIDInputReportEvent) => void) | undefined;
    const dev = {
      addEventListener: vi.fn((_type: string, h: (e: HIDInputReportEvent) => void) => {
        handler = h;
      }),
      removeEventListener: vi.fn(),
    } as unknown as HIDDevice;

    const cb = vi.fn();
    onVendorInput(dev, cb);

    handler!({
      reportId: 3,
      data: new DataView(new ArrayBuffer(4)),
    } as unknown as HIDInputReportEvent);

    expect(cb).not.toHaveBeenCalled();
  });
});
