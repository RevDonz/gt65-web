import { constants, promises as fs } from 'node:fs';
import path from 'node:path';

const VENDOR_ID = 0x05ac;
const PRODUCT_ID = 0x024f;
const SYSFS_HIDRAW = '/sys/class/hidraw';
const DEV_ROOT = '/dev';

export interface UeventEntry { name: string; uevent: string }

export interface HidrawStatus {
  /** Node hidraw milik GT65 yang ditemukan. Kosong berarti keyboard tidak terpasang. */
  nodes: string[];
  /** true bila SETIDAKNYA satu node bisa ditulis pengguna ini. */
  writable: boolean;
  /** false bila pemeriksaan tidak bisa dilakukan (bukan Linux, sysfs tak terbaca). */
  checked: boolean;
}

/**
 * HID_ID berbentuk "0003:000005AC:0000024F" — bus:vendor:product, heksadesimal
 * berpadding. Dicocokkan tanpa peduli besar-kecil huruf karena kernel menulis
 * huruf besar tetapi itu bukan bagian dari antarmuka yang dijanjikan.
 *
 * `devRoot` opsional — dipakai test untuk menyuntikkan akar `/dev` palsu.
 * Tanda tangan publiknya (satu argumen `entries`) TIDAK berubah karena lima
 * test yang ada memanggilnya begitu; ini murni tambahan berdefault.
 */
export function pickGt65Nodes(entries: UeventEntry[], devRoot: string = DEV_ROOT): string[] {
  const want = [VENDOR_ID, PRODUCT_ID]
    .map((n) => n.toString(16).padStart(8, '0'))
    .join(':')
    .toLowerCase();

  return entries
    .filter((e) => {
      const line = e.uevent.split('\n').find((l) => l.startsWith('HID_ID='));
      if (line === undefined) return false;
      const parts = line.slice('HID_ID='.length).trim().toLowerCase().split(':');
      return parts.length === 3 && `${parts[1]}:${parts[2]}` === want;
    })
    .map((e) => path.join(devRoot, e.name));
}

/**
 * Inti pemeriksaan, dengan akar sysfs dan `/dev` bisa disuntik — dipakai
 * test untuk membangun pohon direktori palsu tanpa menyentuh sysfs
 * sungguhan. `gt65HidrawStatus()` di bawah adalah pembungkus tanpa
 * argumen yang dipakai kode produksi (electron/main.ts).
 */
export async function gt65HidrawStatusAt(sysfsRoot: string, devRoot: string): Promise<HidrawStatus> {
  let names: string[];
  try {
    names = await fs.readdir(sysfsRoot);
  } catch {
    return { nodes: [], writable: false, checked: false };
  }

  const entries: UeventEntry[] = [];
  for (const name of names) {
    try {
      const uevent = await fs.readFile(path.join(sysfsRoot, name, 'device', 'uevent'), 'utf8');
      entries.push({ name, uevent });
    } catch {
      /* node hilang di tengah jalan — abaikan */
    }
  }

  const nodes = pickGt65Nodes(entries, devRoot);
  let writable = false;
  for (const node of nodes) {
    try {
      await fs.access(node, constants.W_OK);
      writable = true;
      break;
    } catch {
      /* tidak bisa ditulis */
    }
  }

  return { nodes, writable, checked: true };
}

/** Membaca sysfs sungguhan dan memeriksa apakah node GT65 bisa ditulis pengguna ini. */
export async function gt65HidrawStatus(): Promise<HidrawStatus> {
  return gt65HidrawStatusAt(SYSFS_HIDRAW, DEV_ROOT);
}
