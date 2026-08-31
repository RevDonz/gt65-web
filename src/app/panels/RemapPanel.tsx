import { useState } from 'react';
import type { ReactNode } from 'react';
import { KeyboardGrid, BINDING_TAGS } from '../KeyboardGrid';
import { KEYS } from '../../gt65/layout';
import {
  MEDIA_ACTIONS, MOUSE_ACTIONS, SHORTCUTS, HID_KEYS, HID_KEY_GROUPS,
  MOD_NAMES, entriesEqual,
} from '../../gt65/keycodes';
import type { Entry, Layer } from '../../gt65/protocol';
import { defaultProfile } from '../../store/profile';
import type { Profile } from '../../store/profile';

/**
 * Pemetaan bawaan tiap tombol per layer — dipakai KeyboardGrid untuk aksen
 * "berubah dari bawaan" dan tombol "Kembalikan ke default" di bawah. Dibaca
 * dari `defaultProfile()` (store/profile.ts) alih-alih diturunkan ulang di
 * sini, supaya tetap satu sumber kebenaran dengan jalur pemulihan pabrik.
 * Aman dihitung sekali di scope modul: `defaultProfile()` murni dan tidak
 * bergantung pada state apa pun.
 */
const DEFAULT_LAYERS = defaultProfile().layers;

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

/**
 * Ringkasan binding yang sedang berlaku, ditampilkan di kepala inspektur.
 * Papan ini tidak bisa dibaca balik, jadi satu-satunya cara pengguna tahu
 * apa yang akan tertulis adalah membacanya di sini sebelum menekan
 * "Terapkan".
 */
export function describeEntry(entry: Entry | undefined): string {
  if (!entry) return 'kosong';
  switch (entry.kind) {
    case 'none': return 'nonaktif';
    case 'key': {
      const label = HID_KEYS.find((k) => k.usage === entry.usage)?.label
        ?? `usage 0x${entry.usage.toString(16)}`;
      const mods = MOD_NAMES.filter(([bit]) => entry.mod & bit).map(([, n]) => n);
      return [...mods, label].join(' + ');
    }
    case 'media':
      return MEDIA_ACTIONS.find((a) => a.entry.kind === 'media'
        && a.entry.usage === entry.usage)?.label ?? `multimedia 0x${entry.usage.toString(16)}`;
    case 'mouse':
      return MOUSE_ACTIONS.find((a) => a.entry.kind === 'mouse'
        && a.entry.ev === entry.ev && a.entry.val === entry.val)?.label ?? 'mouse';
    case 'macro':
      return `makro slot ${entry.slot}`;
  }
}

export function RemapPanel({ profile, onChange, onApply }: {
  profile: Profile;
  onChange: (p: Profile) => void;
  onApply: (layer: Layer) => void;
}) {
  const [layer, setLayer] = useState<Layer>('top');
  const [selected, setSelected] = useState<number | null>(null);
  const entries = profile.layers[layer];
  const defaultEntries = DEFAULT_LAYERS[layer];
  const key = selected === null ? undefined : KEYS.find((k) => k.keyIndex === selected);
  const isModified = selected !== null
    && !entriesEqual(entries[selected], defaultEntries[selected]);

  const assign = (e: Entry) => {
    if (selected === null) return;
    const next = [...entries];
    next[selected] = e;
    onChange({ ...profile, layers: { ...profile.layers, [layer]: next } });
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-[3px] border border-[var(--edge-bright)]">
          {(['top', 'fn'] as Layer[]).map((l) => (
            <button key={l} onClick={() => setLayer(l)}
                    aria-pressed={layer === l}
                    className="px-3 py-1.5 text-[12px] font-medium"
                    style={layer === l
                      ? { background: 'var(--panel-2)', color: 'var(--ink)' }
                      : { background: 'transparent', color: 'var(--ink-3)' }}>
              {l === 'top' ? 'Layer utama' : 'Layer Fn'}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-[var(--ink-3)]">
          {selected === null
            ? 'Klik satu tombol untuk mengubah fungsinya.'
            : 'Pilih fungsi baru di kolom kanan.'}
        </span>
        <button className="btn btn-primary ml-auto" onClick={() => onApply(layer)}>
          Terapkan layer ini
        </button>
      </div>

      {/*
        Papan tetap terlihat sewaktu memilih fungsi: pemilih duduk sebagai
        kolom kanan, bukan di bawah papan. Di viewport sempit ia jatuh ke
        bawah papan seperti biasa.
      */}
      <div className={`grid gap-4 ${
        selected === null ? '' : 'lg:grid-cols-[minmax(0,1fr)_330px]'}`}>
        <div className="flex flex-col gap-3">
          <KeyboardGrid entries={entries} defaultEntries={defaultEntries}
                        selected={selected} onSelect={setSelected} />
          <div className="flex flex-wrap items-center gap-4">
            {BINDING_TAGS.map((t) => (
              <span key={t.kind} className="flex items-center gap-1.5 text-[10px]
                                            text-[var(--ink-3)]">
                <span className="h-[5px] w-[5px] rounded-full"
                      style={{ background: t.color }} />
                {t.label}
              </span>
            ))}
            <span className="text-[10px] text-[var(--ink-3)]">
              tanpa titik · tombol biasa
            </span>
          </div>
        </div>

        {selected !== null && (
          <aside className="panel flex max-h-[70vh] flex-col overflow-y-auto">
            <div className="sticky top-0 flex items-baseline gap-2 border-b
                            border-[var(--edge)] bg-[var(--panel)] px-3 py-2.5">
              <span className="text-[13px] font-semibold">{key?.name ?? '?'}</span>
              <span className="num text-[10px] text-[var(--ink-3)]">
                idx {selected}
              </span>
              <button className="btn btn-quiet ml-auto px-2 py-0.5 text-[11px]"
                      onClick={() => setSelected(null)}>Tutup</button>
            </div>
            <div className="px-3 py-2 text-[11px] text-[var(--ink-2)]">
              Sekarang: <span style={{ color: 'var(--ink)' }}>
                {describeEntry(entries[selected])}
              </span>
            </div>

            <div className="flex flex-col gap-4 px-3 pb-4">
              <Group title="Tombol">
                <select value={keySelectValue(entries[selected])}
                        onChange={(e) => {
                          const usage = parseKeyChoice(e.target.value);
                          if (usage === null) return;
                          assign({ kind: 'key', mod: 0, usage });
                        }}
                        className="field w-full">
                  <option value="">— pilih —</option>
                  {HID_KEY_GROUPS.map((g) => (
                    <optgroup key={g.id} label={g.label}>
                      {g.keys.map((k) => (
                        <option key={k.usage} value={k.usage}>{k.label}</option>
                      ))}
                    </optgroup>
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
              </Group>
              <Group title="Lainnya">
                <Btn onClick={() => assign({ kind: 'none' })}>Nonaktifkan</Btn>
                {/*
                  Ini yang dibutuhkan pengguna saat tidak bisa mengembalikan
                  titik-koma: bawaan tombol ini sudah diketahui aplikasi dari
                  layout.ts, jadi tidak perlu dicari lagi lewat dropdown.
                  Nonaktif kalau tombol memang masih bawaan — tidak ada apa
                  pun untuk dikembalikan.
                */}
                <Btn disabled={!isModified}
                     onClick={() => assign(defaultEntries[selected as number])}>
                  Kembalikan ke default
                </Btn>
              </Group>
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="label">{title}</h3>
      {children}
    </div>
  );
}

function Btn({ onClick, children, disabled }: {
  onClick: () => void; children: ReactNode; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
            className="btn justify-start text-left font-normal">
      {children}
    </button>
  );
}
