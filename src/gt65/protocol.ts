export const CLASS = 0x04;
export const PAYLOAD_LEN = 64;

export type Fields = Record<number, number>;

function applyFields(p: Uint8Array, fields: Fields): void {
  for (const key of Object.keys(fields)) {
    const off = Number(key);
    if (off < 0 || off >= PAYLOAD_LEN) {
      throw new RangeError(`offset ${off} di luar payload 0..63`);
    }
    p[off] = fields[off] & 0xff;
  }
}

/** Paket perintah: payload[0] = 0x04, payload[1] = opcode. */
export function cmd(op: number, fields: Fields = {}): Uint8Array {
  const p = new Uint8Array(PAYLOAD_LEN);
  p[0] = CLASS;
  p[1] = op & 0xff;
  applyFields(p, fields);
  return p;
}

/**
 * Paket data: tanpa penanda kelas. `termAt` adalah offset payload tempat
 * penanda AA 55 diletakkan — posisinya berbeda tiap transaksi.
 */
export function data(fields: Fields, termAt: number): Uint8Array {
  if (termAt < 0 || termAt + 1 >= PAYLOAD_LEN) {
    throw new RangeError(`termAt ${termAt} tidak muat dalam payload`);
  }
  const p = new Uint8Array(PAYLOAD_LEN);
  applyFields(p, fields);
  p[termAt] = 0xaa;
  p[termAt + 1] = 0x55;
  return p;
}

/** Pecah buffer besar menjadi paket-paket 64 byte. */
export function chunks(buf: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let i = 0; i < buf.length; i += PAYLOAD_LEN) {
    const c = new Uint8Array(PAYLOAD_LEN);
    c.set(buf.subarray(i, i + PAYLOAD_LEN));
    out.push(c);
  }
  return out;
}

export type Lighting = {
  mode: number;
  r: number; g: number; b: number;
  speed: number;       // basis nol di UI
  brightness: number;  // basis nol di UI
  direction: number;
};

/**
 * Byte 9 dan 10 dikirim berbasis satu; software vendor menaikkan
 * keduanya dengan `inc al` sebelum menyimpan ke paket.
 */
export function lighting(c: Lighting): Uint8Array[] {
  return [
    cmd(0x18),
    cmd(0x13, { 8: 1 }),
    data({
      0: c.mode,
      1: c.r, 2: c.g, 3: c.b,
      9: c.speed + 1,
      10: c.brightness + 1,
      11: c.direction,
    }, 14),
    cmd(0x02),
    cmd(0xf0),
  ];
}

export type Settings = {
  /**
   * Lima boolean di payload[1..5]. Pemetaan indeks ke makna belum
   * ditentukan — lihat spec Bagian 5.4. Sampai selesai, UI tidak boleh
   * memberi label pasti pada tiap flag.
   */
  flags: [boolean, boolean, boolean, boolean, boolean];
  sleepTimeout: number;
  profileIndex?: number;
};

export function settings(c: Settings): Uint8Array[] {
  const f: Fields = { 6: c.sleepTimeout };
  c.flags.forEach((v, i) => { f[i + 1] = v ? 1 : 0; });
  return [
    cmd(0x18),
    cmd(0x17, { 2: c.profileIndex ?? 0, 8: 1 }),
    data(f, 62),
    cmd(0x02),
  ];
}

export type Entry =
  | { kind: 'none' }
  | { kind: 'key'; mod: number; usage: number }
  | { kind: 'media'; usage: number }
  | { kind: 'mouse'; ev: 1 | 3; val: number }
  | { kind: 'macro'; slot: number; mode: number; repeat: number };

export type Layer = 'top' | 'fn';

export const TABLE_ENTRIES = 144;
export const TABLE_BYTES = TABLE_ENTRIES * 4;

/** entry[0] tag tipe, entry[1] modifier, entry[2] usage/nilai, entry[3] tambahan. */
export function encodeEntry(e: Entry): [number, number, number, number] {
  switch (e.kind) {
    case 'none':  return [0x00, 0, 0, 0];
    case 'mouse': return [0x01, e.ev, e.val & 0xff, 0];
    case 'key':   return [0x02, e.mod & 0xff, e.usage & 0xff, 0];
    case 'media': return [0x03, e.usage & 0xff, 0, 0];
    case 'macro': return [0x06, e.slot & 0xff, e.mode & 0xff, e.repeat & 0xff];
  }
}

/**
 * 144 entri x 4 byte. Indeks tabel adalah `key_index` dari
 * KeyboardLayout.xml (tertinggi 121), sehingga slot sisanya tetap nol.
 * Dua byte terakhir dipakai penanda AA 55, menimpa sebagian slot 143
 * yang memang tak terpakai — sama seperti software vendor.
 */
export function buildTable(entries: Entry[]): Uint8Array {
  const t = new Uint8Array(TABLE_BYTES);
  for (let i = 0; i < Math.min(entries.length, TABLE_ENTRIES); i++) {
    t.set(encodeEntry(entries[i]), i * 4);
  }
  t[TABLE_BYTES - 2] = 0xaa;
  t[TABLE_BYTES - 1] = 0x55;
  return t;
}

export function remap(layer: Layer, entries: Entry[]): Uint8Array[] {
  return [
    cmd(0x18),
    cmd(layer === 'fn' ? 0x27 : 0x11, { 8: 9 }),
    ...chunks(buildTable(entries)),
    cmd(0x02),
    cmd(0xf0),
  ];
}
