import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HidAccessBanner, perintahPasang } from '../src/app/HidAccessBanner';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => vi.unstubAllGlobals());

function fakeResponse(body: unknown) {
  return { ok: true, json: () => Promise.resolve(body) } as unknown as Response;
}

/**
 * R-N2: penyusunan perintah dari `rulesPath` tidak pernah diuji sebelumnya —
 * justru di situlah R-C1 (lintasan berspasi tanpa kutip) lolos ke rilis.
 */
describe('perintahPasang', () => {
  test('mengutip lintasan biasa', () => {
    const perintah = perintahPasang('/opt/gt65-configurator/resources/70-gt65.rules');
    expect(perintah).toContain("sudo install -m644 '/opt/gt65-configurator/resources/70-gt65.rules' /etc/udev/rules.d/70-gt65.rules");
  });

  test('mengutip lintasan berspasi (bentuk nyata /opt/GT65 Configurator/resources pada .deb/.rpm)', () => {
    const rulesPath = '/opt/GT65 Configurator/resources/70-gt65.rules';
    const perintah = perintahPasang(rulesPath);
    expect(perintah).toContain(`'${rulesPath}'`);
    // Regresi tepat R-C1: tanpa kutip, argumen install() terpotong di spasi.
    expect(perintah).not.toContain('install -m644 /opt/GT65 Configurator');
  });

  test('meng-escape kutip tunggal di dalam lintasan', () => {
    const perintah = perintahPasang("/opt/O'Brien/resources/70-gt65.rules");
    expect(perintah).toContain("'/opt/O'\\''Brien/resources/70-gt65.rules'");
  });

  test('perintah tetap memuat kedua baris (install lalu reload+trigger udev)', () => {
    const perintah = perintahPasang('/opt/gt65/resources/70-gt65.rules');
    const baris = perintah.split('\n');
    expect(baris).toHaveLength(2);
    expect(baris[1]).toBe(
      'sudo udevadm control --reload-rules && sudo udevadm trigger --subsystem-match=hidraw --action=add',
    );
  });

  /**
   * Bukti langsung, bukan cuma pembacaan kode: jalankan perintah yang
   * dihasilkan lewat shell POSIX sungguhan (sh -c) dengan `sudo`/`install`
   * palsu di PATH, pada direktori sungguhan yang mengandung spasi — persis
   * bentuk `/opt/GT65 Configurator/resources` di paket .deb/.rpm terpasang.
   * Kalau kutipnya salah, `install` palsu menerima lintasan yang sudah
   * terpotong di spasi sebagai argumen TERPISAH, bukan satu argumen utuh.
   */
  test('perintah pasang berjalan nyata di shell ketika lintasannya berspasi', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt65-quote-'));
    try {
      const binDir = path.join(tmpDir, 'bin');
      fs.mkdirSync(binDir);
      const argsLog = path.join(tmpDir, 'install.args');

      // sudo palsu: buang argumen "sudo" itu sendiri, exec sisanya apa adanya.
      fs.writeFileSync(path.join(binDir, 'sudo'), '#!/bin/sh\nexec "$@"\n');
      // install palsu: catat setiap argumen POSITIONAL apa adanya, satu per
      // baris, supaya test bisa memverifikasi lintasan berspasi tiba sebagai
      // SATU argumen (bukan dua, terpotong di spasi).
      fs.writeFileSync(
        path.join(binDir, 'install'),
        `#!/bin/sh\nfor a in "$@"; do case "$a" in -*) ;; *) printf '%s\\n' "$a" ;; esac; done > '${argsLog}'\nexit 0\n`,
      );
      fs.writeFileSync(path.join(binDir, 'udevadm'), '#!/bin/sh\nexit 0\n');
      for (const bin of ['sudo', 'install', 'udevadm']) {
        fs.chmodSync(path.join(binDir, bin), 0o755);
      }

      const rulesDir = path.join(tmpDir, 'GT65 Configurator', 'resources');
      fs.mkdirSync(rulesDir, { recursive: true });
      const rulesPath = path.join(rulesDir, '70-gt65.rules');
      fs.writeFileSync(rulesPath, '# aturan udev tiruan\n');

      const perintah = perintahPasang(rulesPath);

      // Tidak melempar berarti sh -c mem-parse kedua baris sebagai perintah
      // yang valid dan install/udevadm palsu keduanya keluar dengan status 0.
      expect(() => {
        execFileSync('sh', ['-c', perintah], {
          env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` },
          stdio: 'pipe',
        });
      }).not.toThrow();

      const args = fs.readFileSync(argsLog, 'utf8').trim().split('\n');
      // Bukti langsung: lintasan berspasi tiba di `install` sebagai satu
      // argumen utuh yang sama persis dengan rulesPath aslinya.
      expect(args).toEqual([rulesPath, '/etc/udev/rules.d/70-gt65.rules']);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

async function mountBanner(deviceStatus: 'idle' | 'connecting' | 'connected' | 'error') {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => { root.render(<HidAccessBanner deviceStatus={deviceStatus} />); });
  const rerender = async (next: typeof deviceStatus) => {
    await act(async () => { root.render(<HidAccessBanner deviceStatus={next} />); });
  };
  const cleanup = async () => {
    await act(async () => { root.unmount(); });
    el.remove();
  };
  return { el, rerender, cleanup };
}

describe('HidAccessBanner', () => {
  test('tidak menampilkan apa pun ketika sudah bisa ditulis', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      fakeResponse({ nodes: ['/dev/hidraw0'], writable: true, checked: true, rulesPath: null }),
    ));
    const { el, cleanup } = await mountBanner('connected');
    expect(el.querySelector('.hid-access-banner')).toBeNull();
    await cleanup();
  });

  test('menampilkan perintah berkutip ketika rulesPath ditemukan', async () => {
    const rulesPath = '/opt/GT65 Configurator/resources/70-gt65.rules';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      fakeResponse({ nodes: ['/dev/hidraw0'], writable: false, checked: true, rulesPath }),
    ));
    const { el, cleanup } = await mountBanner('connected');
    const pre = el.querySelector('pre');
    expect(pre?.textContent).toContain(`'${rulesPath}'`);
    await cleanup();
  });

  test('menampilkan jalur unduh-dari-rilis ketika rulesPath null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      fakeResponse({ nodes: ['/dev/hidraw0'], writable: false, checked: true, rulesPath: null }),
    ));
    const { el, cleanup } = await mountBanner('connected');
    expect(el.querySelector('pre')).toBeNull();
    expect(el.textContent).toContain('halaman rilis GitHub');
    await cleanup();
  });

  /**
   * I4: pemeriksaan ulang saat status perangkat berubah. Sebelumnya tidak
   * teruji sama sekali — pemeriksaan sysfs sekali saat mount buta terhadap
   * alur colok-belakangan (buka aplikasi tanpa keyboard, tekan "Sambungkan",
   * baru colok keyboard).
   */
  test('memeriksa ulang endpoint ketika deviceStatus berubah', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(fakeResponse({ nodes: [], writable: true, checked: true, rulesPath: null }))
      .mockResolvedValueOnce(fakeResponse({
        nodes: ['/dev/hidraw0'], writable: false, checked: true,
        rulesPath: '/opt/gt65-configurator/resources/70-gt65.rules',
      }));
    vi.stubGlobal('fetch', fetchMock);

    const { el, rerender, cleanup } = await mountBanner('idle');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(el.querySelector('.hid-access-banner')).toBeNull();

    await rerender('connected');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(el.querySelector('.hid-access-banner')).not.toBeNull();
    expect(el.querySelector('pre')?.textContent).toContain("'/opt/gt65-configurator/resources/70-gt65.rules'");

    await cleanup();
  });

  test('tidak memeriksa ulang ketika deviceStatus tidak berubah (render ulang lain tidak memicu fetch baru)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      fakeResponse({ nodes: [], writable: true, checked: true, rulesPath: null }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { rerender, cleanup } = await mountBanner('idle');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await rerender('idle');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await cleanup();
  });
});
