import { describe, expect, it } from 'vitest';
import { pickGt65Nodes } from '../electron/lib/hidAccess';

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
