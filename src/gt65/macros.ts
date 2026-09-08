import { chunks, cmd } from './protocol';
export type MacroEvent = { kind: 'key' | 'mouse'; down: boolean; value: number } | { kind: 'delay'; ms: number };
export type Macro = { slot: number; name: string; events: MacroEvent[] };
export const MACRO_BYTES = 3584;
export const MACRO_DIRECTORY_BYTES = 400;
export const MACRO_SLOTS = 100;
export function macroBytes(macros: Macro[]): number {
  return MACRO_DIRECTORY_BYTES + macros.reduce((n, m) => n + 8 + m.events.length * 4, 0);
}
export function parseMacros(value: unknown): Macro[] {
  if (!Array.isArray(value) || value.length > MACRO_SLOTS) throw new Error('Maksimum 100 makro.');
  const slots = new Set<number>();
  const macros: Macro[] = value.map((m) => {
    if (!m || !Number.isInteger(m.slot) || m.slot < 0 || m.slot >= MACRO_SLOTS || slots.has(m.slot) || typeof m.name !== 'string' || !m.name.trim() || !Array.isArray(m.events)) throw new Error('Data atau slot makro tidak valid.');
    slots.add(m.slot);
    const events: MacroEvent[] = m.events.map((e: MacroEvent) => {
      if (!e) throw new Error('Event makro tidak valid.');
      if (e.kind === 'delay' && Number.isInteger(e.ms) && e.ms >= 0 && e.ms <= 65535) return { kind: 'delay', ms: e.ms };
      if ((e.kind === 'key' || e.kind === 'mouse') && typeof e.down === 'boolean' && Number.isInteger(e.value) && e.value > 0 && e.value <= 255 && (e.kind !== 'mouse' || [1, 2, 4, 8, 16].includes(e.value))) return { kind: e.kind, down: e.down, value: e.value };
      throw new Error('Event harus berupa tombol, klik mouse, atau jeda 0–65535 ms.');
    });
    return { slot: m.slot, name: m.name, events };
  });
  if (macroBytes(macros) > MACRO_BYTES) throw new Error('Kapasitas makro 3584 byte terlampaui.');
  return macros;
}
/** Encoder-only preview, based on vendor 0x420050. Playback binding remains unverified. */
export function macroImage(value: Macro[]): Uint8Array {
  const macros = parseMacros(value).sort((a, b) => a.slot - b.slot);
  const image = new Uint8Array(MACRO_BYTES);
  image.fill(0xff, 0, MACRO_DIRECTORY_BYTES);
  const view = new DataView(image.buffer);
  let offset = MACRO_DIRECTORY_BYTES;
  for (const macro of macros) {
    view.setUint16(macro.slot * 4, offset, true);
    view.setUint16(macro.slot * 4 + 2, 0, true);
    view.setUint16(offset, macro.events.length, true);
    offset += 8;
    for (const e of macro.events) {
      if (e.kind === 'delay') { view.setUint16(offset, e.ms, true); image[offset + 3] = 0x50; }
      else { image[offset + 2] = e.value; image[offset + 3] = (e.kind === 'key' ? 0x30 : 0x10) | (e.down ? 0x80 : 0); }
      offset += 4;
    }
  }
  return image;
}
export function macroPreview(macros: Macro[]): Uint8Array[] {
  const packets = chunks(macroImage(macros));
  return [cmd(0x19), cmd(0x15, { 8: packets.length }), ...packets, cmd(0x02)];
}
