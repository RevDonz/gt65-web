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
