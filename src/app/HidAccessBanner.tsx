import { useEffect, useState } from 'react';
import type { Status as DeviceStatus } from './useDevice';

const RELEASES_URL = 'https://github.com/RevDonz/gt65-web/releases';

interface HidStatus {
  nodes: string[];
  writable: boolean;
  checked: boolean;
  /**
   * C1: lintasan absolut 70-gt65.rules di dalam bundel terpaket, dilaporkan
   * oleh electron/main.ts. `null` berarti berkasnya tak ditemukan (mis. mode
   * dev) — dalam kasus itu kita TIDAK PERNAH menampilkan nama relatif
   * telanjang, karena itulah yang membuat instruksi pemulihan asli berakhir
   * buntu: "70-gt65.rules" di dalam AppImage yang di-mount ada di
   * /tmp/.mount_gt65XXXXXX/resources/70-gt65.rules — lintasan acak yang
   * hanya hidup selama proses berjalan, bukan di direktori kerja pengguna.
   */
  rulesPath: string | null;
}

/**
 * Mengutip lintasan untuk shell POSIX, dengan escape untuk kutip tunggal di
 * dalamnya. R-C1: `process.resourcesPath` pada paket .deb/.rpm terpasang
 * adalah `/opt/GT65 Configurator/resources` — berspasi. Tanpa kutip, perintah
 * yang disalin pengguna terpotong di spasi itu dan `install` gagal mencari
 * berkas yang tidak ada.
 */
function q(p: string): string {
  return `'${p.replace(/'/g, "'\\''")}'`;
}

export function perintahPasang(rulesPath: string): string {
  return `sudo install -m644 ${q(rulesPath)} /etc/udev/rules.d/70-gt65.rules
sudo udevadm control --reload-rules && sudo udevadm trigger --subsystem-match=hidraw --action=add`;
}

/**
 * Memperingatkan ketika keyboard terpasang tetapi tidak bisa ditulis.
 *
 * Kondisi ini berbahaya justru karena tidak terlihat: Chromium mundur ke
 * hanya-baca ketika akses ditolak, sehingga open() sukses dan setiap tulisan
 * gagal tanpa galat. Endpoint __gt65/hid-access hanya ada di aplikasi desktop;
 * di peramban fetch-nya gagal dan spanduk ini tidak pernah muncul.
 *
 * I4: `deviceStatus` (dari useDevice) adalah dependensi efek pemeriksaan,
 * bukan cuma properti dekoratif. Spec §4.7 menuntut deteksi terjadi "pada
 * penulisan pertama, bukan pada pembukaan" — pemeriksaan sysfs sekali saat
 * mount buta terhadap alur colok-belakangan: pengguna membuka aplikasi tanpa
 * keyboard tercolok (spanduk benar-benar tersembunyi), menekan "Sambungkan",
 * lalu mencolok keyboard lewat jendela pendingChooser 10 detik di main.ts.
 * Tanpa memeriksa ulang saat status berubah jadi 'connected', spanduk tetap
 * tersembunyi walau ACL belum terpasang, dan setiap "Terapkan" berikutnya
 * gagal senyap dengan outcome 'ok' di log.
 */
export function HidAccessBanner({ deviceStatus }: { deviceStatus: DeviceStatus }) {
  const [status, setStatus] = useState<HidStatus | null>(null);
  const [disalin, setDisalin] = useState(false);

  useEffect(() => {
    let batal = false;
    fetch('/__gt65/hid-access')
      .then((r) => (r.ok ? r.json() : null))
      .then((s: HidStatus | null) => { if (!batal) setStatus(s); })
      .catch(() => { /* versi web — tidak ada endpoint ini */ });
    return () => { batal = true; };
  }, [deviceStatus]);

  if (status === null || !status.checked) return null;
  if (status.nodes.length === 0 || status.writable) return null;

  // Lokal (bukan status.rulesPath langsung) supaya penyempitan null tetap
  // berlaku di dalam closure onClick di bawah tanpa perlu type assertion.
  const rulesPath = status.rulesPath;
  const perintah = rulesPath !== null ? perintahPasang(rulesPath) : null;

  return (
    <div className="hid-access-banner" role="alert">
      <strong>Keyboard terdeteksi tapi tidak bisa ditulis.</strong>
      {perintah !== null ? (
        <>
          <p>
            Aturan udev belum terpasang, jadi konfigurasi apa pun yang Anda terapkan akan
            gagal tanpa pesan galat. Jalankan dua perintah berikut, lalu buka ulang aplikasi.
          </p>
          <pre>{perintah}</pre>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(perintah).then(() => setDisalin(true));
            }}
          >
            {disalin ? 'Perintah tersalin' : 'Salin perintah'}
          </button>
        </>
      ) : (
        <p>
          Aturan udev belum terpasang, jadi konfigurasi apa pun yang Anda terapkan akan
          gagal tanpa pesan galat. Berkas <code>70-gt65.rules</code> tidak ditemukan di dalam
          paket aplikasi ini — unduh dari{' '}
          <a href={RELEASES_URL} target="_blank" rel="noreferrer">halaman rilis GitHub</a>,
          simpan di folder mana pun, lalu jalankan (sesuaikan lintasannya):
          <br />
          <code>sudo install -m644 70-gt65.rules /etc/udev/rules.d/70-gt65.rules</code>
          <br />
          <code>sudo udevadm control --reload-rules &amp;&amp; sudo udevadm trigger --subsystem-match=hidraw --action=add</code>
        </p>
      )}
    </div>
  );
}
