import { beforeAll, describe, expect, test } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../src/app/App';
import { KEYS } from '../src/gt65/layout';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

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
