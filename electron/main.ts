/**
 * GT65 Configurator — proses main Electron 44.2.0 (Linux).
 *
 * Fakta yang diverifikasi pada Electron 44.2.0 + GT65 nyata:
 *   - Izin HID TIDAK pernah melewati setPermissionRequestHandler (0 panggilan
 *     selama alur requestDevice penuh). Yang dipanggil adalah
 *     setPermissionCheckHandler dengan permission === 'hid'.
 *   - Tanpa check handler sama sekali, HID DIIZINKAN (bukan ditolak).
 *     Memasang handler ini memperketat, bukan melonggarkan.
 *   - event.preventDefault() pada 'select-hid-device' WAJIB bila callback
 *     dijawab asinkron. Uji A/B: tanpa preventDefault requestDevice selesai
 *     dengan 0 perangkat dalam ~168 ms; dengan preventDefault, 2 perangkat.
 *   - details.deviceList berisi SATU entri per perangkat FISIK. Memanggil
 *     callback dengan satu deviceId memberi izin untuk SELURUH interface.
 *   - details.device pada setDevicePermissionHandler TIDAK punya deviceId.
 *   - Isi `collections` pada deviceList NONDETERMINISTIK antar peluncuran.
 *     Jangan pernah membangun logika di atasnya — diskriminasi interface
 *     adalah tugas findConfigInterface() di renderer.
 */

import { app, BrowserWindow, Menu, dialog, net, protocol, session, shell } from 'electron';
import { promises as fs, realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { HOST, SCHEME, resolveAssetPath } from './lib/resolvePath';
import { gt65HidrawStatus } from './lib/hidAccess';

// R-M1: WM_CLASS Electron di Linux (native_window_views.cc) dibaca dari env
// CHROME_DESKTOP — diisi oleh lib/browser/init.ts milik Electron SENDIRI,
// sebelum skrip main aplikasi ini sempat berjalan. app.setName() di sini
// karenanya tidak pernah berpengaruh pada WM_CLASS; ia hanya mengubah
// app.getName(), yang menentukan direktori userData default (appData + nama
// aplikasi) — tempat localStorage renderer, satu-satunya salinan profil
// pengguna, disimpan. Memanggilnya berisiko memindahkan direktori itu tanpa
// membeli kecocokan WM_CLASS apa pun. Kecocokan yang sebenarnya datang dari
// `desktopName` + `syncDesktopName: true` di electron-builder.yml, yang
// membuat Electron mengisi CHROME_DESKTOP dengan nama .desktop yang benar
// sebelum modul ini bahkan dimuat. Lihat package.json ("desktopName") dan
// electron-builder.yml (blok linux).

const APP_ORIGIN = `${SCHEME}://${HOST}`;
const VENDOR_ID = 0x05ac;
const PRODUCT_ID = 0x024f;

const DEV_SERVER_URL = process.env.GT65_DEV_SERVER_URL ?? '';
const IS_DEV = DEV_SERVER_URL !== '';
const ALLOWED_ORIGIN = IS_DEV ? new URL(DEV_SERVER_URL).origin : APP_ORIGIN;
const DUMP_HID = process.env.GT65_DUMP_HID === '1';

/**
 * Di-realpath sekali supaya perbandingan containment membandingkan apel
 * dengan apel. Di dalam app.asar ini tetap benar — fs.realpath dan net.fetch
 * sama-sama memperlakukan arsip asar sebagai direktori.
 */
const DIST_ROOT = ((): string => {
  const p = path.join(__dirname, '..', 'dist');
  try {
    return realpathSync(p);
  } catch {
    return p; // dist belum dibangun (mode dev)
  }
})();

const CSP = [
  "default-src 'none'",
  `script-src ${APP_ORIGIN}`,
  `style-src ${APP_ORIGIN} 'unsafe-inline'`,
  `font-src ${APP_ORIGIN} data:`,
  `img-src ${APP_ORIGIN} data: blob:`,
  `connect-src ${APP_ORIGIN}`,
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

// --- 1. Skema privileged — WAJIB sebelum app ready --------------------------
// Memanggil ini setelah app ready melempar:
//   Error: protocol.registerSchemesAsPrivileged should be called before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true },
  },
]);

// --- 2. Melayani dist/ ------------------------------------------------------

const MIME_BY_EXT: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function plain(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

/**
 * C1: lintasan absolut 70-gt65.rules di dalam bundel terpaket, atau `null`
 * bila tak ditemukan. Sumbernya `process.resourcesPath` — pada AppImage itu
 * lintasan mount sekali-pakai (`/tmp/.mount_gt65XXXXXX/resources/...`), jadi
 * HARUS dibaca saat runtime, bukan dihardcode. Di mode dev `resourcesPath`
 * menunjuk ke dalam node_modules/electron/dist di mana berkas ini tidak ada;
 * fs.access memverifikasi keberadaannya sebelum dilaporkan ke renderer —
 * jangan pernah mengarang lintasan yang belum diverifikasi ada.
 */
async function udevRulesPath(): Promise<string | null> {
  const p = path.join(process.resourcesPath, '70-gt65.rules');
  try {
    await fs.access(p);
    return p;
  } catch {
    return null;
  }
}

/** Endpoint diagnostik: dipakai renderer untuk memperingatkan soal udev. */
async function serveHidAccess(): Promise<Response> {
  const [status, rulesPath] = await Promise.all([gt65HidrawStatus(), udevRulesPath()]);
  return new Response(JSON.stringify({ ...status, rulesPath }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function serveFromDist(request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return plain('Method Not Allowed', 405);
  }

  // Ledger #5: satu-satunya new URL() di berkas ini yang sebelumnya tak
  // dijaga try/catch. Kalau melempar (URL request.url rusak), protocol.handle
  // menolaknya dan pengguna mendapat halaman galat Chromium tanpa penjelasan.
  let pathname: string;
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return plain('Not Found', 404);
  }
  if (pathname === '/__gt65/hid-access') return serveHidAccess();

  const filePath = resolveAssetPath(request.url, DIST_ROOT);
  if (filePath === null) return plain('Forbidden', 403);

  // realpath menutup celah symlink keluar root sekaligus jadi uji keberadaan.
  let real: string;
  try {
    real = await fs.realpath(filePath);
  } catch {
    return plain('Not Found', 404);
  }
  if (real !== DIST_ROOT && !real.startsWith(DIST_ROOT + path.sep)) return plain('Forbidden', 403);

  const stat = await fs.stat(real).catch(() => null);
  if (stat === null || !stat.isFile()) return plain('Not Found', 404);

  // PENTING: untuk berkas yang tidak ada, net.fetch MELEMPAR, bukan 404.
  let upstream: Response;
  try {
    upstream = await net.fetch(pathToFileURL(real).toString());
  } catch (e) {
    // Ledger #6: net.fetch menyeragamkan EIO/EACCES/dst. jadi 404 senyap.
    // Blast radius nol di sini (berkas sudah lolos stat di atas), tapi ini
    // anti-pola yang sedang diburu proyek ini — dicatat, bukan ditelan.
    console.error(`[gt65] net.fetch gagal untuk ${real}:`, e);
    return plain('Not Found', 404);
  }
  if (!upstream.ok) return plain('Not Found', 404);

  const ext = path.extname(real).toLowerCase();
  const headers = new Headers();
  headers.set('content-type', MIME_BY_EXT[ext] ?? 'application/octet-stream');
  headers.set(
    'cache-control',
    ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  );
  if (ext === '.html') headers.set('content-security-policy', CSP);

  if (request.method === 'HEAD') {
    await upstream.body?.cancel();
    return new Response(null, { status: 200, headers });
  }
  return new Response(upstream.body, { status: 200, headers });
}

// --- 3. Izin ----------------------------------------------------------------

interface HidLike { vendorId: number; productId: number }

const isGt65 = (d: HidLike): boolean => d.vendorId === VENDOR_ID && d.productId === PRODUCT_ID;
const isAppOrigin = (o: string): boolean => o === ALLOWED_ORIGIN || o === `${ALLOWED_ORIGIN}/`;

/**
 * TIDAK memakai URL#origin: untuk skema non-special seperti app:, WHATWG URL
 * mengembalikan string "null". Menyusun dari protocol + host memberi
 * "app://gt65" yang bisa dibandingkan.
 */
function originOf(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

let pendingChooser: { callback: (id?: string | null) => void; timer: NodeJS.Timeout } | null = null;

function settleChooser(deviceId?: string | null): void {
  if (pendingChooser === null) return;
  clearTimeout(pendingChooser.timer);
  const { callback } = pendingChooser;
  pendingChooser = null;
  callback(deviceId);
}

function installHidHandlers(ses: Electron.Session): void {
  // Gerbang yang benar-benar menentukan boleh-tidaknya navigator.hid.
  // 'clipboard-sanitized-write' HARUS ikut: LogPanel.tsx:75 memakai
  // navigator.clipboard.writeText(); menolaknya mematikan tombol "Salin log".
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin) => {
    if (!isAppOrigin(requestingOrigin)) return false;
    return permission === 'hid' || permission === 'clipboard-sanitized-write';
  });

  ses.setPermissionRequestHandler((_wc, permission, callback, details) => {
    if (permission !== 'clipboard-sanitized-write') { callback(false); return; }
    callback(isAppOrigin(originOf(details.requestingUrl)));
  });

  ses.on('select-hid-device', (event, details, callback) => {
    // WAJIB. Tanpa ini Electron menjawab callback kosong segera setelah
    // listener kembali, sehingga jalur penundaan di bawah gagal senyap.
    event.preventDefault();

    if (DUMP_HID) {
      console.log('[gt65] select-hid-device deviceList:');
      console.log(JSON.stringify(details.deviceList, null, 2));
    }

    settleChooser(undefined);

    // Satu deviceId = satu perangkat fisik; Electron memberi izin untuk SEMUA
    // interface perangkat itu sekaligus. Pemilihan interface konfigurasi tetap
    // tugas findConfigInterface() di renderer.
    //
    // Dongle 2.4 GHz memakai VID/PID yang SAMA dengan mode kabel, jadi ketika
    // keduanya tercolok deviceList memuat dua perangkat fisik yang cocok.
    // Yang punya kanal konfigurasi hanya mode kabel (G4). Kita tidak bisa
    // memastikannya lewat collections — isinya di proses main tidak andal —
    // jadi dongle disingkirkan lewat nama produknya, dan kalau ternyata tidak
    // ada yang tersisa kita jatuh kembali ke kandidat mana pun supaya renderer
    // yang memberi pesan 'wrongmode' yang benar.
    const cocok = details.deviceList.filter(isGt65);
    const berkabel = cocok.filter((d) => !/dongle/i.test(d.name));
    const match = berkabel[0] ?? cocok[0];
    if (match !== undefined) { callback(match.deviceId); return; }

    // Tahan sebentar supaya pengguna yang mencolok keyboard setelah menekan
    // "Sambungkan" tetap terlayani. 10 detik adalah pilihan desain.
    pendingChooser = { callback, timer: setTimeout(() => settleChooser(undefined), 10_000) };
  });

  ses.on('hid-device-added', (_event, details) => {
    if (pendingChooser === null || !isGt65(details.device)) return;
    const id = details.device.deviceId;
    if (typeof id !== 'string' || id === '') return; // callback kosong membatalkan permintaan
    settleChooser(id);
  });

  // Membuat getDevices() menjawab TANPA requestDevice() sejak halaman pertama.
  // Ini BUKAN yang membuat izin bertahan lintas navigasi — itu terjadi tanpanya.
  ses.setDevicePermissionHandler((details) => {
    if (details.deviceType !== 'hid') return false;
    if (details.origin !== ALLOWED_ORIGIN) return false;
    return isGt65(details.device as HidLike);
  });
}

// --- 4. Penguncian navigasi -------------------------------------------------

async function openExternal(target: string): Promise<void> {
  try {
    const { protocol: proto } = new URL(target);
    if (proto === 'http:' || proto === 'https:') await shell.openExternal(target);
  } catch { /* URL tidak valid — abaikan */ }
}

function lockDownNavigation(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (details) => {
      const sameApp = IS_DEV
        ? details.url.startsWith(DEV_SERVER_URL)
        : details.url.startsWith(`${APP_ORIGIN}/`);
      if (!sameApp) { details.preventDefault(); void openExternal(details.url); }
    });
    contents.setWindowOpenHandler(({ url }) => { void openExternal(url); return { action: 'deny' }; });
    contents.on('will-attach-webview', (event) => { event.preventDefault(); });
  });
}

// --- 5. Jendela -------------------------------------------------------------

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 1024, minHeight: 700,
    backgroundColor: '#0b0d10', show: false, title: 'GT65 Configurator',
    webPreferences: {
      // Tidak ada preload: renderer tidak butuh apa pun dari Node. Diverifikasi:
      // HIDDevice.open() berhasil dengan sandbox: true tanpa preload apa pun.
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      webviewTag: false, spellcheck: false,
    },
  });
  win.once('ready-to-show', () => win.show());

  /**
   * I3: tanpa ini, kegagalan memuat berarti 'ready-to-show' tidak pernah
   * menyala — proses hidup dengan jendela tak terlihat, dan karena
   * requestSingleInstanceLock() peluncuran berikutnya cuma memfokuskan
   * jendela hantu itu lalu keluar. Tidak boleh ada keadaan "proses hidup,
   * jendela tak terlihat, pengguna tidak diberi tahu": catat ke stderr DAN
   * paksa jendela terlihat dengan pesan galat yang jelas.
   */
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    console.error(
      `[gt65] Gagal memuat jendela (${errorCode} ${errorDescription}): ${validatedURL}`,
    );
    win.show();
    dialog.showErrorBox(
      'GT65 Configurator gagal dimuat',
      `Antarmuka aplikasi gagal dimuat.\n\n`
      + `Galat: ${errorDescription || 'tidak diketahui'} (${errorCode})\n`
      + `Lintasan: ${validatedURL}\n\n`
      + 'Coba tutup dan jalankan ulang aplikasi. Bila terus terjadi, laporkan '
      + 'galat ini di repositori proyek (menu Bantuan → Repositori proyek).',
    );
  });

  win.loadURL(IS_DEV ? DEV_SERVER_URL : `${APP_ORIGIN}/index.html`).catch((err: unknown) => {
    console.error('[gt65] win.loadURL melempar:', err);
    win.show();
    dialog.showErrorBox(
      'GT65 Configurator gagal dimuat',
      `Pemanggilan loadURL melempar galat sebelum halaman mulai dimuat:\n\n${String(err)}\n\n`
      + 'Coba tutup dan jalankan ulang aplikasi.',
    );
  });
}

function buildMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Berkas', submenu: [{ role: 'quit', label: 'Keluar' }] },
    {
      label: 'Tampilan',
      submenu: [
        { role: 'reload', label: 'Muat ulang' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom asal' },
        { role: 'zoomIn', label: 'Perbesar' },
        { role: 'zoomOut', label: 'Perkecil' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Layar penuh' },
        { role: 'toggleDevTools', label: 'Alat pengembang' },
      ],
    },
    {
      label: 'Bantuan',
      submenu: [{
        label: 'Repositori proyek',
        click: () => { void openExternal('https://github.com/RevDonz/gt65-web'); },
      }],
    },
  ]));
}

// --- 6. Daur hidup ----------------------------------------------------------
// Satu instans saja: dua instans berebut hidraw yang sama akan saling menutup
// pegangan perangkat, dan gejalanya terbaca seperti keyboard yang bermasalah.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win !== undefined) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  lockDownNavigation();

  void app.whenReady().then(() => {
    // Mode dev dilayani vite lewat http://localhost, yang sudah secure context.
    if (!IS_DEV) protocol.handle(SCHEME, serveFromDist);
    installHidHandlers(session.defaultSession); // melempar bila dipanggil sebelum ready
    buildMenu();
    createWindow();
  });

  // Linux saja: tidak ada app.on('activate') (macOS).
  app.on('window-all-closed', () => { app.quit(); });
}
