import type { ReactNode } from 'react';
import type { Status } from './useDevice';

const LABEL: Record<Status, string> = {
  idle: 'Belum tersambung',
  connecting: 'Menyambungkan…',
  connected: 'Tersambung',
  error: 'Gagal',
};

/**
 * Bilah tipis: nama produk, status perangkat sebagai pil ber-titik, aksi
 * profil, lalu sakelar mode kering di paling kanan.
 *
 * Sakelar itu dibuat sebagai sakelar sungguhan dengan label keadaan yang
 * tertulis penuh, bukan checkbox kecil. Mode kering adalah pengaman utama
 * aplikasi ini dan bawaannya kembali menyala setiap halaman dimuat ulang;
 * dua kali pengguna terjebak karena perubahan keadaan itu tidak terlihat.
 * Pasangannya adalah strip di atas area isi (lihat App.tsx) yang menyatakan
 * akibatnya dengan kalimat, bukan hanya warna.
 */
export function DeviceBar({
  status, error, dryRun, productName, onConnect, onToggleDryRun, actions,
  neverBackedUp, onBackup,
}: {
  status: Status;
  error: string | null;
  dryRun: boolean;
  productName: string | null;
  onConnect: () => void;
  onToggleDryRun: (v: boolean) => void;
  actions?: ReactNode;
  /** Belum pernah ekspor/impor di browser ini — lihat lencana di bawah. */
  neverBackedUp: boolean;
  onBackup: () => void;
}) {
  return (
    <header className="device-bar">
      <div className="device-bar-inner">
        <div className="brand-lockup">
          <span className="brand-mark">G</span>
          <span className="brand-copy">
            <strong>GT65</strong>
            <small>Keyboard Studio</small>
          </span>
        </div>

        <div className="device-cluster">
          <span className="pill" title={LABEL[status]}>
            <span className="dot" data-state={status} />
            <span>{LABEL[status]}</span>
            {status === 'connected' && productName && (
              <span className="num text-[var(--ink-3)]">{productName}</span>
            )}
          </span>
          <button className="btn" onClick={onConnect}>Sambungkan</button>
        </div>

        <div className="profile-actions">{actions}</div>

        {/*
          Lencana tenang, bukan alarm: memakai warna warn (kuning), bukan
          crit (merah) — ini bukan kesalahan, cuma pengingat bahwa belum
          ada salinan profil di luar browser ini. Bisa diklik langsung
          untuk mengekspor. Menghilang sendiri setelah ekspor atau impor
          pertama, jadi tidak menetap di layar orang yang sudah aman.
        */}
        {neverBackedUp && (
          <button type="button" className="pill" onClick={onBackup}
                  style={{ borderColor: 'var(--warn)', color: 'var(--warn)',
                           cursor: 'pointer' }}
                  title="Profil di browser ini belum pernah diekspor atau diimpor — klik untuk mengekspor sekarang.">
            <span className="dot" style={{ background: 'var(--warn)' }} />
            Belum pernah dicadangkan
          </button>
        )}

        <div className="safety-control">
          <span className="safety-copy">
            <strong>Pratinjau aman</strong>
            <small>Blokir penulisan ke keyboard</small>
          </span>
          <button type="button" role="switch" aria-checked={dryRun}
                  className="switch" data-on={dryRun}
                  onClick={() => onToggleDryRun(!dryRun)}>
            <span className="switch-track"><span className="switch-knob" /></span>
            <span className="switch-state"
                  style={{ color: dryRun ? 'var(--accent)' : 'var(--crit)' }}>
              {dryRun ? 'AKTIF' : 'MATI'}
            </span>
          </button>
        </div>
      </div>

      {error && (
        <p className="border-t border-[var(--edge)] px-4 py-1.5 text-[11px]"
           style={{ color: 'var(--crit)' }}>
          {error}
        </p>
      )}
    </header>
  );
}
