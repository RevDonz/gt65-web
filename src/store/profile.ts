import { TABLE_ENTRIES } from '../gt65/protocol';
import type { Entry, Lighting, Settings } from '../gt65/protocol';
import { KEYS } from '../gt65/layout';

export const STORAGE_KEY = 'gt65.profile';
const VERSION = 1;

export type Profile = {
  version: number;
  name: string;
  layers: { top: Entry[]; fn: Entry[] };
  lighting: Lighting;
  settings: Settings;
};

function emptyLayer(): Entry[] {
  return Array.from({ length: TABLE_ENTRIES }, () => ({ kind: 'none' }) as Entry);
}

/**
 * Profil bawaan memetakan tiap tombol ke usage aslinya. Ini juga
 * berfungsi sebagai jalur pemulihan: menulis profil ini mengembalikan
 * keyboard ke keadaan wajar tanpa perlu software vendor.
 */
export function defaultProfile(): Profile {
  const top = emptyLayer();
  for (const k of KEYS) {
    top[k.keyIndex] = { kind: 'key', mod: 0, usage: k.usage };
  }
  return {
    version: VERSION,
    name: 'Bawaan',
    layers: { top, fn: emptyLayer() },
    lighting: { mode: 0, r: 0xff, g: 0xff, b: 0xff,
                speed: 2, brightness: 4, direction: 0 },
    settings: { flags: [false, false, false, false, false], sleepTimeout: 0 },
  };
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProfile();
    const p = JSON.parse(raw) as Profile;
    if (p.version !== VERSION) return defaultProfile();
    if (p.layers?.top?.length !== TABLE_ENTRIES) return defaultProfile();
    return p;
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // penyimpanan penuh atau diblokir; abaikan, profil tetap hidup di memori
  }
}

export function exportProfile(p: Profile): string {
  return JSON.stringify(p, null, 2);
}

export function importProfile(json: string): Profile {
  const p = JSON.parse(json) as Profile;
  if (p.version !== VERSION) {
    throw new Error(`Versi profil ${p.version} tidak dikenal, harus ${VERSION}.`);
  }
  if (p.layers?.top?.length !== TABLE_ENTRIES) {
    throw new Error('Profil rusak: jumlah entri layer tidak sesuai.');
  }
  return p;
}
