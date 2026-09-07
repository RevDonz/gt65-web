import type { CSSProperties } from 'react';
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

const PREVIEW_KEYS = Array.from({ length: 24 }, (_, i) => {
  const row = Math.floor(i / 8);
  const col = i % 8;
  return { i, row, col, distance: Math.abs(row - 1) + Math.abs(col - 3.5) };
});

function LightingPreview({ mode, color, speed, brightness, direction }: {
  mode: number; color: string; speed: number; brightness: number; direction: number;
}) {
  const duration = Math.max(0.65, 2.45 - speed * 0.42);
  const intensity = Math.max(0.12, Math.min(1, 0.2 + brightness * 0.2));
  const style = {
    '--preview-color': color,
    '--preview-duration': `${duration}s`,
    '--preview-brightness': intensity,
  } as CSSProperties;

  return (
    <figure className="lighting-preview" data-lighting-preview
            data-mode={mode} data-speed={speed} data-brightness={brightness}
            data-direction={direction} style={style}>
      <figcaption>
        <span>
          <span className="label">Pratinjau efek</span>
          <strong>{LIGHT_MODES[mode] ?? `Mode ${mode}`}</strong>
        </span>
        <span className="preview-readout num">
          {duration.toFixed(2)}s · {Math.round(intensity * 100)}%
        </span>
      </figcaption>
      <div className="preview-board" aria-label={`Ilustrasi animasi ${LIGHT_MODES[mode] ?? mode}`}>
        {PREVIEW_KEYS.map(({ i, row, col, distance }) => (
          <span key={i} className="preview-key" aria-hidden="true"
                style={{ '--i': i, '--row': row, '--col': col,
                         '--distance': distance } as CSSProperties} />
        ))}
      </div>
      <p>Ilustrasi konseptual—ritme mengikuti pengaturan; LED fisik dapat sedikit berbeda.</p>
    </figure>
  );
}

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
    <section className="panel settings-card flex max-w-3xl flex-col gap-4 p-5">
      <div className="label">Pencahayaan</div>
      <LightingPreview mode={l.mode} color={hex} speed={l.speed}
                       brightness={l.brightness} direction={l.direction} />
      <label className="flex items-center justify-between gap-4">
        <span className="label">Mode</span>
        <select value={String(l.mode)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isInteger(v)) return;
                  set({ mode: v });
                }}
                className="field w-56">
          {LIGHT_MODES
            .map((name, i) => ({ name, i }))
            .filter(({ i }) => i >= LIGHT_MODE_MIN && i <= LIGHT_MODE_MAX)
            .map(({ name, i }) => (
              <option key={i} value={i}>{i} · {name}</option>
            ))}
        </select>
      </label>
      <p className="-mt-2 well p-2.5 text-[11px] leading-relaxed text-[var(--ink-2)]">
        Warna RGB di bawah <strong>tidak berlaku untuk semua mode</strong> —
        belum diketahui pasti mode mana yang memakainya. Saat warna diset ke
        kuning, efeknya tidak terlihat di sebagian mode (kemungkinan mode
        animasi/multiwarna mengabaikan RGB dan memakai warnanya sendiri).
        Coba tiap mode untuk melihat mana yang benar-benar mengikuti warna
        yang dipilih.
      </p>

      <label className="flex items-center justify-between gap-4">
        <span className="label">Warna</span>
        <span className="flex items-center gap-2">
          <span className="num text-[11px] uppercase text-[var(--ink-3)]">{hex}</span>
          <input type="color" value={hex}
                 className="h-7 w-14 cursor-pointer rounded-[3px]
                            border border-[var(--edge-bright)] bg-[var(--panel-2)] p-[3px]"
                 onChange={(e) => {
                   const v = e.target.value;
                   set({ r: parseInt(v.slice(1, 3), 16),
                         g: parseInt(v.slice(3, 5), 16),
                         b: parseInt(v.slice(5, 7), 16) });
                 }} />
        </span>
      </label>

      <p className="-mt-2 well p-2.5 text-[11px] leading-relaxed text-[var(--ink-2)]">
        Kecepatan dan kecerahan dibatasi 0-4 (byte kabel 1-5). Batas atas ini
        berasal dari <code>rgb-keyboard.xml</code> vendor (<code>speed_max=5</code>,
        <code>brightness_max=5</code>) — ini batas yang didokumentasikan
        vendor, bukan yang sudah diuji langsung di unit ini. Yang terbukti
        langsung di hardware baru nilai UI 2 (byte kabel 3); lihat tombol
        &quot;Kirim nilai vendor (referensi)&quot; di bawah untuk titik lain
        yang juga terbukti.
      </p>

      <label className="flex items-center justify-between gap-4">
        <span className="label">Kecepatan (payload[10])</span>
        <input type="number" min={0} max={4} value={l.speed}
               onChange={(e) => set({ speed: Number(e.target.value) })}
               className="field num w-24" />
      </label>

      <label className="flex items-center justify-between gap-4">
        <span className="label">Kecerahan (payload[9])</span>
        <input type="number" min={0} max={4} value={l.brightness}
               onChange={(e) => set({ brightness: Number(e.target.value) })}
               className="field num w-24" />
      </label>

      <label className="flex items-center justify-between gap-4">
        <span className="label">Arah</span>
        <select value={String(l.direction)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isInteger(v)) return;
                  set({ direction: v });
                }}
                className="field w-40">
          {DIRECTION_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>

      <button onClick={onApply}
              className="btn btn-primary">
        Terapkan pencahayaan
      </button>

      <div className="flex flex-col gap-1 border-t border-[var(--edge)] pt-4">
        <button onClick={onApplyVendorReference}
                className="btn justify-center py-2">
          Kirim nilai vendor (referensi)
        </button>
        <p className="text-[11px] leading-relaxed text-[var(--ink-3)]">
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
