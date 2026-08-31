import type { Entry } from './protocol';

export type Action = { id: string; label: string; entry: Entry };

export const MODIFIERS = {
  ctrl: 0x01,
  shift: 0x02,
  alt: 0x04,
  gui: 0x08,
} as const;

export const MEDIA_ACTIONS: Action[] = [
  { id: 'play_pause', label: 'Play / Pause', entry: { kind: 'media', usage: 0xcd } },
  { id: 'stop',       label: 'Stop',         entry: { kind: 'media', usage: 0xb7 } },
  { id: 'prev',       label: 'Sebelumnya',   entry: { kind: 'media', usage: 0xb6 } },
  { id: 'next',       label: 'Berikutnya',   entry: { kind: 'media', usage: 0xb5 } },
  { id: 'vol_up',     label: 'Volume +',     entry: { kind: 'media', usage: 0xe9 } },
  { id: 'vol_down',   label: 'Volume −',     entry: { kind: 'media', usage: 0xea } },
  { id: 'mute',       label: 'Bisukan',      entry: { kind: 'media', usage: 0xe2 } },
];

export const MOUSE_ACTIONS: Action[] = [
  { id: 'left',        label: 'Klik kiri',    entry: { kind: 'mouse', ev: 1, val: 0x01 } },
  { id: 'right',       label: 'Klik kanan',   entry: { kind: 'mouse', ev: 1, val: 0x02 } },
  { id: 'middle',      label: 'Klik tengah',  entry: { kind: 'mouse', ev: 1, val: 0x04 } },
  { id: 'button4',     label: 'Tombol 4',     entry: { kind: 'mouse', ev: 1, val: 0x08 } },
  { id: 'button5',     label: 'Tombol 5',     entry: { kind: 'mouse', ev: 1, val: 0x10 } },
  { id: 'double',      label: 'Klik ganda',   entry: { kind: 'mouse', ev: 1, val: 0x03 } },
  { id: 'scroll_up',   label: 'Scroll naik',  entry: { kind: 'mouse', ev: 3, val: 0x01 } },
  { id: 'scroll_down', label: 'Scroll turun', entry: { kind: 'mouse', ev: 3, val: 0xff } },
];

export const SHORTCUTS: Action[] = [
  { id: 'show_desktop',   label: 'Tampilkan desktop (Win+D)', entry: { kind: 'key', mod: 0x08, usage: 0x07 } },
  { id: 'my_computer',    label: 'File Explorer (Win+E)',     entry: { kind: 'key', mod: 0x08, usage: 0x08 } },
  { id: 'lock',           label: 'Kunci layar (Win+L)',       entry: { kind: 'key', mod: 0x08, usage: 0x0f } },
  { id: 'close_window',   label: 'Tutup jendela (Ctrl+W)',    entry: { kind: 'key', mod: 0x01, usage: 0x1a } },
  { id: 'switch_windows', label: 'Ganti jendela (Alt+Tab)',   entry: { kind: 'key', mod: 0x04, usage: 0x2b } },
  { id: 'copy',           label: 'Salin (Ctrl+C)',            entry: { kind: 'key', mod: 0x01, usage: 0x06 } },
  { id: 'paste',          label: 'Tempel (Ctrl+V)',           entry: { kind: 'key', mod: 0x01, usage: 0x19 } },
  { id: 'cut',            label: 'Potong (Ctrl+X)',           entry: { kind: 'key', mod: 0x01, usage: 0x1b } },
];

/** Subset HID usage yang bisa dipilih sebagai tombol biasa. */
export const HID_KEYS: { usage: number; label: string }[] = [
  ...Array.from({ length: 26 }, (_, i) => ({
    usage: 0x04 + i, label: String.fromCharCode(65 + i),
  })),
  ...Array.from({ length: 9 }, (_, i) => ({
    usage: 0x1e + i, label: String(i + 1),
  })),
  { usage: 0x27, label: '0' },
  { usage: 0x28, label: 'Enter' },
  { usage: 0x29, label: 'Esc' },
  { usage: 0x2a, label: 'Backspace' },
  { usage: 0x2b, label: 'Tab' },
  { usage: 0x2c, label: 'Space' },
  ...Array.from({ length: 12 }, (_, i) => ({
    usage: 0x3a + i, label: `F${i + 1}`,
  })),
  { usage: 0x4f, label: 'Kanan' },
  { usage: 0x50, label: 'Kiri' },
  { usage: 0x51, label: 'Bawah' },
  { usage: 0x52, label: 'Atas' },
];
