import { CLASS, PAYLOAD_LEN } from './protocol';

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

/**
 * Membaca balik feature report 0. Ditemukan di hardware bahwa buffer ini
 * adalah **echo dari feature report terakhir yang ditulis** ke perangkat —
 * bukan konfigurasi tersimpan. Lemah sebagai API baca-konfigurasi, tapi
 * berguna sebagai diagnostik: kalau isinya cocok dengan paket terakhir
 * yang dikirim, byte itu terbukti sampai ke perangkat.
 */
export async function receiveFeatureEcho(dev: HIDDevice): Promise<Uint8Array> {
  const v = await dev.receiveFeatureReport(FEATURE_REPORT_ID);
  return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
}

/**
 * Kirim satu transaksi (deretan paket 64 byte) ke perangkat.
 *
 * Temuan di hardware sungguhan: mengirim paket-paket ini beruntun (tanpa
 * membaca apa pun di antaranya) membuat lampu keyboard cuma berkedip —
 * tidak pernah benar-benar menerapkan transaksi. Membaca balik feature
 * report 0 di antara tiap paket kirim membuatnya bekerja pada percobaan
 * pertama. Pembacaan itu adalah control transfer — perjalanan bolak-balik
 * penuh ke perangkat — sehingga ia sekaligus memberi jeda pada urutan
 * pengiriman DAN mungkin bertindak sebagai semacam jabat tangan. Belum
 * diisolasi mekanisme mana yang sebenarnya berperan; jangan mengklaim
 * salah satunya di sini atau di tempat lain.
 *
 * Mengembalikan satu balikan (read-back) per paket supaya pemanggil bisa
 * memeriksa {@link statusByte}-nya. Kalau pembacaan untuk satu paket gagal,
 * penulisannya sudah terlanjur terjadi — jadi transaksi tidak digagalkan;
 * balikan untuk paket itu dicatat sebagai larik kosong dan proses lanjut.
 */
export async function sendTransaction(
  dev: HIDDevice,
  packets: Uint8Array[],
  delayMs = 3,
): Promise<Uint8Array[]> {
  for (const p of packets) {
    if (p.length !== PAYLOAD_LEN) {
      throw new RangeError(`paket harus 64 byte, dapat ${p.length}`);
    }
  }
  const readbacks: Uint8Array[] = [];
  for (const p of packets) {
    // TS 5.9's lib.dom.d.ts types BufferSource as ArrayBufferView<ArrayBuffer>,
    // while a bare `Uint8Array` annotation defaults to Uint8Array<ArrayBufferLike>
    // (which also covers SharedArrayBuffer-backed views). Every packet here is
    // always created via `new Uint8Array(PAYLOAD_LEN)`, so it is always backed
    // by a plain ArrayBuffer; the cast just narrows past that generic mismatch.
    await dev.sendFeatureReport(FEATURE_REPORT_ID, p as Uint8Array<ArrayBuffer>);
    if (delayMs > 0) await sleep(delayMs);
    try {
      readbacks.push(await receiveFeatureEcho(dev));
    } catch {
      readbacks.push(new Uint8Array(0));
    }
    if (delayMs > 0) await sleep(delayMs);
  }
  return readbacks;
}

/**
 * Byte status yang ditulis perangkat ke payload[3] pada balikan baca,
 * *khusus untuk paket perintah* (payload[0] === 0x04 — lihat `CLASS` di
 * protocol.ts). Diamati di hardware: 0x18, 0x02, 0x11, 0x13, 0x15 dijawab
 * 1; sedangkan 0xF0, 0x17, 0x19, 0x20, 0x23, 0x27, 0xF5 dijawab 0.
 *
 * JANGAN sebut ini "diterima/ditolak" — 0x17 dan 0x27 adalah perintah
 * vendor yang sah dan tetap dijawab 0, jadi pembacaan itu keliru. Dugaan
 * terbaik saat ini adalah "blok ini punya data tersimpan", tapi ini
 * BELUM dikonfirmasi — perlakukan sebagai pengamatan, bukan kepastian.
 *
 * Untuk paket data (payload[0] !== 0x04), payload[3] adalah bagian dari
 * payload itu sendiri (mis. kanal biru pada paket pencahayaan) — jangan
 * pernah dibaca sebagai status di sana. Fungsi ini mengembalikan `null`
 * baik untuk paket data maupun balikan yang terlalu pendek untuk dibaca.
 */
export function statusByte(sent: Uint8Array, got: Uint8Array): number | null {
  if (sent.length === 0 || sent[0] !== CLASS) return null;
  if (got.length < 4) return null;
  return got[3];
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
