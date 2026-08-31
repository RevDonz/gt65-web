/**
 * Modal peringatan sebelum menerapkan remap dari profil yang belum pernah
 * disentuh (`provenance === 'default'`) — lihat `needsOverwriteWarning` di
 * store/profile.ts untuk keputusannya, dan App.tsx untuk kapan modal ini
 * dirender.
 *
 * Insiden nyata yang dicegah: pengguna punya pemetaan tombol dari software
 * vendor di Windows. Mereka membuka aplikasi ini pertama kali, mengubah
 * satu tombol, menekan "Terapkan" — dan seluruh pemetaan lama itu hilang.
 * Keyboard ini tidak bisa dibaca balik dan `remap()` selalu menulis SELURUH
 * tabel 144 slot sekaligus, jadi aplikasi tidak pernah tahu apa yang sedang
 * ditimpanya.
 *
 * Sengaja BUKAN `window.confirm` — dialog itu tidak bisa menyertakan
 * tombol "Impor cadangan" sebagai jalan keluar yang aman, dan gaya
 * visualnya lepas dari bahasa desain aplikasi ini.
 */
export function OverwriteGuardModal({ onImport, onCancel, onProceed }: {
  onImport: () => void;
  onCancel: () => void;
  onProceed: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center
                    bg-black/70 px-4 py-6"
         onClick={onCancel}>
      <div role="alertdialog" aria-modal="true"
           aria-labelledby="overwrite-guard-title"
           className="panel w-full max-w-md p-5"
           style={{ borderColor: 'var(--warn)' }}
           onClick={(e) => e.stopPropagation()}>
        <div className="label" style={{ color: 'var(--warn)' }}>Peringatan</div>
        <h2 id="overwrite-guard-title" className="mt-1.5 text-[15px] font-semibold">
          Profil ini belum pernah dikonfigurasi di sini
        </h2>
        <p className="mt-3 text-[12px] leading-relaxed text-[var(--ink-2)]">
          Profil di browser ini masih bawaan — belum pernah diedit atau
          diimpor di sini. Keyboard mungkin masih menyimpan pemetaan tombol
          dari komputer lain, dan aplikasi ini{' '}
          <strong style={{ color: 'var(--ink)' }}>tidak bisa membacanya</strong>.
          Menerapkan sekarang akan <strong style={{ color: 'var(--crit)' }}>
          menghapus pemetaan itu secara permanen</strong>.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <button className="btn btn-primary justify-center py-2" onClick={onImport}>
            Impor cadangan
          </button>
          <div className="flex gap-2">
            <button className="btn btn-quiet flex-1 justify-center" onClick={onCancel}>
              Batal
            </button>
            <button className="btn flex-1 justify-center"
                    style={{ color: 'var(--crit)', borderColor: 'var(--crit)' }}
                    onClick={onProceed}>
              Lanjutkan, saya mulai dari nol
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
