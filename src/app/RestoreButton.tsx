import { useState } from 'react';

/**
 * Dua langkah, bukan satu: pemulihan bawaan menulis ulang SELURUH
 * konfigurasi (dua layer remap, pencahayaan, pengaturan) ke perangkat yang
 * tidak bisa dibaca balik, jadi salah klik tidak bisa diperiksa apalagi
 * dibatalkan.
 */
export function RestoreButton({ onRestore }: { onRestore: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button className="btn" onClick={() => setConfirming(true)}
              style={{ color: 'var(--warn)', borderColor: 'var(--edge-bright)' }}>
        Pulihkan bawaan
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-[11px] text-[var(--ink-2)]">
      Tulis ulang seluruh konfigurasi ke bawaan?
      <button className="btn" onClick={() => { setConfirming(false); onRestore(); }}
              style={{ color: 'var(--warn)', borderColor: 'var(--warn)' }}>
        Ya, tulis
      </button>
      <button className="btn btn-quiet" onClick={() => setConfirming(false)}>Batal</button>
    </span>
  );
}
