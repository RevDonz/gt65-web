import { KEYS, LAYOUT_SIZE } from '../gt65/layout';
import type { Entry } from '../gt65/protocol';

const TAG_COLOR: Record<string, string> = {
  none: 'bg-slate-800', key: 'bg-slate-700', media: 'bg-indigo-800',
  mouse: 'bg-amber-800', macro: 'bg-fuchsia-800',
};

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
 */
export function isRemappable(usage: number): boolean {
  return usage !== FN_USAGE;
}

export function KeyboardGrid({ entries, selected, onSelect }: {
  entries: Entry[];
  selected: number | null;
  onSelect: (keyIndex: number) => void;
}) {
  return (
    <div className="relative mx-auto"
         style={{ width: LAYOUT_SIZE.width, height: LAYOUT_SIZE.height }}>
      {KEYS.map((k) => {
        const e = entries[k.keyIndex] ?? { kind: 'none' };
        const isSel = selected === k.keyIndex;
        const locked = !isRemappable(k.usage);
        return (
          <button key={k.keyIndex} onClick={() => onSelect(k.keyIndex)}
            disabled={locked}
            title={locked
              ? 'Fn tidak bisa dipetakan ulang: ia satu-satunya jalan ke '
                + 'layer Fn, dan keyboard ini tidak bisa dibaca balik untuk '
                + 'memeriksa hasilnya.'
              : undefined}
            style={{ left: k.x, top: k.y, width: k.w, height: k.h }}
            className={`absolute rounded text-[10px] leading-tight ${
              TAG_COLOR[e.kind]} ${
              locked
                ? 'cursor-not-allowed border border-dashed border-slate-600 opacity-50'
                : isSel ? 'ring-2 ring-emerald-400' : 'hover:brightness-125'}`}>
            {k.name}
          </button>
        );
      })}
    </div>
  );
}
