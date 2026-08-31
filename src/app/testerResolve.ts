import type { Profile } from '../store/profile';
import { KEYS } from '../gt65/layout';

/**
 * Tombol fisik (`keyIndex`) mana yang, KALAU dipetakan lewat `profile` yang
 * sedang aktif, akan mengirim `usage` ini ke sistem operasi.
 *
 * KENAPA FUNGSI INI ADA. Browser tidak pernah memberi tahu tombol fisik mana
 * yang ditekan — `KeyboardEvent.code` diturunkan dari scancode, yang berasal
 * dari usage yang dikirim firmware keyboard. Begitu firmware memetakan ulang
 * sebuah tombol, `code` (dan usage hasil `usageForCode`-nya) mengikuti usage
 * BARU, bukan usage pabrik yang tercetak di `layout.ts`. Mencocokkan usage
 * yang masuk terhadap `layout.ts` saja berarti mencocokkan terhadap peta
 * yang sudah tidak lagi menggambarkan keyboard ini.
 *
 * Karena itu fungsi ini mencari di LAYER UTAMA profil dulu — satu-satunya
 * layer yang bisa diamati lewat event DOM, karena kombinasi Fn diselesaikan
 * di dalam firmware dan tidak pernah sampai ke sistem operasi — dan baru
 * jatuh ke `keyIndex` bawaan pabrik di `layout.ts` kalau profil sama sekali
 * tidak punya entri untuk usage tersebut.
 *
 * BISA MENGEMBALIKAN LEBIH DARI SATU INDEKS. Kalau dua tombol fisik
 * dipetakan ke usage yang sama, sistem operasi tidak bisa membedakan mana
 * yang ditekan — ini bukan bug di fungsi ini, itu keterbatasan nyata yang
 * harus ditampilkan apa adanya ke pengguna, bukan ditebak salah satu.
 */
export function keyIndicesForUsage(profile: Profile, usage: number): number[] {
  const fromProfile: number[] = [];
  profile.layers.top.forEach((entry, keyIndex) => {
    if (entry.kind === 'key' && entry.usage === usage) fromProfile.push(keyIndex);
  });
  if (fromProfile.length > 0) return fromProfile;
  return KEYS.filter((k) => k.usage === usage).map((k) => k.keyIndex);
}
