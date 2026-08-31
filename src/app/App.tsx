import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DeviceBar } from './DeviceBar';
import { useDevice } from './useDevice';
import { formatHex } from './hex';
import { RestoreButton } from './RestoreButton';
import { LightingPanel } from './panels/LightingPanel';
import { SettingsPanel } from './panels/SettingsPanel';
import { MonitorPanel } from './panels/MonitorPanel';
import { RemapPanel } from './panels/RemapPanel';
import { LogPanel } from './panels/LogPanel';
import { TesterPanel } from './panels/TesterPanel';
import { lighting, settings, remap } from '../gt65/protocol';
import type { Layer } from '../gt65/protocol';
import {
  defaultProfile, exportProfile, importProfile, loadProfile, saveProfile,
  needsOverwriteWarning, promoteProvenance,
} from '../store/profile';
import type { Profile } from '../store/profile';
import { OverwriteGuardModal } from './OverwriteGuardModal';

const TABS = ['Remap', 'Lampu', 'Tester', 'Pengaturan', 'Monitor', 'Log'] as const;
type Tab = (typeof TABS)[number];

/**
 * Ikon rail digambar inline sebagai SVG — bukan pustaka ikon dan bukan
 * emoji. Semuanya bergaris 1.5px pada kotak 24 supaya seluruh rail terbaca
 * sebagai satu set, seperti sablon pada panel alat.
 */
const ICONS: Record<Tab, ReactNode> = {
  Remap: (
    <>
      <rect x="3" y="4" width="8" height="8" rx="1.5" />
      <rect x="13" y="12" width="8" height="8" rx="1.5" />
      <path d="M11 8h4a2 2 0 0 1 2 2v2" />
    </>
  ),
  Lampu: (
    <>
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6
               M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
    </>
  ),
  Tester: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M8.5 12.2l2.4 2.4 4.6-5.2" />
    </>
  ),
  Pengaturan: (
    <>
      <path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h12" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="17" r="2" />
    </>
  ),
  Monitor: (
    <>
      <rect x="2.5" y="4.5" width="19" height="13" rx="2" />
      <path d="M6 12h2.2l1.6-3.4 2.2 6.4 1.5-3H18" />
      <path d="M9.5 20.5h5" />
    </>
  ),
  Log: <path d="M4 6h16M4 10h16M4 14h11M4 18h7" />,
};

function RailIcon({ tab }: { tab: Tab }) {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none"
         stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[tab]}
    </svg>
  );
}

/** Nama berkas unduhan dari nama profil; jatuh ke default kalau kosong/aneh. */
function exportFilename(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${slug || 'profil-gt65'}.json`;
}

export function App() {
  const [dryRun, setDryRun] = useState(true);
  const [tab, setTab] = useState<Tab>('Lampu');
  const [profile, setProfileState] = useState<Profile>(loadProfile);
  const [importError, setImportError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  // Layer yang menunggu konfirmasi di OverwriteGuardModal — lihat
  // handleRemapApply di bawah. `null` berarti modal tertutup.
  const [pendingRemapLayer, setPendingRemapLayer] = useState<Layer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dev = useDevice(dryRun);

  /**
   * Tiap suntingan panel langsung tersimpan; tidak ada tombol simpan
   * manual. localStorage masih salinan utama profil, jadi kegagalan
   * menyimpan berarti suntingan bisa hilang saat halaman dimuat ulang —
   * itu harus terlihat, bukan ditelan diam-diam.
   *
   * Ini juga SATU-SATUNYA jalur yang boleh mengubah `profile.provenance`
   * ke `'edited'` (lewat `promoteProvenance`) — lihat dokumentasinya di
   * store/profile.ts. Semua panel (Remap, Lampu, Pengaturan), impor
   * berkas, dan "Pulihkan bawaan" sama-sama memanggil `setProfile`, jadi
   * panel baru mewarisi pengaman ini tanpa perlu mengingatnya sendiri.
   */
  const setProfile = (p: Profile) => {
    const next = promoteProvenance(profile, p);
    setProfileState(next);
    setSaveFailed(!saveProfile(next));
  };

  const handleExport = () => {
    const json = exportProfile(profile);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFilename(profile.name);
    a.click();
    URL.revokeObjectURL(url);
    if (!profile.backedUp) setProfile({ ...profile, backedUp: true });
  };

  const applyRemapLayer = (l: Layer) => dev.send(
    l === 'top' ? 'Terapkan layer utama' : 'Terapkan layer Fn',
    remap(l, profile.layers[l]),
  );

  /**
   * Gerbang di depan tombol "Terapkan layer ini" di RemapPanel. `remap()`
   * menulis seluruh 144 slot sekaligus dan keyboard tidak bisa dibaca
   * balik, jadi kalau profil di browser ini masih bawaan — belum pernah
   * disunting atau diimpor di sini — aplikasi tidak tahu apa yang sedang
   * ditimpanya. Hanya remap yang digerbangi (lihat needsOverwriteWarning):
   * lampu terlihat dan bisa dipulihkan lewat Fn+\` di keyboardnya sendiri,
   * pengaturan cuma lima boolean.
   */
  const handleRemapApply = (l: Layer) => {
    if (needsOverwriteWarning(profile)) {
      setPendingRemapLayer(l);
    } else {
      void applyRemapLayer(l);
    }
  };

  const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      setProfile(importProfile(text));
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  };

  const profileActions = (
    <>
      <button className="btn" onClick={handleExport}>Ekspor</button>
      <button className="btn" onClick={() => fileInputRef.current?.click()}>Impor</button>
      <RestoreButton onRestore={async () => {
        const d = defaultProfile();
        // "Belum pernah dicadangkan" adalah riwayat browser ini (pernah
        // ekspor/impor atau belum), bukan sifat isi profil — pemulihan
        // bawaan tidak boleh diam-diam menghidupkan lagi lencana itu kalau
        // pengguna sudah pernah mencadangkan sebelumnya.
        setProfile({ ...d, backedUp: profile.backedUp });
        // Satu panggilan berisi empat transaksi: tetap dikirim terpisah
        // dan berurutan, tapi pratinjau mode kering memperlihatkan
        // keempatnya sekaligus.
        await dev.send(
          'Pulihkan bawaan',
          remap('top', d.layers.top),
          remap('fn', d.layers.fn),
          lighting(d.lighting),
          settings(d.settings),
        );
      }} />
      <input ref={fileInputRef} type="file" accept="application/json" hidden
             onChange={handleImportChange} />
    </>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <DeviceBar status={dev.status} error={dev.error} dryRun={dryRun}
                 productName={dev.device?.productName ?? null}
                 onConnect={dev.connect} onToggleDryRun={setDryRun}
                 actions={profileActions}
                 neverBackedUp={!profile.backedUp} onBackup={handleExport} />

      {pendingRemapLayer !== null && (
        <OverwriteGuardModal
          onImport={() => { setPendingRemapLayer(null); fileInputRef.current?.click(); }}
          onCancel={() => setPendingRemapLayer(null)}
          onProceed={() => {
            const l = pendingRemapLayer;
            setPendingRemapLayer(null);
            setProfile({ ...profile, provenance: 'edited' });
            void applyRemapLayer(l);
          }}
        />
      )}

      <div className="flex min-h-0 flex-1">
        <nav role="tablist" aria-orientation="vertical" aria-label="Panel"
             className="w-[78px] shrink-0 border-r border-[var(--edge)]
                        bg-[var(--panel)] pt-1">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t}
                    className="rail-item" onClick={() => setTab(t)}>
              <RailIcon tab={t} />
              {t}
            </button>
          ))}
        </nav>

        <main className="flex min-w-0 flex-1 flex-col">
          {/*
            Strip mode kering. Sakelarnya ada di header, tapi keadaan yang
            berlaku harus terbaca dari area kerja juga — dua kali pengguna
            mengira sedang menulis ke keyboard padahal tidak, dan sekali
            sebaliknya. Warna berubah bersama kalimatnya, jadi tidak ada
            yang bergantung pada warna saja.
          */}
          <div className="strip" data-mode={dryRun ? 'dry' : 'live'}>
            <span className="label" style={{ color: 'inherit' }}>
              {dryRun ? 'Mode kering aktif' : 'Mode kering mati'}
            </span>
            <span>
              {dryRun
                ? 'Tidak ada apa pun yang ditulis ke keyboard — paket hanya '
                  + 'ditampilkan sebagai pratinjau.'
                : 'Setiap tombol "Terapkan" menulis langsung ke keyboard, dan '
                  + 'papan ini tidak bisa dibaca balik untuk memeriksanya.'}
            </span>
          </div>

          <div className="flex-1 px-5 py-5">
            {importError && (
              <p className="panel mb-4 px-3 py-2 text-[12px]"
                 style={{ borderColor: 'var(--crit)', color: 'var(--crit)' }}>
                Gagal impor profil: {importError}
              </p>
            )}
            {saveFailed && (
              <p className="panel mb-4 px-3 py-2 text-[12px] text-[var(--ink-2)]"
                 style={{ borderColor: 'var(--crit)' }}>
                <strong style={{ color: 'var(--crit)' }}>
                  Perubahan tidak tersimpan di browser.
                </strong>{' '}
                Penyimpanan penuh atau diblokir. Profil masih aktif di memori
                dan masih bisa diterapkan ke keyboard, tapi akan hilang saat
                halaman dimuat ulang — klik <em>Ekspor</em> sekarang untuk
                menyimpannya sebagai berkas.
              </p>
            )}

            <div key={tab} className="panel-swap">
              {tab === 'Remap' && (
                <RemapPanel profile={profile} onChange={setProfile}
                            onApply={handleRemapApply} />
              )}
              {tab === 'Lampu' && (
                <LightingPanel profile={profile} onChange={setProfile}
                               onApply={() => dev.send('Terapkan pencahayaan', lighting(profile.lighting))}
                               onApplyVendorReference={() => dev.send(
                                 'Kirim nilai vendor (referensi)',
                                 lighting({
                                   mode: 0x0b, r: 0xff, g: 0x00, b: 0x00,
                                   // speed/brightness ditukar dari nilai lama supaya
                                   // byte payload[9]/[10] yang dikirim tetap identik
                                   // dengan buffer yang terbaca dari perangkat
                                   // sungguhan — lihat protocol.ts untuk pemetaan
                                   // yang sudah dikonfirmasi hardware.
                                   speed: 10, brightness: 15, direction: 0,
                                 }),
                               )} />
              )}
              {tab === 'Tester' && <TesterPanel />}
              {tab === 'Pengaturan' && (
                <SettingsPanel profile={profile} onChange={setProfile}
                               onApply={() => dev.send('Terapkan pengaturan', settings(profile.settings))} />
              )}
              {tab === 'Monitor' && <MonitorPanel device={dev.device} />}
              {tab === 'Log' && (
                <LogPanel entries={dev.log} dryRun={dryRun}
                          productName={dev.device?.productName ?? null} />
              )}
            </div>

            {dev.lastPackets.length > 0 && (
              <div className="mt-6">
                <div className="label mb-1.5">Paket terakhir</div>
                <pre className="well num overflow-x-auto p-3 text-[10px]
                                leading-[1.7] text-[var(--ink-2)]">
                  {formatHex(dev.lastPackets)}
                </pre>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
