import { PAYLOAD_LEN } from './protocol';

export const VENDOR_ID = 0x05ac;
export const PRODUCT_ID = 0x024f;
export const FEATURE_REPORT_ID = 0;
export const VENDOR_INPUT_REPORT_ID = 5;

export type DeviceErrorKind = 'unsupported' | 'notfound' | 'permission' | 'wrongmode';

export class DeviceError extends Error {
  constructor(message: string, readonly kind: DeviceErrorKind) {
    super(message);
    this.name = 'DeviceError';
  }
}

function reportBytes(r: { items?: { reportSize?: number; reportCount?: number }[] }): number {
  let bits = 0;
  for (const it of r.items ?? []) bits += (it.reportSize ?? 0) * (it.reportCount ?? 0);
  return Math.ceil(bits / 8);
}

/** Interface konfigurasi adalah yang punya feature report >= 60 byte. */
export function findConfigInterface(devices: HIDDevice[]): HIDDevice | null {
  for (const d of devices) {
    for (const c of d.collections ?? []) {
      for (const r of c.featureReports ?? []) {
        if (reportBytes(r) >= 60) return d;
      }
    }
  }
  return null;
}

function looksLikeDongle(devices: HIDDevice[]): boolean {
  return devices.some((d) =>
    (d.collections ?? []).some((c) => c.usagePage === 0xffb5));
}

export async function requestDevice(): Promise<HIDDevice> {
  if (!('hid' in navigator)) {
    throw new DeviceError(
      'Browser ini tidak mendukung WebHID. Pakai Chrome, Edge, atau Brave.',
      'unsupported');
  }

  const devices = await navigator.hid.requestDevice({
    filters: [{ vendorId: VENDOR_ID, productId: PRODUCT_ID }],
  });

  if (devices.length === 0) {
    throw new DeviceError('Tidak ada perangkat dipilih.', 'notfound');
  }

  const dev = findConfigInterface(devices);
  if (!dev) {
    if (looksLikeDongle(devices)) {
      throw new DeviceError(
        'Keyboard tersambung lewat dongle 2.4 GHz. Konfigurasi hanya bisa ' +
        'lewat kabel USB — cabut dongle dan colok kabelnya.',
        'wrongmode');
    }
    throw new DeviceError(
      'Kanal konfigurasi tidak ditemukan pada perangkat ini.', 'notfound');
  }

  if (!dev.opened) {
    try {
      await dev.open();
    } catch (e) {
      throw new DeviceError(
        'Tidak bisa membuka perangkat. Di Linux, pasang udev rule: ' +
        'KERNEL=="hidraw*", ATTRS{idVendor}=="05ac", ATTRS{idProduct}=="024f", ' +
        'TAG+="uaccess" — lalu colok ulang keyboard.',
        'permission');
    }
  }
  return dev;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sendTransaction(
  dev: HIDDevice,
  packets: Uint8Array[],
  gapMs = 1,
): Promise<void> {
  for (const p of packets) {
    if (p.length !== PAYLOAD_LEN) {
      throw new RangeError(`paket harus 64 byte, dapat ${p.length}`);
    }
  }
  for (const p of packets) {
    // TS 5.9's lib.dom.d.ts types BufferSource as ArrayBufferView<ArrayBuffer>,
    // while a bare `Uint8Array` annotation defaults to Uint8Array<ArrayBufferLike>
    // (which also covers SharedArrayBuffer-backed views). Every packet here is
    // always created via `new Uint8Array(PAYLOAD_LEN)`, so it is always backed
    // by a plain ArrayBuffer; the cast just narrows past that generic mismatch.
    await dev.sendFeatureReport(FEATURE_REPORT_ID, p as Uint8Array<ArrayBuffer>);
    if (gapMs > 0) await sleep(gapMs);
  }
}

/** Berlangganan Report ID 5 dari interface vendor. Mengembalikan fungsi berhenti. */
export function onVendorInput(
  dev: HIDDevice,
  cb: (bytes: Uint8Array) => void,
): () => void {
  const handler = (e: HIDInputReportEvent) => {
    if (e.reportId !== VENDOR_INPUT_REPORT_ID) return;
    cb(new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength));
  };
  dev.addEventListener('inputreport', handler as EventListener);
  return () => dev.removeEventListener('inputreport', handler as EventListener);
}
