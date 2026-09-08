import { useEffect, useState } from 'react';
import { onVendorInput } from '../../gt65/device';

type Line = { at: string; hex: string; index: number | undefined };

export function MonitorPanel({ device }: { device: HIDDevice | null }) {
  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => {
    if (!device) return;
    const stop = onVendorInput(device, (bytes) => {
      setLines((prev) => [{
        at: new Date().toLocaleTimeString(),
        hex: [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' '),
        // SELISIH BELUM DIPUTUSKAN: kode ini membaca `bytes[1]`, sedangkan
        // spec Bagian 5.6 menyebut `payload[2]` yang berisi indeks aksi.
        // Bagian 5.1 menegaskan seluruh offset di dokumen itu memakai
        // koordinat payload, jadi keduanya sungguh berselisih satu byte —
        // salah satunya keliru dan tidak ada yang tahu mana.
        //
        // Sengaja tidak diubah sepihak. Ini murni tampilan: nilainya tidak
        // pernah dikirim ke perangkat, dan hex mentah ditampilkan di
        // sebelahnya sehingga tidak ada yang tersembunyi. Laporan Report ID 5
        // hanya 3 byte, jadi satu penekanan tombol di langkah hardware
        // Task 12 langsung memperlihatkan byte mana yang berubah dan
        // menyelesaikan selisihnya. Lihat docs/hardware-checklist.md.
        index: bytes[1],
      }, ...prev].slice(0, 200));
    });
    return stop;
  }, [device]);

  if (!device) {
    return (
      <div className="empty-state"><span className="empty-keycap">⌁</span><strong>Menunggu keyboard Anda</strong><p>Sambungkan GT65 melalui tombol Sambungkan di atas untuk melihat aktivitas dari interface vendor secara langsung.</p><span className="pill">Monitor HID · Hingga 200 event</span></div>
    );
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <span className="label">Monitor laporan vendor</span>
        <button onClick={() => setLines([])}
                className="btn">
          Bersihkan
        </button>
        <span className="num text-[11px] text-[var(--ink-3)]">{lines.length} event</span>
      </div>
      <ul className="well num max-h-96 overflow-y-auto p-3 text-[10px] leading-[1.7]
                     text-[var(--ink-2)]">
        {lines.map((l, i) => (
          <li key={i}>
            {l.at} · indeks {l.index ?? '(di luar laporan)'} · {l.hex}
          </li>
        ))}
      </ul>
    </section>
  );
}
