import { KEYS, LAYOUT_SIZE } from '../gt65/layout';
import type { Entry } from '../gt65/protocol';

const TAG_COLOR: Record<string, string> = {
  none: 'bg-slate-800', key: 'bg-slate-700', media: 'bg-indigo-800',
  mouse: 'bg-amber-800', macro: 'bg-fuchsia-800',
};

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
        return (
          <button key={k.keyIndex} onClick={() => onSelect(k.keyIndex)}
            style={{ left: k.x, top: k.y, width: k.w, height: k.h }}
            className={`absolute rounded text-[10px] leading-tight ${
              TAG_COLOR[e.kind]} ${
              isSel ? 'ring-2 ring-emerald-400' : 'hover:brightness-125'}`}>
            {k.name}
          </button>
        );
      })}
    </div>
  );
}
