import type { Profile } from '../../store/profile';

/**
 * Nama efek lampu persis seperti di tabel string vendor `1033.lan`,
 * ID 200 sampai 221 berurutan tanpa celah. Nama sengaja dibiarkan dalam
 * bahasa aslinya supaya bisa dicocokkan langsung dengan daftar di
 * software vendor.
 *
 * TERKONFIRMASI DI HARDWARE SUNGGUHAN (2026-08-31): indeks daftar ini
 * sama dengan nilai byte `payload[0]` yang diterima keyboard. Mode 11
 * diamati langsung menghasilkan efek "Rotating" di keyboard fisik, persis
 * nama pada indeks 11 di sini — jadi urutan ID string dari `1033.lan`
 * terbukti benar untuk rentang nilai yang valid (lihat `LIGHT_MODE_MIN`/
 * `LIGHT_MODE_MAX`), bukan lagi dugaan.
 */
export const LIGHT_MODES: string[] = [
  'Static', 'SingleOn', 'SingleOff', 'Glittering', 'Falling', 'Colourful',
  'Breath', 'Spectrum', 'Outward', 'Scrolling', 'Rolling', 'Rotating',
  'Explode', 'Launch', 'Ripples', 'Flowing', 'Pulsating', 'Tilt',
  'Shuttle', 'LED Off', 'Inwards', 'Floweriness',
];

/**
 * Rentang nilai `mode` yang sah, TERKONFIRMASI DI HARDWARE SUNGGUHAN
 * (2026-08-31): 0, 20, dan 21 diuji langsung di keyboard fisik dan tidak
 * menyalakan lampu sama sekali. Manual keyboard menyebut 18 mode efek —
 * konsisten dengan rentang 1..19 ini kalau "LED Off" (indeks 19) tidak
 * dihitung sebagai efek lampu tersendiri.
 */
export const LIGHT_MODE_MIN = 1;
export const LIGHT_MODE_MAX = 19;

/**
 * Empat nilai byte arah diamati punya dua perilaku berbeda di hardware
 * sungguhan (2026-08-31): 0 dan 3 beranimasi kiri-ke-kanan; 1 dan 2
 * beranimasi kanan-ke-kiri. Keempatnya tetap diekspos terpisah (bukan
 * disederhanakan jadi dua opsi) karena belum diketahui apakah keduanya
 * benar-benar identik di semua mode atau cuma kebetulan sama pada mode
 * yang diuji.
 */
const DIRECTION_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: '0 · Kiri ke kanan' },
  { value: 1, label: '1 · Kanan ke kiri' },
  { value: 2, label: '2 · Kanan ke kiri' },
  { value: 3, label: '3 · Kiri ke kanan' },
];

export function LightingPanel({ profile, onChange, onApply, onApplyVendorReference }: {
  profile: Profile;
  onChange: (p: Profile) => void;
  onApply: () => void;
  onApplyVendorReference: () => void;
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
          {LIGHT_MODES
            .map((name, i) => ({ name, i }))
            .filter(({ i }) => i >= LIGHT_MODE_MIN && i <= LIGHT_MODE_MAX)
            .map(({ name, i }) => (
              <option key={i} value={i}>{i} · {name}</option>
            ))}
        </select>
      </label>
      <p className="-mt-2 rounded border border-slate-700 bg-slate-800/40 p-2
                    text-xs text-slate-300">
        Warna RGB di bawah <strong>tidak berlaku untuk semua mode</strong> —
        belum diketahui pasti mode mana yang memakainya. Saat warna diset ke
        kuning, efeknya tidak terlihat di sebagian mode (kemungkinan mode
        animasi/multiwarna mengabaikan RGB dan memakai warnanya sendiri).
        Coba tiap mode untuk melihat mana yang benar-benar mengikuti warna
        yang dipilih.
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

      <p className="-mt-2 rounded border border-slate-700 bg-slate-800/40 p-2
                    text-xs text-slate-300">
        Kecepatan dan kecerahan dibatasi 0-4 (byte kabel 1-5). Batas atas ini
        berasal dari <code>rgb-keyboard.xml</code> vendor (<code>speed_max=5</code>,
        <code>brightness_max=5</code>) — ini batas yang didokumentasikan
        vendor, bukan yang sudah diuji langsung di unit ini. Yang terbukti
        langsung di hardware baru nilai UI 2 (byte kabel 3); lihat tombol
        &quot;Kirim nilai vendor (referensi)&quot; di bawah untuk titik lain
        yang juga terbukti.
      </p>

      <label className="flex items-center justify-between gap-4">
        Kecepatan (payload[10])
        <input type="number" min={0} max={4} value={l.speed}
               onChange={(e) => set({ speed: Number(e.target.value) })}
               className="w-24 rounded bg-slate-800 px-2 py-1" />
      </label>

      <label className="flex items-center justify-between gap-4">
        Kecerahan (payload[9])
        <input type="number" min={0} max={4} value={l.brightness}
               onChange={(e) => set({ brightness: Number(e.target.value) })}
               className="w-24 rounded bg-slate-800 px-2 py-1" />
      </label>

      <label className="flex items-center justify-between gap-4">
        Arah
        <select value={String(l.direction)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isInteger(v)) return;
                  set({ direction: v });
                }}
                className="w-40 rounded bg-slate-800 px-2 py-1">
          {DIRECTION_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>

      <button onClick={onApply}
              className="rounded bg-emerald-700 px-4 py-2 hover:bg-emerald-600">
        Terapkan pencahayaan
      </button>

      <div className="flex flex-col gap-1 border-t border-slate-700 pt-4">
        <button onClick={onApplyVendorReference}
                className="rounded border border-sky-700 bg-sky-950/40 px-4 py-2
                           text-sky-200 hover:bg-sky-900/40">
          Kirim nilai vendor (referensi)
        </button>
        <p className="text-xs text-slate-400">
          Mengirim persis paket yang terbaca dari buffer perangkat sungguhan
          setelah software vendor asli menyalakannya: mode 0x0b, merah penuh,
          kecerahan hampir penuh (nilai UI 15) dan kecepatan sedang (nilai UI
          10) — sekarang sudah dipetakan ke field yang benar sesuai kalibrasi
          hardware. Ini satu-satunya urutan byte yang terbukti pernah membuat
          keyboard ini menyala — kalau tombol ini menyalakan lampu merah,
          berarti seluruh jalur di luar rentang nilai kita (transport,
          framing, payload[8]) sudah benar.
        </p>
      </div>
    </section>
  );
}
