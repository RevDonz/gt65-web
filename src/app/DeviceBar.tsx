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
    <header className="border-b border-[var(--edge)] bg-[var(--panel)]">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2">
        <div className="flex items-baseline gap-2 pr-1">
          <span className="text-[15px] font-bold tracking-[0.06em]">GT65</span>
          <span className="label">Konfigurator</span>
        </div>

        <span className="h-5 w-px bg-[var(--edge)]" />

        <span className="pill" title={LABEL[status]}>
          <span className="dot" data-state={status} />
          <span>{LABEL[status]}</span>
          {status === 'connected' && productName && (
            <span className="num text-[var(--ink-3)]">{productName}</span>
          )}
        </span>

        <button className="btn" onClick={onConnect}>Sambungkan</button>

        <span className="h-5 w-px bg-[var(--edge)]" />

        {actions}

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

        <div className="ml-auto flex items-center gap-2">
          <span className="label">Mode kering</span>
          <button type="button" role="switch" aria-checked={dryRun}
                  className="switch" data-on={dryRun}
                  onClick={() => onToggleDryRun(!dryRun)}>
            <span className="switch-track"><span className="switch-knob" /></span>
            <span className="text-[11px] font-semibold tracking-[0.08em]"
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
