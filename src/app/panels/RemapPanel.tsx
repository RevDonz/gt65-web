import { useState } from 'react';
import type { ReactNode } from 'react';
import { KeyboardGrid } from '../KeyboardGrid';
import { MEDIA_ACTIONS, MOUSE_ACTIONS, SHORTCUTS, HID_KEYS } from '../../gt65/keycodes';
import type { Entry, Layer } from '../../gt65/protocol';
import type { Profile } from '../../store/profile';

export function RemapPanel({ profile, onChange, onApply }: {
  profile: Profile;
  onChange: (p: Profile) => void;
  onApply: (layer: Layer) => void;
}) {
  const [layer, setLayer] = useState<Layer>('top');
  const [selected, setSelected] = useState<number | null>(null);
  const entries = profile.layers[layer];

  const assign = (e: Entry) => {
    if (selected === null) return;
    const next = [...entries];
    next[selected] = e;
    onChange({ ...profile, layers: { ...profile.layers, [layer]: next } });
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="flex gap-2">
        {(['top', 'fn'] as Layer[]).map((l) => (
          <button key={l} onClick={() => setLayer(l)}
                  className={`rounded px-3 py-1 ${
                    layer === l ? 'bg-slate-700' : 'hover:bg-slate-800'}`}>
            {l === 'top' ? 'Layer utama' : 'Layer Fn'}
          </button>
        ))}
        <button onClick={() => onApply(layer)}
                className="ml-auto rounded bg-emerald-700 px-4 py-2 hover:bg-emerald-600">
          Terapkan layer ini
        </button>
      </div>

      <KeyboardGrid entries={entries} selected={selected} onSelect={setSelected} />

      {selected === null ? (
        <p className="text-slate-400">Klik satu tombol untuk mengubah fungsinya.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-4">
          <Group title="Tombol">
            <select onChange={(e) => assign({
                      kind: 'key', mod: 0, usage: Number(e.target.value) })}
                    className="w-full rounded bg-slate-800 px-2 py-1">
              <option>— pilih —</option>
              {HID_KEYS.map((k) => (
                <option key={k.usage} value={k.usage}>{k.label}</option>
              ))}
            </select>
          </Group>
          <Group title="Shortcut">
            {SHORTCUTS.map((a) => (
              <Btn key={a.id} onClick={() => assign(a.entry)}>{a.label}</Btn>
            ))}
          </Group>
          <Group title="Multimedia">
            {MEDIA_ACTIONS.map((a) => (
              <Btn key={a.id} onClick={() => assign(a.entry)}>{a.label}</Btn>
            ))}
          </Group>
          <Group title="Mouse">
            {MOUSE_ACTIONS.map((a) => (
              <Btn key={a.id} onClick={() => assign(a.entry)}>{a.label}</Btn>
            ))}
            <Btn onClick={() => assign({ kind: 'none' })}>Nonaktifkan</Btn>
          </Group>
        </div>
      )}
    </section>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs uppercase tracking-wide text-slate-400">{title}</h3>
      {children}
    </div>
  );
}

function Btn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick}
            className="rounded bg-slate-800 px-2 py-1 text-left hover:bg-slate-700">
      {children}
    </button>
  );
}
