import { describe, expect, test } from 'vitest';
import { DEV_LOG_PATH, devLogSinkTarget, sessionHeaderLine } from '../src/app/devLogSink';

describe('devLogSinkTarget', () => {
  test('mengembalikan jalur dev-server saat development', () => {
    expect(devLogSinkTarget(true)).toBe(DEV_LOG_PATH);
  });

  test('mengembalikan null di luar development (mis. build produksi)', () => {
    expect(devLogSinkTarget(false)).toBeNull();
  });
});

describe('sessionHeaderLine', () => {
  test('memuat "sesi baru" dan cap waktu ISO', () => {
    const now = new Date('2026-08-31T04:05:06.000Z');
    const line = sessionHeaderLine(now);
    expect(line).toContain('sesi baru');
    expect(line).toContain('2026-08-31T04:05:06.000Z');
  });

  test('dibungkus baris pemisah agar terlihat jelas di berkas yang terus ditambahi', () => {
    const line = sessionHeaderLine(new Date('2026-08-31T00:00:00.000Z'));
    expect(line).toMatch(/^\n-+ sesi baru .* -+\n$/);
  });
});
