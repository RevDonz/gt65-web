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
    return <p className="text-slate-400">Sambungkan keyboard untuk memantau.</p>;
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <button onClick={() => setLines([])}
                className="rounded border border-slate-600 px-3 py-1 hover:bg-slate-800">
          Bersihkan
        </button>
        <span className="text-slate-400">{lines.length} event</span>
      </div>
      <ul className="max-h-96 overflow-y-auto rounded bg-slate-950 p-3 font-mono text-xs">
        {lines.map((l, i) => (
          <li key={i}>
            {l.at} · indeks {l.index ?? '(di luar laporan)'} · {l.hex}
          </li>
        ))}
      </ul>
    </section>
  );
}
