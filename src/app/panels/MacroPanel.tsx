import { useEffect, useRef, useState } from 'react';
import type { Profile } from '../../store/profile';
import { MACRO_BYTES, MACRO_SLOTS, macroBytes, macroPreview, parseMacros } from '../../gt65/macros';
import type { Macro, MacroEvent } from '../../gt65/macros';
import { HID_KEYS } from '../../gt65/keycodes';
import { usageForCode } from '../../gt65/keyevents';
import { downloadJson } from '../download';

export function MacroPanel({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  const macros = profile.macros ?? [];
  const [slot, setSlot] = useState<number | null>(macros[0]?.slot ?? null);
  const [recording, setRecording] = useState(false);
  const [delayMode, setDelayMode] = useState('measured');
  const [interval, setIntervalMs] = useState(10);
  const [eventKind, setEventKind] = useState('key');
  const [value, setValue] = useState(4);
  const [down, setDown] = useState(true);
  const [eventIndex, setEventIndex] = useState<number | null>(null);
  const [placement, setPlacement] = useState('end');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const selected = macros.find((m) => m.slot === slot);
  const current = useRef({ macros, profile, onChange });
  current.current = { macros, profile, onChange };
  const update = (next: Macro[]) => {
    try { const validated = parseMacros(next); onChange({ ...profile, macros: validated }); setError(null); return true; }
    catch (e) { setError(String(e)); return false; }
  };
  const updateEvents = (events: MacroEvent[]) => update(macros.map((m) => m.slot === slot ? { ...m, events } : m));
  const create = (source?: Macro) => {
    const free = Array.from({ length: MACRO_SLOTS }, (_, i) => i).find((i) => !macros.some((m) => m.slot === i));
    if (free === undefined) return;
    if (update([...macros, { slot: free, name: source ? `${source.name} (salinan)` : `Makro ${free + 1}`, events: source ? structuredClone(source.events) : [] }])) setSlot(free);
  };
  useEffect(() => {
    if (!recording || slot === null) return;
    const source = current.current.macros.find((m) => m.slot === slot);
    if (!source) return;
    let events = [...source.events];
    const held = new Set<number>();
    let last: number | null = null;
    const persist = () => {
      const c = current.current;
      c.onChange({ ...c.profile, macros: c.macros.map((m) => m.slot === slot ? { ...m, events: [...events] } : m) });
    };
    const handle = (ev: KeyboardEvent) => {
      if (ev.code === 'Escape') { ev.preventDefault(); setRecording(false); return; }
      ev.preventDefault();
      if (ev.repeat) return;
      const usage = usageForCode(ev.code);
      if (usage === null || usage === 0) return;
      const isDown = ev.type === 'keydown';
      if (isDown === held.has(usage)) return;
      const nextHeld = new Set(held);
      if (isDown) nextHeld.add(usage); else nextHeld.delete(usage);
      const additions: MacroEvent[] = [];
      const now = performance.now();
      if (last !== null && delayMode !== 'none') additions.push({ kind: 'delay', ms: delayMode === 'fixed' ? interval : Math.min(65535, Math.round(now - last)) });
      additions.push({ kind: 'key', down: isDown, value: usage });
      const next = [...events, ...additions];
      // Reserve release events so stopping/blur cannot leave recorded keys held.
      const reserve: MacroEvent[] = [...nextHeld].map((v) => ({ kind: 'key', down: false, value: v }));
      try { parseMacros(current.current.macros.map((m) => m.slot === slot ? { ...m, events: [...next, ...reserve] } : m)); }
      catch { setError('Rekaman berhenti: kapasitas makro penuh.'); setRecording(false); return; }
      events = next; held.clear(); nextHeld.forEach((v) => held.add(v)); last = now; persist();
    };
    const blur = () => setRecording(false);
    window.addEventListener('keydown', handle); window.addEventListener('keyup', handle); window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', handle); window.removeEventListener('keyup', handle); window.removeEventListener('blur', blur);
      if (held.size) { events = [...events, ...[...held].map((v): MacroEvent => ({ kind: 'key', down: false, value: v }))]; persist(); }
    };
  }, [recording, slot, delayMode, interval]);
  const insert = () => {
    if (!selected) return;
    const event: MacroEvent = eventKind === 'delay' ? { kind: 'delay', ms: value } : { kind: eventKind as 'key' | 'mouse', value, down };
    const next = [...selected.events];
    const index = eventIndex !== null && eventIndex < next.length ? eventIndex : null;
    if (placement === 'replace' && index !== null) next[index] = event;
    else next.splice(placement === 'end' || index === null ? next.length : index + (placement === 'after' ? 1 : 0), 0, event);
    if (updateEvents(next)) setEventIndex(null);
  };
  return <section className="flex flex-col gap-4">
    <div className="panel p-4"><strong>Editor makro · tersimpan lokal</strong><p className="text-[12px] text-[var(--ink-3)] mt-1">Rekam, susun, dan ekspor urutan tombol. Upload serta pengikatan ke tombol belum diaktifkan: mode putar pada firmware masih perlu diverifikasi. Pratinjau paket tidak dikirim ke keyboard.</p></div>
    <div className="flex flex-wrap gap-3 items-center"><span className="pill">{macros.length} / 100 slot</span><span className="num">{macroBytes(macros)} / {MACRO_BYTES} byte</span><progress aria-label="Kapasitas makro" max={MACRO_BYTES} value={macroBytes(macros)} /><button className="btn btn-primary ml-auto" disabled={recording || macros.length >= 100} onClick={() => create()}>Makro baru</button><button className="btn" disabled={recording} onClick={() => file.current?.click()}>Impor makro</button></div>
    <input ref={file} hidden type="file" accept="application/json" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { const raw = JSON.parse(await f.text()); if (raw.format !== 'gt65-macro' || raw.version !== 1) throw new Error('Format makro tidak didukung.'); const [m] = parseMacros([raw.macro]); create(m); } catch (err) { setError(String(err)); } }} />
    {error && <p role="alert" className="text-[var(--crit)]">{error}</p>}
    <div className="macro-layout"><aside className="panel p-3 flex flex-col gap-2">{macros.length === 0 && <p className="p-3 text-[var(--ink-3)]">Belum ada makro.</p>}{macros.map((m) => <button key={m.slot} className="btn justify-start" disabled={recording} aria-pressed={slot === m.slot} onClick={() => { setSlot(m.slot); setEventIndex(null); setConfirmDelete(false); }}>{m.name} · {m.events.length} event</button>)}</aside>
    {selected ? <div className="panel p-5 flex flex-col gap-4">
      <div className="flex flex-wrap gap-2"><input aria-label="Nama makro" className="field flex-1 min-w-0" value={selected.name} disabled={recording} maxLength={80} onChange={(e) => { if (e.target.value.trim()) update(macros.map((m) => m.slot === slot ? { ...m, name: e.target.value } : m)); }} /><button className="btn" disabled={recording} onClick={() => create(selected)}>Duplikat</button><button className="btn" disabled={recording} onClick={() => downloadJson('gt65-macro.json', { format: 'gt65-macro', version: 1, macro: selected })}>Ekspor</button><button className="btn" disabled={recording} onClick={() => setConfirmDelete(true)}>Hapus makro</button></div>
      {confirmDelete && <div className="well p-3">Hapus “{selected.name}”? <button className="btn" onClick={() => { const next = macros.filter((m) => m.slot !== slot); if (update(next)) { setSlot(next[0]?.slot ?? null); setConfirmDelete(false); } }}>Ya, hapus</button> <button className="btn" onClick={() => setConfirmDelete(false)}>Batal</button></div>}
      <div className="flex flex-wrap gap-2 items-center"><label>Jeda <select className="field" disabled={recording} value={delayMode} onChange={(e) => setDelayMode(e.target.value)}><option value="measured">Sesuai rekaman</option><option value="none">Tanpa jeda</option><option value="fixed">Jeda tetap</option></select></label>{delayMode === 'fixed' && <input aria-label="Jeda tetap milidetik" type="number" className="field w-24" min={0} max={65535} disabled={recording} value={interval} onChange={(e) => setIntervalMs(Math.max(0, Math.min(65535, Math.round(Number(e.target.value)))))} />}<button className="btn btn-primary" onClick={() => { setEventIndex(null); setPlacement('end'); setRecording(!recording); }}>{recording ? 'Hentikan rekaman' : 'Rekam keyboard'}</button></div>
      <p className="text-[11px] text-[var(--ink-3)]">{recording ? 'Merekam tombol. Tekan Esc untuk berhenti. Rekaman juga berhenti ketika jendela kehilangan fokus.' : 'Rekaman ditambahkan di akhir. Tombol mouse dan Esc dapat dimasukkan melalui editor event.'}</p>
      <fieldset disabled={recording} className="flex flex-wrap gap-2"><legend className="label mb-2">Editor event</legend><select aria-label="Posisi event" className="field" value={placement} onChange={(e) => setPlacement(e.target.value)}><option value="end">Tambah di akhir</option><option value="before" disabled={eventIndex === null}>Sebelum pilihan</option><option value="after" disabled={eventIndex === null}>Setelah pilihan</option><option value="replace" disabled={eventIndex === null}>Ubah pilihan</option></select><select aria-label="Jenis event" className="field" value={eventKind} onChange={(e) => { setEventKind(e.target.value); setValue(e.target.value === 'key' ? 4 : e.target.value === 'mouse' ? 1 : 10); }}><option value="key">Keyboard</option><option value="mouse">Mouse</option><option value="delay">Jeda</option></select>
      {eventKind === 'delay' ? <input aria-label="Jeda event milidetik" type="number" className="field w-28" min={0} max={65535} value={value} onChange={(e) => setValue(Number(e.target.value))} /> : <><select aria-label="Tombol event" className="field" value={value} onChange={(e) => setValue(Number(e.target.value))}>{eventKind === 'key' ? HID_KEYS.map((k) => <option key={k.usage} value={k.usage}>{k.label}</option>) : [[1,'Kiri'],[2,'Kanan'],[4,'Tengah'],[8,'Tombol 4'],[16,'Tombol 5']].map(([v,n]) => <option key={v} value={v}>{n}</option>)}</select><select aria-label="Aksi event" className="field" value={down ? 'down' : 'up'} onChange={(e) => setDown(e.target.value === 'down')}><option value="down">Tekan</option><option value="up">Lepas</option></select></>}
      <button className="btn" disabled={placement !== 'end' && eventIndex === null} onClick={insert}>{placement === 'replace' ? 'Simpan event' : 'Tambah event'}</button></fieldset>
      <ol className="macro-events">{selected.events.map((e, i) => <li key={i} data-selected={eventIndex === i}><button className="btn btn-quiet" aria-label={`Pilih event ${i + 1}`} disabled={recording} onClick={() => { setEventIndex(i); setEventKind(e.kind); setValue(e.kind === 'delay' ? e.ms : e.value); if (e.kind !== 'delay') setDown(e.down); }}><span className="num">{i + 1}</span></button><span>{e.kind === 'delay' ? `Jeda ${e.ms} ms` : `${e.down ? 'Tekan' : 'Lepas'} ${e.kind === 'mouse' ? `mouse ${e.value}` : HID_KEYS.find((k) => k.usage === e.value)?.label ?? e.value}`}</span><div className="ml-auto flex gap-1"><button aria-label={`Naikkan event ${i + 1}`} className="btn" disabled={recording || i === 0} onClick={() => { const next = [...selected.events]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; updateEvents(next); }}>↑</button><button aria-label={`Turunkan event ${i + 1}`} className="btn" disabled={recording || i === selected.events.length - 1} onClick={() => { const next = [...selected.events]; [next[i + 1], next[i]] = [next[i], next[i + 1]]; updateEvents(next); }}>↓</button><button aria-label={`Hapus event ${i + 1}`} className="btn" disabled={recording} onClick={() => { if (updateEvents(selected.events.filter((_, j) => j !== i))) setEventIndex(null); }}>×</button></div></li>)}</ol>
      <button className="btn" disabled={recording} onClick={() => downloadJson('gt65-macro-packet-preview.json', { experimental: true, note: 'Pratinjau encoder, bukan bukti hardware. Tidak dikirim ke keyboard.', packets: macroPreview(macros).map((p) => Array.from(p)) })}>Unduh pratinjau paket (eksperimental)</button>
    </div> : <div className="empty-state"><strong>Susun urutan kerja Anda</strong><p>Buat makro untuk mulai merekam tombol atau menambahkan event secara manual.</p></div>}</div>
  </section>;
}
