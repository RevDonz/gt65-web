/**
 * Jalur endpoint dev-server yang menampung entri log satu per satu untuk
 * ditulis ke `logs/session.log` (lihat vite-plugins/log-sink.ts). Hanya
 * pernah dituju saat development — lihat `sendToDevLogSink`.
 */
export const DEV_LOG_PATH = '/__log';

/**
 * Keputusan murni: URL tujuan POST kalau sedang development, atau `null`
 * kalau tidak (mis. build produksi). Dipisahkan dari `fetch` supaya bisa
 * diuji tanpa server dev maupun build produksi berjalan — sama seperti
 * `sendDecision` di useDevice.ts dipisahkan dari hook React.
 */
export function devLogSinkTarget(isDev: boolean): string | null {
  return isDev ? DEV_LOG_PATH : null;
}

/**
 * Baris pemisah sesi baru, dengan cap waktu ISO, ditulis di awal tiap
 * proses dev supaya beberapa sesi debugging yang berbeda tetap bisa
 * dibedakan di dalam satu berkas log yang terus ditambahi.
 */
export function sessionHeaderLine(now: Date): string {
  const bar = '-'.repeat(24);
  return `\n${bar} sesi baru ${now.toISOString()} ${bar}\n`;
}

/**
 * Kirim satu entri log ke dev-server log sink secara fire-and-forget.
 *
 * Tidak pernah membuat transaksi nyata menunggu atau gagal karena ini:
 * kegagalan (server dev tidak berjalan, jaringan mati, dll) sengaja
 * diabaikan begitu saja. Ini alat bantu debug, bukan bagian dari alur
 * normal aplikasi — dan di build produksi `devLogSinkTarget` selalu
 * mengembalikan `null` karena `import.meta.env.DEV` sudah digantikan
 * Vite dengan `false`, jadi tidak pernah benar-benar memanggil `fetch`.
 */
export function sendToDevLogSink(text: string): void {
  const url = devLogSinkTarget(import.meta.env.DEV);
  if (url === null) return;
  try {
    fetch(url, { method: 'POST', body: text }).catch(() => {});
  } catch {
    // Dev server tidak berjalan — bukan kegagalan yang perlu ditangani.
  }
}
