import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { gt65HidrawStatusAt, pickGt65Nodes } from '../electron/lib/hidAccess';

describe('pickGt65Nodes', () => {
  it('memilih node yang HID_ID-nya cocok GT65', () => {
    const entries = [
      { name: 'hidraw0', uevent: 'HID_ID=0003:00001EA7:00000066\nHID_NAME=Mouse\n' },
      { name: 'hidraw2', uevent: 'HID_ID=0003:000005AC:0000024F\nHID_NAME=USB Dongle\n' },
      { name: 'hidraw3', uevent: 'HID_ID=0003:000005AC:0000024F\nHID_NAME=USB Dongle\n' },
    ];
    expect(pickGt65Nodes(entries)).toEqual(['/dev/hidraw2', '/dev/hidraw3']);
  });

  it('cocok tanpa peduli besar-kecil huruf', () => {
    const entries = [{ name: 'hidraw1', uevent: 'HID_ID=0003:000005ac:0000024f\n' }];
    expect(pickGt65Nodes(entries)).toEqual(['/dev/hidraw1']);
  });

  it('tidak cocok bila hanya vendor yang sama (keyboard Apple asli)', () => {
    const entries = [{ name: 'hidraw1', uevent: 'HID_ID=0003:000005AC:00000250\n' }];
    expect(pickGt65Nodes(entries)).toEqual([]);
  });

  it('mengembalikan daftar kosong bila tidak ada yang cocok', () => {
    expect(pickGt65Nodes([{ name: 'hidraw0', uevent: 'HID_ID=0003:1:2\n' }])).toEqual([]);
  });

  it('mengabaikan uevent tanpa HID_ID', () => {
    expect(pickGt65Nodes([{ name: 'hidraw0', uevent: 'DEVNAME=hidraw0\n' }])).toEqual([]);
  });
});

/**
 * `gt65HidrawStatusAt` menerima akar sysfs dan `/dev` sebagai argumen —
 * lihat electron/lib/hidAccess.ts — supaya jalur `writable: false` bisa
 * dibuktikan lewat test otomatis, bukan lewat mencabut aturan udev sungguhan
 * di mesin pengembang (yang butuh sudo dan tidak berjalan di CI).
 *
 * Pohon direktori palsu dibangun di bawah os.tmpdir(), bukan di dalam repo,
 * dan dibersihkan sesudah tiap test lewat afterEach.
 */
describe('gt65HidrawStatusAt', () => {
  const GT65_UEVENT = 'HID_ID=0003:000005AC:0000024F\nHID_NAME=USB Dongle\n';
  let tmpDir: string | null = null;

  afterEach(async () => {
    if (tmpDir !== null) {
      await fs.rm(tmpDir, { recursive: true, force: true });
      tmpDir = null;
    }
  });

  /** Membangun <tmp>/sys/class/hidraw/hidraw0/device/uevent + <tmp>/dev/hidraw0. */
  async function buildFakeTree(nodeMode: number): Promise<{ sysfsRoot: string; devRoot: string }> {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gt65-hidaccess-'));
    const sysfsRoot = path.join(tmpDir, 'sys', 'class', 'hidraw');
    const devRoot = path.join(tmpDir, 'dev');

    await fs.mkdir(path.join(sysfsRoot, 'hidraw0', 'device'), { recursive: true });
    await fs.writeFile(path.join(sysfsRoot, 'hidraw0', 'device', 'uevent'), GT65_UEVENT, 'utf8');

    await fs.mkdir(devRoot, { recursive: true });
    const nodePath = path.join(devRoot, 'hidraw0');
    // Berkas biasa berdiri sebagai pengganti node perangkat — hanya bit
    // izinnya yang diuji, bukan perilaku hidraw sungguhan.
    await fs.writeFile(nodePath, '', 'utf8');
    await fs.chmod(nodePath, nodeMode);

    return { sysfsRoot, devRoot };
  }

  it('berkas 0444 (tidak bisa ditulis) menghasilkan writable: false dengan nodes terisi', async () => {
    const { sysfsRoot, devRoot } = await buildFakeTree(0o444);
    const status = await gt65HidrawStatusAt(sysfsRoot, devRoot);
    expect(status.checked).toBe(true);
    expect(status.nodes).toEqual([path.join(devRoot, 'hidraw0')]);
    expect(status.writable).toBe(false);
  });

  it('berkas 0666 (bisa ditulis) menghasilkan writable: true', async () => {
    const { sysfsRoot, devRoot } = await buildFakeTree(0o666);
    const status = await gt65HidrawStatusAt(sysfsRoot, devRoot);
    expect(status.checked).toBe(true);
    expect(status.nodes).toEqual([path.join(devRoot, 'hidraw0')]);
    expect(status.writable).toBe(true);
  });

  it('sysfs yang tidak ada menghasilkan checked: false', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gt65-hidaccess-'));
    const sysfsRoot = path.join(tmpDir, 'sys', 'class', 'hidraw'); // sengaja tidak dibuat
    const devRoot = path.join(tmpDir, 'dev');

    const status = await gt65HidrawStatusAt(sysfsRoot, devRoot);
    expect(status).toEqual({ nodes: [], writable: false, checked: false });
  });
});
