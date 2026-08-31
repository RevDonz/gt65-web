import { useState } from 'react';
import type { ReactNode } from 'react';
import { KeyboardGrid } from '../KeyboardGrid';
import { MEDIA_ACTIONS, MOUSE_ACTIONS, SHORTCUTS, HID_KEYS } from '../../gt65/keycodes';
import type { Entry, Layer } from '../../gt65/protocol';
import type { Profile } from '../../store/profile';

/**
 * Nilai yang harus ditampilkan dropdown tombol untuk entri yang sedang
 * dipilih. Tanpa ini `<select>` menjadi tak terkendali: memilih "A" untuk
 * tombol 1, lalu klik tombol 2 dan memilih "A" lagi tidak memicu `change`
 * sama sekali, sehingga tombol 2 tetap memakai binding lamanya sementara
 * UI menampilkan "A". Pada keyboard yang tidak bisa dibaca balik, selisih
 * antara yang ditampilkan dan yang ditulis tidak akan pernah ketahuan.
 *
 * Dropdown hanya bisa menyatakan tombol biasa tanpa modifier; entri jenis
 * lain (shortcut ber-modifier, multimedia, mouse, makro, kosong) tidak
 * punya opsi yang cocok sehingga jatuh ke plakat kosong.
 */
export function keySelectValue(entry: Entry | undefined): string {
  if (!entry || entry.kind !== 'key' || entry.mod !== 0) return '';
  return HID_KEYS.some((k) => k.usage === entry.usage) ? String(entry.usage) : '';
}

/**
 * Terjemahkan pilihan dropdown menjadi usage, atau `null` kalau bukan
 * pilihan tombol. Dua jebakan yang keduanya berakhir sebagai usage 0 yang
 * tertulis ke perangkat: `Number('— pilih —')` bernilai `NaN` yang
 * di-mask `encodeEntry` menjadi 0, dan `Number('')` memang bernilai 0.
 */
export function parseKeyChoice(raw: string): number | null {
  if (raw === '') return null;
  const usage = Number(raw);
  return Number.isInteger(usage) ? usage : null;
}

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
            <select value={keySelectValue(entries[selected])}
                    onChange={(e) => {
                      const usage = parseKeyChoice(e.target.value);
                      if (usage === null) return;
                      assign({ kind: 'key', mod: 0, usage });
                    }}
                    className="w-full rounded bg-slate-800 px-2 py-1">
              <option value="">— pilih —</option>
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
