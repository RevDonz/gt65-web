import { beforeEach, describe, expect, test } from 'vitest';
import { defaultProfile, loadProfile, saveProfile,
         exportProfile, importProfile } from '../src/store/profile';
import { KEYS } from '../src/gt65/layout';
import { TABLE_ENTRIES } from '../src/gt65/protocol';

beforeEach(() => localStorage.clear());

describe('profil bawaan', () => {
  test('punya 144 entri di tiap layer', () => {
    const p = defaultProfile();
    expect(p.layers.top.length).toBe(TABLE_ENTRIES);
    expect(p.layers.fn.length).toBe(TABLE_ENTRIES);
  });

  test('layer atas memetakan tiap tombol ke usage aslinya', () => {
    const p = defaultProfile();
    for (const k of KEYS) {
      expect(p.layers.top[k.keyIndex]).toEqual(
        { kind: 'key', mod: 0, usage: k.usage });
    }
  });

  test('slot yang tidak dipakai bernilai none', () => {
    const p = defaultProfile();
    const used = new Set(KEYS.map((k) => k.keyIndex));
    for (let i = 0; i < TABLE_ENTRIES; i++) {
      if (!used.has(i)) expect(p.layers.top[i]).toEqual({ kind: 'none' });
    }
  });
});

describe('persistensi', () => {
  test('menyimpan lalu memuat kembali profil yang sama', () => {
    const p = defaultProfile();
    p.lighting.r = 0x12;
    saveProfile(p);
    expect(loadProfile().lighting.r).toBe(0x12);
  });

  test('memuat bawaan bila penyimpanan kosong', () => {
    expect(loadProfile().name).toBe(defaultProfile().name);
  });

  test('memuat bawaan bila data rusak', () => {
    localStorage.setItem('gt65.profile', '{bukan json');
    expect(loadProfile().layers.top.length).toBe(TABLE_ENTRIES);
  });

  test('ekspor dan impor bolak-balik', () => {
    const p = defaultProfile();
    p.name = 'Uji';
    expect(importProfile(exportProfile(p)).name).toBe('Uji');
  });

  test('impor menolak versi tak dikenal', () => {
    expect(() => importProfile('{"version":99}')).toThrow(/versi/i);
  });
});
