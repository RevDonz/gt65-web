/**
 * Pemetaan `KeyboardEvent.code` → usage HID Keyboard/Keypad Page.
 *
 * Modul ini MURNI: tidak mengimpor apa pun, tidak menyentuh DOM, tidak
 * menyentuh WebHID. Ia hanya tabel + dua fungsi lookup, supaya bisa diuji
 * tanpa browser maupun perangkat.
 *
 * ALASAN MODUL INI ADA. Tab Tester tidak bisa membaca laporan HID keyboard
 * ini sendiri: Chromium memblokir koleksi Generic Desktop/Keyboard (usage
 * page 0x01, usage 0x06) demi keamanan, jadi `hid.requestDevice` tidak
 * pernah menyerahkan koleksi itu ke halaman web. Satu-satunya jalan yang
 * tersisa adalah membaca event `keydown`/`keyup` DOM — yaitu apa yang
 * SUDAH sampai ke sistem operasi. `KeyboardEvent.code` adalah posisi fisik
 * tombol (bukan karakter yang dihasilkan, itu `key`), sehingga ia bisa
 * dipetakan satu-satu ke usage HID tanpa terpengaruh layout keyboard
 * sistem — `KeyQ` tetap `KeyQ` di layout AZERTY sekalipun.
 *
 * Nilai usage mengikuti USB HID Usage Tables §10 (Keyboard/Keypad Page),
 * tabel yang sama yang dipakai `layout.ts` dan `keycodes.ts`.
 */

/**
 * Penanda internal vendor untuk tombol Fn (`layout.ts` memakai usage 175 =
 * 0xAF, yang di HID sebenarnya *Reserved* — lihat `FN_USAGE` di
 * `KeyboardGrid.tsx`). Disalin sebagai literal di sini, bukan diimpor,
 * supaya modul ini tetap murni dan tidak bergantung pada `app/`; sebuah tes
 * menjaga kedua nilai tetap sama.
 *
 * `Fn` adalah nilai `code` yang sah menurut spesifikasi UI Events, tapi
 * hampir tidak pernah dilaporkan sistem operasi karena kombinasi Fn
 * diselesaikan di firmware keyboard dan tidak pernah sampai ke OS. Ia
 * dipetakan di sini supaya tombol Fn tetap bisa ditandai kalau suatu saat
 * ada OS yang memang melaporkannya — bukan karena diharapkan muncul.
 */
export const FN_USAGE_FROM_CODE = 0xaf;

/**
 * `Map` (bukan objek biasa) supaya lookup tidak pernah bisa menabrak
 * anggota prototipe: `usageForCode('constructor')` harus `null`, bukan
 * sebuah fungsi.
 */
const CODE_TO_USAGE = new Map<string, number>([
  // Huruf — 0x04..0x1D, urut A..Z.
  ['KeyA', 0x04], ['KeyB', 0x05], ['KeyC', 0x06], ['KeyD', 0x07],
  ['KeyE', 0x08], ['KeyF', 0x09], ['KeyG', 0x0a], ['KeyH', 0x0b],
  ['KeyI', 0x0c], ['KeyJ', 0x0d], ['KeyK', 0x0e], ['KeyL', 0x0f],
  ['KeyM', 0x10], ['KeyN', 0x11], ['KeyO', 0x12], ['KeyP', 0x13],
  ['KeyQ', 0x14], ['KeyR', 0x15], ['KeyS', 0x16], ['KeyT', 0x17],
  ['KeyU', 0x18], ['KeyV', 0x19], ['KeyW', 0x1a], ['KeyX', 0x1b],
  ['KeyY', 0x1c], ['KeyZ', 0x1d],

  // Angka baris atas — 1..9 lalu 0 (0x1E..0x27).
  ['Digit1', 0x1e], ['Digit2', 0x1f], ['Digit3', 0x20], ['Digit4', 0x21],
  ['Digit5', 0x22], ['Digit6', 0x23], ['Digit7', 0x24], ['Digit8', 0x25],
  ['Digit9', 0x26], ['Digit0', 0x27],

  // Kontrol dan spasi.
  ['Enter', 0x28], ['Escape', 0x29], ['Backspace', 0x2a], ['Tab', 0x2b],
  ['Space', 0x2c],

  // Tanda baca.
  ['Minus', 0x2d], ['Equal', 0x2e], ['BracketLeft', 0x2f],
  ['BracketRight', 0x30], ['Backslash', 0x31], ['Semicolon', 0x33],
  ['Quote', 0x34], ['Backquote', 0x35], ['Comma', 0x36], ['Period', 0x37],
  ['Slash', 0x38], ['CapsLock', 0x39],

  // F1–F12.
  ['F1', 0x3a], ['F2', 0x3b], ['F3', 0x3c], ['F4', 0x3d], ['F5', 0x3e],
  ['F6', 0x3f], ['F7', 0x40], ['F8', 0x41], ['F9', 0x42], ['F10', 0x43],
  ['F11', 0x44], ['F12', 0x45],

  // Blok cetak/navigasi.
  ['PrintScreen', 0x46], ['ScrollLock', 0x47], ['Pause', 0x48],
  ['Insert', 0x49], ['Home', 0x4a], ['PageUp', 0x4b], ['Delete', 0x4c],
  ['End', 0x4d], ['PageDown', 0x4e],
  ['ArrowRight', 0x4f], ['ArrowLeft', 0x50], ['ArrowDown', 0x51],
  ['ArrowUp', 0x52],

  // Papan angka.
  ['NumLock', 0x53], ['NumpadDivide', 0x54], ['NumpadMultiply', 0x55],
  ['NumpadSubtract', 0x56], ['NumpadAdd', 0x57], ['NumpadEnter', 0x58],
  ['Numpad1', 0x59], ['Numpad2', 0x5a], ['Numpad3', 0x5b],
  ['Numpad4', 0x5c], ['Numpad5', 0x5d], ['Numpad6', 0x5e],
  ['Numpad7', 0x5f], ['Numpad8', 0x60], ['Numpad9', 0x61],
  ['Numpad0', 0x62], ['NumpadDecimal', 0x63],

  // Tombol tambahan yang lazim di papan non-US.
  ['IntlBackslash', 0x64], ['ContextMenu', 0x65],
  ['IntlRo', 0x87], ['IntlYen', 0x89],

  // Modifier — kiri lalu kanan (0xE0..0xE7).
  ['ControlLeft', 0xe0], ['ShiftLeft', 0xe1], ['AltLeft', 0xe2],
  ['MetaLeft', 0xe3], ['ControlRight', 0xe4], ['ShiftRight', 0xe5],
  ['AltRight', 0xe6], ['MetaRight', 0xe7],

  // Lihat doc comment `FN_USAGE_FROM_CODE`.
  ['Fn', FN_USAGE_FROM_CODE],
]);

/**
 * Usage HID untuk satu `KeyboardEvent.code`, atau `null` kalau kode itu
 * tidak dikenal. `null` bukan kegagalan: papan lain bisa mengirim `code`
 * yang tidak ada di tabel ini, dan Tester menampilkannya apa adanya.
 */
export function usageForCode(code: string): number | null {
  const usage = CODE_TO_USAGE.get(code);
  return usage === undefined ? null : usage;
}

/** Semua `code` yang dikenal — dipakai tes dan diagnostik, bukan UI. */
export function knownCodes(): string[] {
  return [...CODE_TO_USAGE.keys()];
}

/**
 * Semua usage yang bisa dihasilkan minimal satu `code`. Dipakai Tester
 * untuk menghitung berapa tombol papan ini yang memang bisa diuji lewat
 * event DOM, dan dipakai tes untuk membuktikan tiap tombol di `layout.ts`
 * terjangkau.
 */
export function reachableUsages(): Set<number> {
  return new Set(CODE_TO_USAGE.values());
}
