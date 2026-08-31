import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { KEYS, LAYOUT_SIZE } from '../gt65/layout';
import type { Entry } from '../gt65/protocol';

/**
 * Penanda jenis binding. Sengaja hanya setitik 4px di pojok muka keycap,
 * bukan mewarnai seluruh tombol: papan ini punya 66 tombol dan mewarnai
 * semuanya membuat panel terlihat seperti kembang api, bukan instrumen.
 * Jenis 'key' (mayoritas mutlak) sengaja tanpa titik sama sekali.
 */
export const BINDING_TAGS: { kind: Entry['kind']; label: string; color: string }[] = [
  { kind: 'none',  label: 'Nonaktif',   color: 'var(--crit)' },
  { kind: 'media', label: 'Multimedia', color: 'var(--ok)' },
  { kind: 'mouse', label: 'Mouse',      color: 'var(--warn)' },
  { kind: 'macro', label: 'Makro',      color: 'var(--ink-2)' },
];

const TAG_COLOR = new Map(BINDING_TAGS.map((t) => [t.kind, t.color]));

/**
 * Usage yang dibawa tombol Fn di KeyboardLayout.xml vendor. 0xAF adalah
 * *Reserved* di HID Keyboard usage page, jadi ini penanda internal vendor,
 * bukan usage HID sungguhan — lihat doc comment `defaultProfile()`.
 */
export const FN_USAGE = 0xaf;

/**
 * Fn tidak bisa dipilih untuk dipetakan ulang. Ia satu-satunya jalan ke
 * layer Fn: memetakannya ke fungsi lain menghilangkan akses ke layer yang
 * justru dibutuhkan untuk memperbaikinya, dan keyboard ini tidak bisa
 * dibaca balik sehingga tidak ada cara memeriksa apa yang sebenarnya
 * tertulis. Selain itu encoding Fn sendiri (`usage: 0xAF`) belum
 * terverifikasi, jadi menulis ulang slot itu adalah taruhan.
 *
 * "Pulihkan bawaan" tetap menulis ulang slot ini, jadi pemulihan lewat
 * aplikasi tidak terhalang.
 *
 * Penguncian ini HANYA berlaku di Remap. Di tab Tester tombol Fn tetap
 * digambar sebagai keycap biasa dan tetap bisa menyala kalau sistem
 * operasi memang melaporkannya — menguncinya di sana tidak ada gunanya
 * karena tidak ada yang ditulis ke perangkat.
 */
export function isRemappable(usage: number): boolean {
  return usage !== FN_USAGE;
}

/**
 * Indeks baris fisik tiap koordinat y, untuk jeda bertahap saat papan
 * muncul. Dihitung dari `layout.ts` (bukan daftar tulisan tangan) dengan
 * toleransi 20px, karena baris paling bawah memuat dua nilai y yang
 * berbeda tipis: tombol panah duduk 2px lebih tinggi dari sisanya.
 */
const ROW_BY_Y: Map<number, number> = (() => {
  const ys = [...new Set(KEYS.map((k) => k.y))].sort((a, b) => a - b);
  const heads: number[] = [];
  for (const y of ys) {
    if (heads.length === 0 || y - heads[heads.length - 1] > 20) heads.push(y);
  }
  return new Map(ys.map((y) => [
    y, heads.reduce((best, head, i) => (y >= head ? i : best), 0),
  ]));
})();

export function rowIndex(y: number): number {
  return ROW_BY_Y.get(y) ?? 0;
}

/**
 * Papan sebagai elemen utama halaman: melebar penuh mengikuti kolom isi,
 * tapi tetap mempertahankan rasio 800×300 dari `LAYOUT_SIZE` lewat
 * penskalaan, bukan dijejalkan ke kotak kecil. Koordinat tiap tombol
 * tetap dipakai apa adanya dalam piksel layout; hanya wadahnya yang
 * diskalakan, sehingga tidak ada perhitungan posisi yang perlu diubah.
 */
function useFitScale() {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / LAYOUT_SIZE.width);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, scale };
}

export type KeyboardGridProps = {
  /** Binding per keyIndex; kosong di Tester yang tidak menampilkan binding. */
  entries?: Entry[];
  /** keyIndex yang sedang dipilih di Remap. */
  selected?: number | null;
  /** Tanpa ini papan hanya tampilan (Tester), tidak bisa diklik. */
  onSelect?: (keyIndex: number) => void;
  /** Usage yang tombolnya sedang ditahan (Tester). */
  heldUsages?: ReadonlySet<number>;
  /** Usage yang pernah terlihat sejak reset terakhir (Tester). */
  seenUsages?: ReadonlySet<number>;
  /** Jeda bertahap per baris saat papan muncul. */
  reveal?: boolean;
};

export function KeyboardGrid({
  entries, selected = null, onSelect,
  heldUsages, seenUsages, reveal = true,
}: KeyboardGridProps) {
  const { ref, scale } = useFitScale();
  const interactive = onSelect !== undefined;

  return (
    <div ref={ref} className="kb-stage relative w-full max-w-[1100px]"
         data-reveal={reveal ? 'on' : 'off'}
         style={{ aspectRatio: `${LAYOUT_SIZE.width} / ${LAYOUT_SIZE.height}` }}>
      <div className="absolute left-0 top-0"
           style={{
             width: LAYOUT_SIZE.width, height: LAYOUT_SIZE.height,
             transform: `scale(${scale})`, transformOrigin: 'top left',
           }}>
        {KEYS.map((k) => {
          const e = entries?.[k.keyIndex] ?? { kind: 'none' as const };
          const tag = entries ? TAG_COLOR.get(e.kind) : undefined;
          const locked = interactive && !isRemappable(k.usage);
          const held = heldUsages?.has(k.usage) ?? false;
          const seen = !held && (seenUsages?.has(k.usage) ?? false);
          return (
            <button key={k.keyIndex} type="button"
              onClick={interactive && !locked ? () => onSelect(k.keyIndex) : undefined}
              disabled={!interactive || locked}
              aria-pressed={interactive ? selected === k.keyIndex : undefined}
              title={locked
                ? 'Fn tidak bisa dipetakan ulang: ia satu-satunya jalan ke '
                  + 'layer Fn, dan keyboard ini tidak bisa dibaca balik untuk '
                  + 'memeriksa hasilnya.'
                : `${k.name} · usage 0x${k.usage.toString(16).padStart(2, '0')}`}
              className="kc"
              data-interactive={interactive && !locked}
              data-selected={interactive && selected === k.keyIndex}
              data-locked={locked}
              data-held={held}
              data-seen={seen}
              style={{
                left: k.x, top: k.y, width: k.w, height: k.h,
                '--row': rowIndex(k.y),
              } as CSSProperties}>
              <span className="kc-face">
                <span className="kc-legend">{k.name}</span>
                {tag && <span className="kc-tag" style={{ background: tag }} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
