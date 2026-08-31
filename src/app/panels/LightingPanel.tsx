import type { Profile } from '../../store/profile';

/**
 * Nama efek lampu persis seperti di tabel string vendor `1033.lan`,
 * ID 200 sampai 221 berurutan tanpa celah. Nama sengaja dibiarkan dalam
 * bahasa aslinya supaya bisa dicocokkan langsung dengan daftar di
 * software vendor saat langkah hardware.
 *
 * BELUM DIPASTIKAN: bahwa indeks dalam daftar ini sama dengan nilai byte
 * `payload[0]` yang diterima keyboard. Spec Bagian 5.4 mencatat daftar
 * nilai `mode` tidak muncul sebagai konstanta di disassembly — software
 * vendor mengambilnya dari daftar di UI-nya. Urutan ID string adalah
 * dugaan terbaik untuk urutan itu, bukan bukti. Daftar ini mempersempit
 * ruang percobaan dari 256 nilai menjadi 22 dan memberi nama untuk
 * dicocokkan; ia TIDAK menyatakan pemetaannya sudah benar.
 */
export const LIGHT_MODES: string[] = [
  'Static', 'SingleOn', 'SingleOff', 'Glittering', 'Falling', 'Colourful',
  'Breath', 'Spectrum', 'Outward', 'Scrolling', 'Rolling', 'Rotating',
  'Explode', 'Launch', 'Ripples', 'Flowing', 'Pulsating', 'Tilt',
  'Shuttle', 'LED Off', 'Inwards', 'Floweriness',
];

export function LightingPanel({ profile, onChange, onApply }: {
  profile: Profile;
  onChange: (p: Profile) => void;
  onApply: () => void;
}) {
  const l = profile.lighting;
  const set = (patch: Partial<typeof l>) =>
    onChange({ ...profile, lighting: { ...l, ...patch } });

  const hex = `#${[l.r, l.g, l.b].map((v) =>
    v.toString(16).padStart(2, '0')).join('')}`;

  return (
    <section className="flex max-w-md flex-col gap-4">
      <label className="flex items-center justify-between gap-4">
        Mode
        <select value={String(l.mode)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isInteger(v)) return;
                  set({ mode: v });
                }}
                className="w-56 rounded bg-slate-800 px-2 py-1">
          {LIGHT_MODES.map((name, i) => (
            <option key={i} value={i}>{i} · {name}</option>
          ))}
          {l.mode >= LIGHT_MODES.length && (
            <option value={l.mode}>{l.mode} · (di luar daftar vendor)</option>
          )}
        </select>
      </label>
      <p className="-mt-2 rounded border border-amber-700 bg-amber-950/40 p-2
                    text-xs text-amber-300">
        <strong>Urutan mode ini BELUM DIPASTIKAN.</strong> Nama diambil dari
        tabel string vendor (1033.lan ID 200–221); belum ada bukti bahwa
        indeksnya sama dengan nilai byte yang diterima keyboard. Pakai daftar
        ini untuk mencocokkan efek yang terlihat dengan namanya, lalu catat
        hasilnya — lihat docs/hardware-checklist.md.
      </p>

      <label className="flex items-center justify-between gap-4">
        Warna
        <input type="color" value={hex}
               onChange={(e) => {
                 const v = e.target.value;
                 set({ r: parseInt(v.slice(1, 3), 16),
                       g: parseInt(v.slice(3, 5), 16),
                       b: parseInt(v.slice(5, 7), 16) });
               }} />
      </label>

      <label className="flex items-center justify-between gap-4">
        Kecepatan
        <input type="range" min={0} max={4} value={l.speed}
               onChange={(e) => set({ speed: Number(e.target.value) })} />
      </label>

      <label className="flex items-center justify-between gap-4">
        Kecerahan
        <input type="range" min={0} max={4} value={l.brightness}
               onChange={(e) => set({ brightness: Number(e.target.value) })} />
      </label>

      <label className="flex items-center justify-between gap-4">
        Arah
        <input type="number" min={0} max={3} value={l.direction}
               onChange={(e) => set({ direction: Number(e.target.value) })}
               className="w-24 rounded bg-slate-800 px-2 py-1" />
      </label>

      <button onClick={onApply}
              className="rounded bg-emerald-700 px-4 py-2 hover:bg-emerald-600">
        Terapkan pencahayaan
      </button>
    </section>
  );
}
