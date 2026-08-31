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

/**
 * Profil yang bentuknya salah tidak pernah boleh sampai ke UI atau ke
 * perangkat: panel akan crash saat render (halaman kosong, tanpa jalan
 * keluar selain menghapus data situs) atau byte yang salah tertulis ke
 * keyboard yang tidak bisa dibaca balik.
 */
describe('validasi profil', () => {
  /** Profil sah dalam bentuk objek biasa, siap dirusak per kasus uji. */
  const valid = () => JSON.parse(exportProfile(defaultProfile()));
  const imp = (p: unknown) => () => importProfile(JSON.stringify(p));

  test('menerima profil bawaan apa adanya', () => {
    expect(imp(valid())()).toEqual(defaultProfile());
  });

  test('menolak berkas yang bukan JSON', () => {
    expect(() => importProfile('{bukan json')).toThrow(/JSON/i);
  });

  test('menolak JSON yang bukan objek', () => {
    expect(() => importProfile('42')).toThrow(/rusak/i);
  });

  describe('layer', () => {
    test('menolak layer utama yang kependekan', () => {
      const p = valid();
      p.layers.top.pop();
      expect(imp(p)).toThrow(/utama/i);
    });

    test('menolak layer Fn yang hilang', () => {
      const p = valid();
      delete p.layers.fn;
      expect(imp(p)).toThrow(/Fn/i);
    });

    test('menolak layer Fn yang kepanjangan', () => {
      const p = valid();
      p.layers.fn.push({ kind: 'none' });
      expect(imp(p)).toThrow(/Fn/i);
    });

    test('menolak blok layer yang hilang', () => {
      const p = valid();
      delete p.layers;
      expect(imp(p)).toThrow(/layer/i);
    });

    test('menolak entri dengan jenis tak dikenal', () => {
      const p = valid();
      p.layers.top[3] = { kind: 'peledak' };
      expect(imp(p)).toThrow(/tidak dikenal/i);
    });

    test('menolak entri tombol tanpa usage', () => {
      const p = valid();
      p.layers.top[3] = { kind: 'key', mod: 0 };
      expect(imp(p)).toThrow(/usage/i);
    });

    test('menolak jenis kejadian mouse di luar 1 dan 3', () => {
      const p = valid();
      p.layers.top[3] = { kind: 'mouse', ev: 2, val: 1 };
      expect(imp(p)).toThrow(/mouse/i);
    });
  });

  describe('pencahayaan', () => {
    test('menolak blok pencahayaan yang hilang', () => {
      const p = valid();
      delete p.lighting;
      expect(imp(p)).toThrow(/pencahayaan/i);
    });

    for (const field of ['mode', 'r', 'g', 'b', 'speed', 'brightness', 'direction']) {
      test(`menolak pencahayaan tanpa ${field}`, () => {
        const p = valid();
        delete p.lighting[field];
        expect(imp(p)).toThrow(/rusak/i);
      });
    }

    test('menolak komponen warna di atas 255', () => {
      const p = valid();
      p.lighting.r = 300;
      expect(imp(p)).toThrow(/merah/i);
    });

    test('menolak nilai negatif', () => {
      const p = valid();
      p.lighting.direction = -1;
      expect(imp(p)).toThrow(/arah/i);
    });

    test('menolak angka pecahan', () => {
      const p = valid();
      p.lighting.mode = 1.5;
      expect(imp(p)).toThrow(/bulat/i);
    });

    test('menolak angka berupa teks', () => {
      const p = valid();
      p.lighting.speed = '2';
      expect(imp(p)).toThrow(/kecepatan/i);
    });
  });

  describe('pengaturan', () => {
    test('menolak blok pengaturan yang hilang', () => {
      const p = valid();
      delete p.settings;
      expect(imp(p)).toThrow(/pengaturan/i);
    });

    test('menolak empat flag', () => {
      const p = valid();
      p.settings.flags = [false, false, false, false];
      expect(imp(p)).toThrow(/5 flag/i);
    });

    test('menolak tujuh flag', () => {
      const p = valid();
      p.settings.flags = new Array(7).fill(false);
      expect(imp(p)).toThrow(/5 flag/i);
    });

    test('menolak flag yang bukan boolean', () => {
      const p = valid();
      p.settings.flags = [1, 0, 0, 0, 0];
      expect(imp(p)).toThrow(/5 flag/i);
    });

    test('menolak sleepTimeout yang hilang', () => {
      const p = valid();
      delete p.settings.sleepTimeout;
      expect(imp(p)).toThrow(/tidur/i);
    });

    test('menolak sleepTimeout di luar 0-255', () => {
      const p = valid();
      p.settings.sleepTimeout = 256;
      expect(imp(p)).toThrow(/tidur/i);
    });
  });

  test('menolak nama yang bukan teks', () => {
    const p = valid();
    p.name = 7;
    expect(imp(p)).toThrow(/nama/i);
  });

  test('membuang field asing, tidak meneruskannya ke perangkat', () => {
    const p = valid();
    p.jahat = 'payload';
    p.lighting.jahat = 99;
    const out = importProfile(JSON.stringify(p)) as Record<string, unknown>;
    expect(out.jahat).toBeUndefined();
    expect((out.lighting as Record<string, unknown>).jahat).toBeUndefined();
  });
});

describe('loadProfile jatuh ke bawaan, bukan crash', () => {
  const store = (p: unknown) =>
    localStorage.setItem('gt65.profile', JSON.stringify(p));
  const valid = () => JSON.parse(exportProfile(defaultProfile()));

  test('profil tanpa blok pencahayaan', () => {
    const p = valid();
    delete p.lighting;
    store(p);
    expect(loadProfile()).toEqual(defaultProfile());
  });

  test('profil dengan empat flag', () => {
    const p = valid();
    p.settings.flags = [false, false, false, false];
    store(p);
    expect(loadProfile()).toEqual(defaultProfile());
  });

  test('profil dengan layer Fn hilang', () => {
    const p = valid();
    delete p.layers.fn;
    store(p);
    expect(loadProfile()).toEqual(defaultProfile());
  });

  test('profil dengan entri jenis tak dikenal', () => {
    const p = valid();
    p.layers.top[3] = { kind: 'peledak' };
    store(p);
    expect(loadProfile()).toEqual(defaultProfile());
  });
});
