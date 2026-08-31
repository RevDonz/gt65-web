import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../src/app/App';
import { KEYS } from '../src/gt65/layout';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

// Setiap mountApp() memuat profil dari localStorage — kalau satu tes
// menyunting profil (mis. mengonfirmasi peringatan menimpa), tes berikutnya
// di file ini tidak boleh mewarisi provenance-nya secara diam-diam.
beforeEach(() => localStorage.clear());

async function mountApp() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => { root.render(<App />); });
  const clickTab = async (name: string) => {
    const btn = [...el.querySelectorAll('button')].find((b) => b.textContent === name)!;
    await act(async () => { btn.click(); });
  };
  const cleanup = async () => {
    await act(async () => { root.unmount(); });
    el.remove();
  };
  return { el, clickTab, cleanup };
}

describe('kerangka aplikasi', () => {
  test('tiap tab bisa dibuka tanpa melempar', async () => {
    const { el, clickTab, cleanup } = await mountApp();
    for (const name of ['Remap', 'Lampu', 'Tester', 'Pengaturan', 'Monitor', 'Log']) {
      await clickTab(name);
      expect(el.textContent).toContain(name);
    }
    await cleanup();
  });

  /**
   * Strip di atas area isi harus MENYEBUT akibat mode kering, bukan cuma
   * mewarnainya: dua kali pengguna terjebak oleh sakelar yang diam-diam
   * kembali menyala saat halaman dimuat ulang.
   */
  test('strip mode kering berganti kalimat dan nada bersama sakelarnya', async () => {
    const { el, cleanup } = await mountApp();
    const strip = () => el.querySelector('.strip')!;
    expect(strip().getAttribute('data-mode')).toBe('dry');
    expect(strip().textContent).toContain('Tidak ada apa pun yang ditulis');

    const sw = el.querySelector('[role="switch"]') as HTMLButtonElement;
    expect(sw.getAttribute('aria-checked')).toBe('true');
    await act(async () => { sw.click(); });

    expect(strip().getAttribute('data-mode')).toBe('live');
    expect(strip().textContent).toContain('menulis langsung ke keyboard');
    await cleanup();
  });
});

describe('tab Tester', () => {
  test('menandai tombol yang ditahan lalu menyisakan jejak "pernah terlihat"', async () => {
    const { el, clickTab, cleanup } = await mountApp();
    await clickTab('Tester');
    expect(el.querySelectorAll('.kc').length).toBe(KEYS.length);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', cancelable: true }));
    });
    expect(el.querySelectorAll('.kc[data-held="true"]').length).toBe(1);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA', cancelable: true }));
    });
    expect(el.querySelectorAll('.kc[data-held="true"]').length).toBe(0);
    expect(el.querySelectorAll('.kc[data-seen="true"]').length).toBe(1);
    // Fn tidak masuk penyebut: firmware tidak pernah mengirimkannya ke OS.
    expect(el.textContent).toContain(`1 / ${KEYS.length - 1}`);
    await cleanup();
  });

  /**
   * Tanpa preventDefault, menguji tombol berarti mengetik ke dalam halaman
   * dan memicu pintasan browser — Ctrl+W di tengah pengujian menutup tab.
   */
  test('menahan aksi bawaan browser untuk tombol yang diuji', async () => {
    const { clickTab, cleanup } = await mountApp();
    await clickTab('Tester');
    const ev = new KeyboardEvent('keydown', { code: 'KeyW', cancelable: true });
    await act(async () => { window.dispatchEvent(ev); });
    expect(ev.defaultPrevented).toBe(true);
    await cleanup();
  });

  test('melepas listener saat tab ditinggalkan', async () => {
    const { el, clickTab, cleanup } = await mountApp();
    await clickTab('Tester');
    await clickTab('Log');
    const ev = new KeyboardEvent('keydown', { code: 'KeyW', cancelable: true });
    await act(async () => { window.dispatchEvent(ev); });
    expect(ev.defaultPrevented).toBe(false);
    expect(el.querySelectorAll('.kc').length).toBe(0);
    await cleanup();
  });
});

/**
 * Bug asli (2026-08-31): pengguna memetakan ulang "del" fisik (keyIndex 119,
 * usage pabrik 0x4C) ke Home (0x4A). Keyboard sungguhan mengirim 0x4A saat
 * tombol itu ditekan, tapi Tester dulu mencocokkan usage yang masuk hanya
 * terhadap `layout.ts` pabrik — yang tidak punya 0x4A sama sekali di papan
 * 65% ini — sehingga tombol yang benar-benar ada di layar dinyatakan "di
 * luar papan ini". Tes di bawah menutup jalur itu dari ujung ke ujung: lewat
 * Remap sungguhan, lalu Tester sungguhan, bukan cuma fungsi resolver murni
 * (sudah diuji terpisah di testerResolve.test.ts).
 */
describe('tab Tester: usage dicocokkan ke profil aktif', () => {
  const findKey = (el: Element, name: string) =>
    [...el.querySelectorAll('.kc')].find(
      (b) => (b as HTMLElement).title.split(' ')[0] === name) as HTMLButtonElement;

  const remap = async (el: Element, physicalName: string, targetUsage: number) => {
    const key = findKey(el, physicalName);
    await act(async () => { key.click(); });
    const select = el.querySelector('aside select') as HTMLSelectElement;
    await act(async () => {
      select.value = String(targetUsage);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };

  test('del dipetakan ke Home: kepala tombol di Tester terbaca "Home", legenda asli "del" tetap terlihat', async () => {
    const { el, clickTab, cleanup } = await mountApp();
    await clickTab('Remap');
    await remap(el, 'del', 0x4a);

    await clickTab('Tester');
    const key = findKey(el, 'del'); // title tetap nama fisik "del"
    expect(key.querySelector('.kc-legend')!.textContent).toBe('Home');
    expect(key.querySelector('.kc-legend-orig')!.textContent).toBe('del');
    await cleanup();
  });

  test('menekan tombol yang mengirim usage Home menyalakan keycap "del" dan menyebutnya di "Event terakhir"', async () => {
    const { el, clickTab, cleanup } = await mountApp();
    await clickTab('Remap');
    await remap(el, 'del', 0x4a);

    await clickTab('Tester');
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Home', cancelable: true }));
    });
    expect(findKey(el, 'del').dataset.held).toBe('true');
    expect(el.textContent).toContain('tombol "del" (indeks 119)');
    expect(el.textContent).not.toContain('di luar papan ini');

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Home', cancelable: true }));
    });
    expect(findKey(el, 'del').dataset.seen).toBe('true');
    await cleanup();
  });

  test('dua tombol fisik dipetakan ke usage yang sama: keduanya menyala, readout mengaku ambigu', async () => {
    const { el, clickTab, cleanup } = await mountApp();
    await clickTab('Remap');
    const aUsage = KEYS.find((k) => k.name === 'A')!.usage;
    await remap(el, 'del', aUsage); // "del" sekarang juga mengirim usage "A"

    await clickTab('Tester');
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', cancelable: true }));
    });
    expect(el.querySelectorAll('.kc[data-held="true"]').length).toBe(2);
    expect(el.textContent).toContain('2 tombol memetakan usage ini');
    await cleanup();
  });
});

describe('tab Remap', () => {
  test('Fn tetap tergambar tapi terkunci, dan memilih tombol membuka inspektur', async () => {
    const { el, clickTab, cleanup } = await mountApp();
    await clickTab('Remap');
    const locked = el.querySelectorAll('.kc[data-locked="true"]');
    expect(locked.length).toBe(1);
    expect(locked[0].textContent).toContain('fn');

    const esc = el.querySelector('.kc') as HTMLButtonElement;
    await act(async () => { esc.click(); });
    expect(el.querySelector('aside')!.textContent).toContain('Sekarang');
    expect(el.querySelectorAll('.kc[data-selected="true"]').length).toBe(1);
    await cleanup();
  });

  /** Di Tester tidak ada yang ditulis ke perangkat, jadi Fn ikut diuji. */
  test('Fn tidak terkunci di Tester', async () => {
    const { el, clickTab, cleanup } = await mountApp();
    await clickTab('Tester');
    expect(el.querySelectorAll('.kc[data-locked="true"]').length).toBe(0);
    await cleanup();
  });
});

/**
 * Bug asli: pengguna memetakan ulang titik-koma (;) ke "A" lalu tidak bisa
 * melihat ATAU membatalkan perubahan itu — kepala tombol tetap terbaca ";"
 * apa pun binding-nya, dan tidak ada cara mengembalikannya selain mencari
 * ulang usage aslinya sendiri. Tes ini menutup keduanya: keycap harus
 * menunjukkan apa yang SEKARANG terjadi (plus legenda asli sebagai
 * pengingat), dan "Kembalikan ke default" harus mengembalikannya tanpa
 * pengguna perlu tahu usage HID titik-koma sama sekali.
 */
describe('legenda keycap dan "Kembalikan ke default"', () => {
  const findKey = (el: Element, name: string) =>
    [...el.querySelectorAll('.kc')].find(
      (b) => (b as HTMLElement).title.split(' ')[0] === name) as HTMLButtonElement;

  const remapToA = async (el: Element) => {
    const semicolon = findKey(el, ';');
    await act(async () => { semicolon.click(); });
    const aUsage = KEYS.find((k) => k.name === 'A')!.usage;
    const select = el.querySelector('aside select') as HTMLSelectElement;
    await act(async () => {
      select.value = String(aUsage);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };

  test('papan bawaan tidak menandai tombol mana pun sebagai berubah', async () => {
    const { el, clickTab, cleanup } = await mountApp();
    await clickTab('Remap');
    expect(el.querySelectorAll('.kc[data-modified="true"]').length).toBe(0);
    expect(el.querySelector('.kc-legend-orig')).toBeNull();
    await cleanup();
  });

  test('memetakan ulang ; ke A: kepala tombol terbaca A, aksen menyala, legenda asli muncul', async () => {
    const { el, clickTab, cleanup } = await mountApp();
    await clickTab('Remap');
    await remapToA(el);

    const key = findKey(el, ';'); // title tetap memakai nama fisik ";"
    expect(key.dataset.modified).toBe('true');
    expect(key.querySelector('.kc-legend')!.textContent).toBe('A');
    expect(key.querySelector('.kc-legend-orig')!.textContent).toBe(';');
    await cleanup();
  });

  test('"Kembalikan ke default": nonaktif pada tombol bawaan, aktif setelah diubah, dan memulihkannya', async () => {
    const { el, clickTab, cleanup } = await mountApp();
    await clickTab('Remap');

    const semicolon = findKey(el, ';');
    await act(async () => { semicolon.click(); });
    const restoreBtn = () => [...el.querySelectorAll('button')]
      .find((b) => b.textContent === 'Kembalikan ke default') as HTMLButtonElement;
    expect(restoreBtn().disabled).toBe(true);

    const aUsage = KEYS.find((k) => k.name === 'A')!.usage;
    const select = el.querySelector('aside select') as HTMLSelectElement;
    await act(async () => {
      select.value = String(aUsage);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(restoreBtn().disabled).toBe(false);

    await act(async () => { restoreBtn().click(); });
    expect(restoreBtn().disabled).toBe(true);

    const key = findKey(el, ';');
    expect(key.dataset.modified).toBe('false');
    expect(key.querySelector('.kc-legend')!.textContent).toBe(';');
    expect(key.querySelector('.kc-legend-orig')).toBeNull();
    await cleanup();
  });
});

/**
 * Wiring App.tsx untuk OverwriteGuardModal. `needsOverwriteWarning` dan
 * `promoteProvenance` sudah diuji murni di profile.test.ts; tes di sini
 * memastikan App.tsx betul-betul memanggilnya di jalur "Terapkan layer
 * ini" — satu-satunya tempat insiden nyatanya terjadi.
 */
describe('pengaman menimpa konfigurasi tak terlihat', () => {
  const clickButton = (el: Element, text: string) => {
    const btn = [...el.querySelectorAll('button')].find((b) => b.textContent === text);
    if (!btn) throw new Error(`tombol "${text}" tidak ditemukan`);
    return act(async () => { (btn as HTMLButtonElement).click(); });
  };

  test('menampilkan modal saat menerapkan remap dari profil bawaan yang belum disentuh', async () => {
    const { el, clickTab, cleanup } = await mountApp();
    await clickTab('Remap');
    expect(el.querySelector('[role="alertdialog"]')).toBeNull();

    await clickButton(el, 'Terapkan layer ini');

    const dialog = el.querySelector('[role="alertdialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain('tidak bisa membacanya');
    expect(dialog!.textContent).toContain('menghapus pemetaan itu secara permanen');
    await cleanup();
  });

  test('"Batal" menutup modal tanpa menerapkan apa pun', async () => {
    const { el, clickTab, cleanup } = await mountApp();
    await clickTab('Remap');
    await clickButton(el, 'Terapkan layer ini');
    expect(el.querySelector('[role="alertdialog"]')).not.toBeNull();

    await clickButton(el, 'Batal');
    expect(el.querySelector('[role="alertdialog"]')).toBeNull();
    expect(el.textContent).not.toContain('Paket terakhir');
    await cleanup();
  });

  test('"Lanjutkan, saya mulai dari nol" menerapkan dan tidak menampilkan modal lagi', async () => {
    const { el, clickTab, cleanup } = await mountApp();
    await clickTab('Remap');
    await clickButton(el, 'Terapkan layer ini');

    await clickButton(el, 'Lanjutkan, saya mulai dari nol');
    expect(el.querySelector('[role="alertdialog"]')).toBeNull();
    // Mode kering aktif secara bawaan: paket tetap dibentuk dan ditampilkan
    // sebagai pratinjau meski tidak sungguh ditulis ke perangkat.
    expect(el.textContent).toContain('Paket terakhir');

    // Provenance sudah 'edited' — permintaan kedua tidak boleh menampilkan
    // modal lagi.
    await clickButton(el, 'Terapkan layer ini');
    expect(el.querySelector('[role="alertdialog"]')).toBeNull();
    await cleanup();
  });

  test('"Impor cadangan" menutup modal tanpa menerapkan', async () => {
    const { el, clickTab, cleanup } = await mountApp();
    await clickTab('Remap');
    await clickButton(el, 'Terapkan layer ini');

    await clickButton(el, 'Impor cadangan');
    expect(el.querySelector('[role="alertdialog"]')).toBeNull();
    expect(el.textContent).not.toContain('Paket terakhir');
    await cleanup();
  });
});
