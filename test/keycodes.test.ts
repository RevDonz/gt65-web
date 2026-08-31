import { describe, expect, test } from 'vitest';
import { MEDIA_ACTIONS, SHORTCUTS, MOUSE_ACTIONS } from '../src/gt65/keycodes';
import { encodeEntry } from '../src/gt65/protocol';

describe('katalog aksi', () => {
  test('Play/Pause memakai consumer usage 0xCD', () => {
    const a = MEDIA_ACTIONS.find((x) => x.id === 'play_pause')!;
    expect(encodeEntry(a.entry)).toEqual([0x03, 0xcd, 0, 0]);
  });

  test('semua kode multimedia sesuai HID Consumer Page', () => {
    const want: Record<string, number> = {
      play_pause: 0xcd, stop: 0xb7, prev: 0xb6, next: 0xb5,
      vol_up: 0xe9, vol_down: 0xea, mute: 0xe2,
    };
    for (const [id, code] of Object.entries(want)) {
      const a = MEDIA_ACTIONS.find((x) => x.id === id)!;
      expect(encodeEntry(a.entry)[1]).toBe(code);
    }
  });

  test('shortcut Alt+Tab ter-encode sebagai modifier 0x04 usage 0x2B', () => {
    const a = SHORTCUTS.find((x) => x.id === 'switch_windows')!;
    expect(encodeEntry(a.entry)).toEqual([0x02, 0x04, 0x2b, 0]);
  });

  test('scroll turun memakai delta -1', () => {
    const a = MOUSE_ACTIONS.find((x) => x.id === 'scroll_down')!;
    expect(encodeEntry(a.entry)).toEqual([0x01, 3, 0xff, 0]);
  });
});
