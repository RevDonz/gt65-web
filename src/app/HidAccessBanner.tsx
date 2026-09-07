import { useEffect, useState } from 'react';

const PERINTAH = `sudo install -m644 70-gt65.rules /etc/udev/rules.d/70-gt65.rules
sudo udevadm control --reload-rules && sudo udevadm trigger --subsystem-match=hidraw --action=add`;

interface Status { nodes: string[]; writable: boolean; checked: boolean }

/**
 * Memperingatkan ketika keyboard terpasang tetapi tidak bisa ditulis.
 *
 * Kondisi ini berbahaya justru karena tidak terlihat: Chromium mundur ke
 * hanya-baca ketika akses ditolak, sehingga open() sukses dan setiap tulisan
 * gagal tanpa galat. Endpoint __gt65/hid-access hanya ada di aplikasi desktop;
 * di peramban fetch-nya gagal dan spanduk ini tidak pernah muncul.
 */
export function HidAccessBanner() {
  const [status, setStatus] = useState<Status | null>(null);
  const [disalin, setDisalin] = useState(false);

  useEffect(() => {
    let batal = false;
    fetch('/__gt65/hid-access')
      .then((r) => (r.ok ? r.json() : null))
      .then((s: Status | null) => { if (!batal) setStatus(s); })
      .catch(() => { /* versi web — tidak ada endpoint ini */ });
    return () => { batal = true; };
  }, []);

  if (status === null || !status.checked) return null;
  if (status.nodes.length === 0 || status.writable) return null;

  return (
    <div className="hid-access-banner" role="alert">
      <strong>Keyboard terdeteksi tapi tidak bisa ditulis.</strong>
      <p>
        Aturan udev belum terpasang, jadi konfigurasi apa pun yang Anda terapkan akan
        gagal tanpa pesan galat. Berkas <code>70-gt65.rules</code> ada di dalam paket
        aplikasi ini. Jalankan dua perintah berikut, lalu buka ulang aplikasi.
      </p>
      <pre>{PERINTAH}</pre>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(PERINTAH).then(() => setDisalin(true));
        }}
      >
        {disalin ? 'Perintah tersalin' : 'Salin perintah'}
      </button>
    </div>
  );
}
