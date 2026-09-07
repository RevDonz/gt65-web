import path from 'node:path';

export const SCHEME = 'app';
export const HOST = 'gt65';

/**
 * Memetakan URL app:// ke lintasan absolut di dalam `root`.
 * Mengembalikan null bila permintaan harus ditolak.
 *
 * Karena skema didaftarkan `standard: true`, parser URL sudah menormalkan
 * segmen '..' yang polos (app://gt65/../x -> /x). Yang TIDAK dinormalkan
 * adalah bentuk ter-encode ('..%2f', '%2e%2e%2f'): itu baru muncul setelah
 * decodeURIComponent dan benar-benar keluar dari root. Penjagaan startsWith
 * di bawah yang menahannya.
 */
export function resolveAssetPath(requestUrl: string, root: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(requestUrl);
  } catch {
    return null;
  }

  // Host tetap. app://gt65 dan app://lain adalah origin berbeda; hanya satu
  // yang boleh dilayani, kalau tidak izin perangkat bisa bocor lintas origin.
  if (parsed.protocol !== `${SCHEME}:` || parsed.hostname !== HOST) return null;

  let rel: string;
  try {
    rel = decodeURIComponent(parsed.pathname);
  } catch {
    return null; // persen-encoding rusak, mis. '%zz'
  }

  if (rel.includes('\0')) return null;
  if (rel === '' || rel === '/') rel = '/index.html';

  const joined = path.normalize(path.join(root, rel));

  // Penjagaan sesungguhnya: hasil akhir harus tetap di dalam root.
  if (joined !== root && !joined.startsWith(root + path.sep)) return null;

  return joined;
}
