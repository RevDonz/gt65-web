import { beforeEach, describe, expect, test } from 'vitest';
import { defaultProfile, loadProfile, saveProfile,
         exportProfile, importProfile, promoteProvenance,
         needsOverwriteWarning } from '../src/store/profile';
import { KEYS } from '../src/gt65/layout';
import { TABLE_ENTRIES, lighting } from '../src/gt65/protocol';

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

  /**
   * Paket emas jalur pemulihan. `defaultProfile()` adalah apa yang ditulis
   * saat pengguna menekan "Pulihkan bawaan" — satu-satunya jalan keluar
   * ketika keyboard salah konfigurasi, karena tidak ada perintah
   * factory-reset di firmware ini. Rentang kabel yang sah adalah 1..5
   * (speed_max/brightness_max di rgb-keyboard.xml vendor); hanya wire byte
   * 3 yang terbukti langsung di hardware fisik. Kalau tes ini gagal, jalur
   * pemulihan itu sendiri akan mengirim byte yang ditolak keyboard dan
   * mematikan lampunya — persis kegagalan yang diperbaiki di sini.
   */
  test('pencahayaan bawaan ter-encode ke wire byte dalam rentang 1..5', () => {
    const d = lighting(defaultProfile().lighting)[2];
    expect(d[9]).toBeGreaterThanOrEqual(1);
    expect(d[9]).toBeLessThanOrEqual(5);
    expect(d[10]).toBeGreaterThanOrEqual(1);
    expect(d[10]).toBeLessThanOrEqual(5);
    // Nilai spesifik yang terbukti di hardware sungguhan (2026-08-31).
    expect(d[9]).toBe(3);
    expect(d[10]).toBe(3);
  });
});

/**
 * Provenance adalah pengaman inti tugas ini: `'default'` berarti profil di
 * browser ini belum pernah disentuh, jadi menerapkan remap saat itu bisa
 * menimpa pemetaan dari komputer lain tanpa peringatan (keyboard tidak
 * bisa dibaca balik). Lihat needsOverwriteWarning dan promoteProvenance.
 */
describe('provenance', () => {
  test('profil bawaan berprovenance "default" dan belum pernah dicadangkan', () => {
    const p = defaultProfile();
    expect(p.provenance).toBe('default');
    expect(p.backedUp).toBe(false);
  });

  test('impor selalu berprovenance "imported" dan tercadangkan', () => {
    const p = importProfile(exportProfile(defaultProfile()));
    expect(p.provenance).toBe('imported');
    expect(p.backedUp).toBe(true);
  });

  describe('promoteProvenance — titik tumpu tunggal ke "edited"', () => {
    test('menaikkan ke "edited" saat layer berubah dari profil bawaan', () => {
      const prev = defaultProfile();
      const idx = KEYS[0].keyIndex;
      const next = { ...prev, layers: { ...prev.layers,
        top: prev.layers.top.map((e, i) => (i === idx ? { kind: 'none' as const } : e)) } };
      expect(promoteProvenance(prev, next).provenance).toBe('edited');
    });

    test('menaikkan ke "edited" saat lighting atau settings berubah', () => {
      const prev = defaultProfile();
      const nextLighting = { ...prev, lighting: { ...prev.lighting, r: 0x01 } };
      expect(promoteProvenance(prev, nextLighting).provenance).toBe('edited');

      const nextSettings = { ...prev,
        settings: { ...prev.settings, sleepTimeout: 5 } };
      expect(promoteProvenance(prev, nextSettings).provenance).toBe('edited');
    });

    test('tidak menaikkan kalau isinya tidak berubah (mis. hanya menandai cadangan)', () => {
      const prev = defaultProfile();
      const next = { ...prev, backedUp: true };
      expect(promoteProvenance(prev, next).provenance).toBe('default');
    });

    test('tidak menaikkan lagi profil yang sudah "edited" atau "imported"', () => {
      const editedPrev = { ...defaultProfile(), provenance: 'edited' as const };
      const editedNext = { ...editedPrev,
        lighting: { ...editedPrev.lighting, r: 0x02 } };
      expect(promoteProvenance(editedPrev, editedNext).provenance).toBe('edited');

      const importedPrev = { ...defaultProfile(), provenance: 'imported' as const };
      expect(promoteProvenance(importedPrev, importedPrev).provenance).toBe('imported');
    });

    test('impor dan "Pulihkan bawaan" menyatakan provenance sendiri, tidak diubah', () => {
      const prev = { ...defaultProfile(), provenance: 'edited' as const };
      const imported = { ...defaultProfile(), provenance: 'imported' as const };
      expect(promoteProvenance(prev, imported).provenance).toBe('imported');

      const restored = defaultProfile(); // provenance 'default', sama seperti prev.provenance lama
      expect(promoteProvenance(prev, restored).provenance).toBe('default');
    });
  });

  describe('needsOverwriteWarning', () => {
    test('true hanya untuk provenance "default"', () => {
      expect(needsOverwriteWarning(defaultProfile())).toBe(true);
      expect(needsOverwriteWarning({ ...defaultProfile(), provenance: 'edited' })).toBe(false);
      expect(needsOverwriteWarning({ ...defaultProfile(), provenance: 'imported' })).toBe(false);
    });
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

  /**
   * Impor selalu menandai provenance `'imported'`, bahkan kalau isi
   * berkasnya kebetulan identik dengan profil bawaan — titik baliknya
   * adalah tindakan mengimpor, bukan isi berkasnya. Lihat `importProfile`
   * di store/profile.ts.
   */
  test('menerima profil bawaan apa adanya, tapi menandainya sebagai impor', () => {
    expect(imp(valid())()).toEqual(
      { ...defaultProfile(), provenance: 'imported', backedUp: true });
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

  /**
   * Profil tersimpan dari VERSION sebelumnya (sebelum provenance/backedUp
   * ada) tidak boleh dibaca dengan field yang hilang — itu membuat
   * `needsOverwriteWarning` salah baca `undefined` sebagai bukan 'default'
   * dan melewatkan peringatan padahal profilnya sesungguhnya belum pernah
   * disentuh di versi baru ini. VERSION yang dinaikkan membuat seluruh
   * profil versi lama gagal validasi bersama-sama, jatuh bersih ke bawaan.
   */
  test('profil dari VERSION sebelumnya (tanpa provenance/backedUp) jatuh ke bawaan', () => {
    store({
      version: 1,
      name: 'Lama',
      layers: valid().layers,
      lighting: valid().lighting,
      settings: valid().settings,
      // provenance dan backedUp sengaja tidak ada — bentuk skema lama.
    });
    expect(loadProfile()).toEqual(defaultProfile());
  });
});
