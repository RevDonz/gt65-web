import { constants, promises as fs } from 'node:fs';
import path from 'node:path';

const VENDOR_ID = 0x05ac;
const PRODUCT_ID = 0x024f;
const SYSFS_HIDRAW = '/sys/class/hidraw';

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
 */
export function pickGt65Nodes(entries: UeventEntry[]): string[] {
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
    .map((e) => `/dev/${e.name}`);
}

/** Membaca sysfs dan memeriksa apakah node GT65 bisa ditulis pengguna ini. */
export async function gt65HidrawStatus(): Promise<HidrawStatus> {
  let names: string[];
  try {
    names = await fs.readdir(SYSFS_HIDRAW);
  } catch {
    return { nodes: [], writable: false, checked: false };
  }

  const entries: UeventEntry[] = [];
  for (const name of names) {
    try {
      const uevent = await fs.readFile(path.join(SYSFS_HIDRAW, name, 'device', 'uevent'), 'utf8');
      entries.push({ name, uevent });
    } catch {
      /* node hilang di tengah jalan — abaikan */
    }
  }

  const nodes = pickGt65Nodes(entries);
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
