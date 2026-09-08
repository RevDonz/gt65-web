import { cmd, data, chunks, TABLE_ENTRIES, TABLE_BYTES } from './protocol';
export type RGB = [number, number, number];
export function defaultColors(): RGB[] {
  return Array.from({ length: TABLE_ENTRIES }, () => [0, 0, 0]);
}
export function parseColors(value: unknown): RGB[] {
  if (!Array.isArray(value) || value.length !== TABLE_ENTRIES) throw new Error('Skema RGB harus berisi 144 warna.');
  return value.map((c) => {
    if (!Array.isArray(c) || c.length !== 3 || c.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) throw new Error('Komponen warna RGB harus bilangan bulat 0–255.');
    return [c[0], c[1], c[2]];
  });
}
/** Vendor encoder 0x41d960: 144 indexed RGB records, NOT 192 packed RGB bytes. */
export function perKeyLighting(colors: RGB[]): Uint8Array[][] {
  const validated = parseColors(colors);
  const table = new Uint8Array(TABLE_BYTES);
  validated.forEach((rgb, index) => table.set([index, ...rgb], index * 4));
  table.set([0xaa, 0x55], TABLE_BYTES - 2);
  return [
    [cmd(0x18), cmd(0x23, { 8: 9 }), ...chunks(table), cmd(0x02), cmd(0xf0)],
    // Dedicated activation packet: do not inherit preset fields from lighting().
    [cmd(0x18), cmd(0x13, { 8: 1 }), data({ 0: 0x80, 9: 0x0f, 10: 0x0f }, 14), cmd(0x02), cmd(0xf0)],
  ];
}
