import { useRef, useState } from 'react';
import { KeyboardGrid } from '../KeyboardGrid';
import { KEYS } from '../../gt65/layout';
import { defaultColors, parseColors } from '../../gt65/perKey';
import type { RGB } from '../../gt65/perKey';
import type { Profile } from '../../store/profile';
import { downloadJson } from '../download';

export function PerKeyPanel({ profile, onChange, onApply }: {
  profile: Profile; onChange: (p: Profile) => void; onApply: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [color, setColor] = useState('#ae94ff');
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const colors = profile.perKeyColors ?? defaultColors();
  const setColors = (next: RGB[]) => onChange({ ...profile, perKeyColors: next });
  const group = (type: string) => setSelected(new Set(KEYS.filter((k) => type === 'all' || (type === 'wasd' ? ['W', 'A', 'S', 'D'].includes(k.name) : k.usage >= 0x1e && k.usage <= 0x27)).map((k) => k.keyIndex)));
  const paint = (rgb: RGB) => {
    const indices = new Set(KEYS.filter((k) => selected.has(k.keyIndex)).map((k) => k.lightIndex));
    setColors(colors.map((c, i) => indices.has(i) ? [...rgb] : c));
  };
  return <section className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center gap-2"><button className="btn" onClick={() => group('all')}>Pilih semua</button><button className="btn" onClick={() => group('wasd')}>WASD</button><button className="btn" onClick={() => group('number')}>Angka</button><button className="btn btn-quiet" onClick={() => setSelected(new Set())}>Hapus pilihan</button><span className="pill">{selected.size} tombol dipilih</span></div>
    <div className="keyboard-card"><div className="keyboard-card-heading"><strong>RGB per tombol</strong><span className="pill">Pratinjau warna</span></div><div className="keyboard-canvas"><KeyboardGrid colors={colors} selectedKeys={selected} allowFn onSelect={(index) => setSelected((prev) => { const next = new Set(prev); if (next.has(index)) next.delete(index); else next.add(index); return next; })} /></div></div>
    <div className="panel p-5 flex flex-wrap items-center gap-4"><label className="flex items-center gap-3"><span>Warna kuas</span><input aria-label="Warna kuas" type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label><span className="num">{color}</span><button className="btn" disabled={!selected.size} onClick={() => paint([parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)])}>Warnai pilihan</button><button className="btn" disabled={!selected.size} onClick={() => paint([0, 0, 0])}>Matikan pilihan</button><button className="btn btn-primary ml-auto" onClick={onApply}>Terapkan RGB per tombol</button></div>
    <div className="flex flex-wrap gap-2"><button className="btn" onClick={() => downloadJson('gt65-rgb.json', { format: 'gt65-rgb', version: 1, colors })}>Ekspor skema RGB</button><button className="btn" onClick={() => file.current?.click()}>Impor skema RGB</button><input ref={file} type="file" accept="application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { const parsed = JSON.parse(await f.text()); if (parsed.format !== 'gt65-rgb' || parsed.version !== 1) throw new Error('Format skema RGB tidak didukung.'); setColors(parseColors(parsed.colors)); setError(null); } catch (err) { setError(String(err)); } }} /></div>
    {error && <p role="alert" className="text-[var(--crit)]">{error}</p>}
    <p className="text-[12px] text-[var(--ink-3)]">Format pengiriman mengikuti encoder vendor; hasil warna pada hardware belum diverifikasi dalam sesi ini. Gunakan mode kering untuk melihat paket. Kembali ke panel Pencahayaan dan terapkan efek untuk meninggalkan mode RGB per tombol. Skema tersimpan bersama profil aktif.</p>
  </section>;
}
