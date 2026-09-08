import { beforeAll, beforeEach, expect, test } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../src/app/App';
import { LIBRARY_KEY } from '../src/store/library';

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
async function mount() {
  const el = document.createElement('div'); document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => root.render(<App />));
  const click = async (text: string) => {
    const button = [...el.querySelectorAll('button')].find((b) => b.textContent === text);
    if (!button) throw new Error(`Missing button ${text}`);
    await act(async () => button.click());
  };
  const tab = async (name: string) => act(async () => el.querySelector<HTMLAnchorElement>(`nav a[aria-label="${name}"]`)!.click());
  const close = async () => { await act(async () => root.unmount()); el.remove(); };
  return { el, click, tab, close };
}
test('profile switching keeps macro data isolated and persists the active profile', async () => {
  const { el, click, tab, close } = await mount();
  try {
    await tab('Makro'); await click('Makro baru'); await click('Tambah event');
    expect(el.querySelectorAll('.macro-events li')).toHaveLength(1);
    await tab('Profil'); await click('Buat profil'); await tab('Makro');
    expect(el.querySelectorAll('.macro-events li')).toHaveLength(0);
    await tab('Profil'); await click('Gunakan'); await tab('Makro');
    expect(el.querySelectorAll('.macro-events li')).toHaveLength(1);
    const stored = JSON.parse(localStorage.getItem(LIBRARY_KEY)!);
    expect(stored.items.find((i: { id: string }) => i.id === stored.activeId).profile.macros[0].events).toEqual([{ kind: 'key', down: true, value: 4 }]);
  } finally { await close(); }
});
test('stopping recording with a held key adds its release and removes interception', async () => {
  const { el, click, tab, close } = await mount();
  try {
    await tab('Makro'); await click('Makro baru'); await click('Rekam keyboard');
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', cancelable: true })); });
    await act(async () => { window.dispatchEvent(new Event('blur')); });
    expect(el.querySelectorAll('.macro-events li')).toHaveLength(2);
    expect(el.textContent).toContain('Lepas A');
    const ev = new KeyboardEvent('keydown', { code: 'KeyB', cancelable: true });
    await act(async () => { window.dispatchEvent(ev); });
    expect(ev.defaultPrevented).toBe(false);
  } finally { await close(); }
});
test('RGB group selection paints only physical WASD entries', async () => {
  const { el, click, tab, close } = await mount();
  try {
    await tab('RGB'); await click('WASD');
    expect(el.querySelectorAll('.kc[data-selected="true"]')).toHaveLength(4);
    await click('Warnai pilihan');
    const stored = JSON.parse(localStorage.getItem(LIBRARY_KEY)!);
    const colors: number[][] = stored.items[0].profile.perKeyColors;
    expect(colors.filter((rgb) => rgb.some(Boolean))).toHaveLength(4);
    expect(stored.items[0].profile.provenance).toBe('edited');
  } finally { await close(); }
});
