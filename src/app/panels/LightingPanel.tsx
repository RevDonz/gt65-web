import { useRef, useState } from 'react';
import { parseLighting } from '../../store/profile';
import { downloadJson } from '../download';
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
  const file = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const l = profile.lighting;
  const set = (patch: Partial<typeof l>) =>
    onChange({ ...profile, lighting: { ...l, ...patch } });

  const hex = `#${[l.r, l.g, l.b].map((v) =>
    v.toString(16).padStart(2, '0')).join('')}`;

  return (
    <section className="lighting-layout"><div><div className="label mb-3">Studio pencahayaan</div>
      <LightingPreview mode={l.mode} color={hex} speed={l.speed}
                       brightness={l.brightness} direction={l.direction} />
      <div className="effect-grid" aria-label="Pilihan efek">{LIGHT_MODES.map((name, mode) => mode >= LIGHT_MODE_MIN && mode <= LIGHT_MODE_MAX && <button key={mode} className="effect-card" aria-pressed={l.mode === mode} onClick={() => set({ mode })}><span className="effect-sample" style={{ filter: `hue-rotate(${mode * 27}deg)`, opacity: mode === 19 ? .08 : .8 }} />{name}</button>)}</div>
      </div><div className="panel settings-card flex flex-col gap-4"><div className="label">Sesuaikan efek</div>
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
      <p className="text-[11px] text-[var(--ink-3)]">Sebagian efek multiwarna menggunakan palet bawaan dan dapat mengabaikan warna pilihan.</p>
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

      <div className="color-swatches">{['#ae94ff', '#ff6699', '#ff4444', '#ffbb55', '#66ddb0', '#55bbff', '#ffffff'].map((color) => <button key={color} className="color-swatch" aria-label={`Warna ${color}`} aria-pressed={hex === color} style={{ background: color }} onClick={() => set({ r: parseInt(color.slice(1, 3), 16), g: parseInt(color.slice(3, 5), 16), b: parseInt(color.slice(5, 7), 16) })} />)}</div>
      <label className="flex items-center justify-between gap-4">
        <span className="label">Kecepatan · {l.speed + 1}/5</span>
        <input type="range" min={0} max={4} value={l.speed}
               onChange={(e) => set({ speed: Number(e.target.value) })}
               className="w-40" />
      </label>

      <label className="flex items-center justify-between gap-4">
        <span className="label">Kecerahan · {l.brightness + 1}/5</span>
        <input type="range" min={0} max={4} value={l.brightness}
               onChange={(e) => set({ brightness: Number(e.target.value) })}
               className="w-40" />
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

      <details className="advanced-settings"><summary>Diagnostik pencahayaan lanjutan</summary><p className="mb-3">Rentang normal mengikuti dokumentasi vendor. Nilai referensi berikut berada di luar rentang tersebut dan pernah diuji pada hardware.</p>
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
      </details>
      <div className="flex flex-wrap gap-2"><button className="btn" onClick={() => downloadJson('gt65-lighting.json', { format: 'gt65-lighting', version: 1, lighting: l })}>Ekspor efek</button><button className="btn" onClick={() => file.current?.click()}>Impor efek</button></div>
      <input ref={file} type="file" hidden accept="application/json" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { const raw = JSON.parse(await f.text()); if (raw.format !== 'gt65-lighting' || raw.version !== 1) throw new Error('Format efek tidak didukung.'); const next = parseLighting(raw.lighting); if (next.mode < LIGHT_MODE_MIN || next.mode > LIGHT_MODE_MAX || next.speed > 4 || next.brightness > 4 || next.direction > 3) throw new Error('Nilai efek di luar rentang editor yang telah dikalibrasi.'); set(next); setFileError(null); } catch (err) { setFileError(String(err)); } }} />
      {fileError && <p role="alert" className="text-[var(--crit)]">{fileError}</p>}
      </div>
    </section>
  );
}
