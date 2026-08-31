import { describe, expect, test, vi } from 'vitest';
import { findConfigInterface, sendTransaction, DeviceError } from '../src/gt65/device';

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
