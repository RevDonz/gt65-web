# GT65 Configurator Desktop — Desain

**Tanggal:** 2026-09-07
**Status:** disetujui untuk implementasi
**Dokumen pendahulu:** `2026-08-31-gt65-web-configurator-design.md`

---

## 1. Latar belakang

`gt65-web` sudah berjalan sebagai halaman web statis: React + WebHID, protokol hasil
rekayasa balik `DeviceDriver.exe`, dengan golden test byte sebagai jaring pengaman
utama. Aplikasinya bekerja, tetapi cara memakainya masih menuntut pengguna membuka
peramban Chromium, mengarahkannya ke sebuah URL, dan memahami bahwa "situs" itulah
yang menyimpan satu-satunya salinan konfigurasi keyboard mereka.

Dokumen ini merancang pembungkusan aplikasi yang sama menjadi aplikasi desktop yang
bisa dipasang di Windows, Linux, dan macOS, lalu dirilis sebagai artefak biner di
GitHub.

**Yang berubah adalah cara distribusinya, bukan kemampuannya.** Tidak ada fitur baru,
tidak ada perubahan protokol, tidak ada berkas di `src/gt65/` yang disentuh.

---

## 2. Lingkup

Masuk:

- Proses main Electron yang memuat aplikasi renderer yang sudah ada, apa adanya
- Origin aman lewat skema protokol kustom, supaya WebHID hidup di luar peramban
- Pemberian izin HID dari sisi proses main
- Kemandirian offline: font dibundel lokal
- Konfigurasi `electron-builder` untuk enam artefak di tiga sistem operasi
- Workflow GitHub Actions yang membangun dan menerbitkan rilis dari tag
- Dokumentasi pemasangan per sistem operasi, termasuk cara melewati peringatan OS

Tidak masuk:

- Fitur apa pun yang saat ini bertanda **cannot** di `PARITY.md`. Aplikasi desktop
  secara teknis membatalkan dua aturan dasar yang melahirkan verdict itu — G2
  (Chromium memblokir HID collection terproteksi) dan G6 (aksi sisi-host butuh proses
  residen) — tetapi memanfaatkannya berarti memindahkan lapisan HID ke `node-hid`,
  dan itu proyek tersendiri. Lihat Bagian 11.
- Pembaruan otomatis. `PARITY.md` §6.9 mencatat "tanpa installer, tanpa proses
  residen, tanpa updater, tanpa telemetri" sebagai keunggulan atas software vendor.
  Menambahkan updater berarti membuang salah satu poin itu.
- Penandatanganan kode berbayar. Lihat Bagian 6.
- Perubahan pada versi web. Workflow `pages.yml` tetap apa adanya; kedua bentuk
  distribusi hidup berdampingan dari satu basis kode.

---

## 3. Kendala yang membentuk desain

### 3.1 WebHID menolak `file://`

Ini kendala yang paling menentukan, dan yang paling mudah dilewatkan karena gagalnya
tidak dramatis. `BrowserWindow.loadFile('dist/index.html')` — cara paling lazim memuat
aplikasi Electron — menghasilkan dokumen dengan origin buram (*opaque*). Origin buram
bukan secure context, dan `navigator.hid` tidak didefinisikan di sana.

Akibatnya aplikasi tampil normal sepenuhnya: UI ter-render, navigasi jalan, panel
terbuka. Hanya saja tidak akan pernah menemukan keyboard, dan pesan galatnya akan
terbaca seolah keyboardnya yang bermasalah.

**Keputusan:** proses main mendaftarkan skema `app://` sebagai privileged, lalu
melayani isi `dist/` lewatnya.

```
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])
```

Pendaftaran ini harus terjadi **sebelum** `app.whenReady()` — ini syarat API Electron,
bukan preferensi. Setelah siap, `protocol.handle('app', ...)` melayani permintaan, dan
jendela memuat `app://gt65/index.html`.

Alternatif yang ditolak: menjalankan server HTTP lokal di dalam aplikasi. Berfungsi,
tetapi membuka port yang menyimak di mesin pengguna hanya untuk melayani berkas
statis miliknya sendiri — permukaan serangan tanpa imbalan.

### 3.2 Aplikasi ini multi-halaman

`vite.config.ts` membangun enam entri HTML terpisah (`index`, `lighting`, `tester`,
`settings`, `monitor`, `log`), dan `src/main.tsx` membaca `document.body.dataset.page`
untuk memilih panel. Berpindah tab berarti navigasi dokumen penuh, bukan perutean
sisi klien.

Dua konsekuensi:

1. Keenam halaman harus berbagi satu origin, kalau tidak izin perangkat hilang tiap
   kali pengguna pindah tab. Skema `app://` dengan host tetap `gt65` memenuhi ini.
2. Pegangan `HIDDevice` yang terbuka bersifat per-dokumen dan pasti hilang saat
   navigasi. Ini sudah tertangani: `useDevice.ts` memanggil
   `restoreAuthorizedDevice()` saat mount, yang menyambung ulang lewat
   `navigator.hid.getDevices()`. Yang perlu dijamin desain ini adalah `getDevices()`
   tetap mengembalikan perangkat setelah navigasi — lihat Bagian 4.2.

### 3.3 Font ditarik dari jaringan

Keenam berkas HTML memuat `<link>` ke `fonts.googleapis.com` untuk Archivo dan Martian
Mono. Di halaman web ini wajar. Di aplikasi desktop ini berarti dua hal yang keduanya
tidak diinginkan: aplikasi butuh internet supaya tampil benar, dan tiap peluncuran
mengirim permintaan ke server Google.

Proyek yang mengiklankan dirinya bebas telemetri tidak boleh melakukan itu.

**Keputusan:** unduh berkas font, simpan di `public/fonts/`, ganti `<link>` menjadi
`@font-face` lokal di `src/index.css`. Aplikasi menjadi mandiri sepenuhnya.

### 3.4 Izin HID di Electron bawaannya ditolak

Berbeda dari Chromium biasa yang memunculkan pemilih perangkat kepada pengguna,
Electron menolak semua permintaan HID kecuali aplikasi memasang handler. Tanpa itu,
`requestDevice()` menyelesaikan diri dengan array kosong — lagi-lagi kegagalan yang
tampak seperti "keyboard tidak ditemukan".

---

## 4. Arsitektur

### 4.1 Struktur berkas

```
electron/
  main.ts              proses main: daur hidup, jendela, protokol, izin
  preload.ts           minimal; contextIsolation menyala, nodeIntegration mati
  lib/
    selectDevice.ts    fungsi murni: pilih perangkat dari daftar kandidat
    resolvePath.ts     fungsi murni: URL app:// -> lintasan berkas, dengan penjagaan
scripts/
  build-electron.mjs   esbuild: electron/*.ts -> dist-electron/*.cjs
  dev-electron.mjs     tunggu vite dev server, lalu luncurkan electron
build/
  icon.png             1024x1024, sumber untuk semua ikon turunan
electron-builder.yml
```

Renderer tidak berubah. `src/`, `test/`, `index.html`, dan kelima HTML lainnya tetap
seperti sekarang, kecuali penggantian `<link>` font pada Bagian 3.3.

### 4.2 Alur izin HID

Tiga handler dipasang pada `session.defaultSession`:

**`setPermissionRequestHandler`** — mengizinkan permission `hid` hanya bila origin
pemohon adalah `app://gt65`. Semua permission lain, dan semua origin lain, ditolak.

**`on('select-hid-device')`** — dipicu oleh `navigator.hid.requestDevice()` di
renderer. Handler menyerahkan daftar kandidat ke `selectHidDevice()` dan memanggil
`callback()` dengan `deviceId` yang terpilih, atau `callback()` tanpa argumen bila
tidak ada yang cocok — yang membuat `requestDevice()` mengembalikan array kosong dan
UI menampilkan pesan "tidak ada perangkat" yang sudah ada.

**`setDevicePermissionHandler`** — mengembalikan `true` untuk perangkat yang cocok,
sehingga izin bertahan dan `navigator.hid.getDevices()` tetap menjawab setelah
navigasi antar halaman (Bagian 3.2).

### 4.3 `selectHidDevice()` — aturan pemilihan

Fungsi murni, diuji terpisah dari Electron.

Masalahnya bukan sekadar mencocokkan vendor dan produk. Keyboard ini memunculkan
**tiga** node hidraw dengan `05AC:024F` yang sama (terverifikasi pada unit yang
terpasang saat penulisan dokumen ini), dan hanya satu di antaranya yang membawa kanal
konfigurasi 64-byte. Kalau proses main memberikan interface yang salah, renderer akan
gagal dengan "Kanal konfigurasi tidak ditemukan" — dan pengguna akan membaca itu
sebagai keyboardnya yang salah.

Aturannya karena itu meniru persis diskriminator yang sudah dipakai dan sudah teruji
di renderer, `findConfigInterface()` pada `src/gt65/device.ts`: **interface
konfigurasi adalah yang punya feature report berukuran ≥ 60 byte**, dihitung dari
`reportSize × reportCount` seluruh item di dalamnya.

- Nol kandidat cocok vendor+produk → `null`.
- Ada kandidat dengan feature report ≥ 60 byte → kandidat itu.
- Ada kandidat tapi tak satu pun memenuhi, dan salah satunya ber-usage page `0xFFB5` →
  `null`; ini mode dongle 2.4 GHz (G4), dan penolakannya memang benar.
- Ada kandidat tapi tak satu pun memenuhi, tanpa `0xFFB5` → `null`.

**Satu hal yang belum terverifikasi dan harus diperiksa lebih dulu.** Electron menyebut
`collections` pada objek `HIDDevice` di `deviceList`, tetapi mendeklarasikan tipe
`FeatureReports` sebagai interface kosong di `electron.d.ts` 44.2.0 — jadi apakah data
runtime-nya benar-benar membawa `items` dengan `reportSize`/`reportCount` tidak bisa
dipastikan dari dokumentasi. Belum pasti pula apakah `deviceList` memuat satu entri per
perangkat fisik (dengan collection tergabung, seperti yang dilakukan Blink) atau satu
entri per interface HID.

Karena itu **langkah implementasi pertama adalah membuang isi `deviceList` yang
sebenarnya ke konsol pada keyboard yang terpasang**, sebelum menulis logika seleksi
final. Kalau `items` ternyata tidak tersedia, diskriminatornya turun ke usage page
collection (`0x0C` Consumer untuk kanal konfigurasi, `0xFFB5` untuk dongle) dan
dokumen ini diperbarui dengan alasannya. Menebak di sini akan menghasilkan aplikasi
yang gagal di tangan pengguna dengan pesan yang menyesatkan.

### 4.4 `resolveAssetPath()` — pemetaan dan penjagaan

Fungsi murni. Memetakan `app://gt65/lighting.html` ke berkas di dalam `dist/`.

- Path `/` dipetakan ke `/index.html`.
- Path dinormalkan, lalu diverifikasi masih berada di dalam root. Yang keluar dari
  root ditolak — `..%2f`, `..\\`, dan lintasan absolut termasuk yang ditolak.
- Query string dan fragment dibuang sebelum resolusi.

Penjagaan ini ada karena handler protokol melayani berkas berdasarkan string yang
dikendalikan halaman. Halamannya memang milik kita, tetapi menjadikan itu satu-satunya
alasan keamanan berarti bergantung pada asumsi yang bisa berubah.

### 4.5 Konfigurasi jendela

`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Preload tidak
menyingkap apa pun ke renderer — renderer tidak membutuhkan akses Node, seluruh
percakapan dengan perangkat terjadi lewat WebHID di dalam Chromium.

Ukuran 1280×860, minimum 1024×700. Menu aplikasi diringkas: menu bawaan Electron
memuat entri yang tidak relevan bagi aplikasi ini.

Navigasi ke luar (`will-navigate`) dan `window.open` diblokir, kecuali penanganan
tautan eksternal yang dibuka ke peramban bawaan sistem.

### 4.6 Dev dan produksi

| | Dev | Produksi |
|---|---|---|
| Renderer | `http://localhost:5173` | `app://gt65/index.html` |
| Origin izin | `http://localhost:5173` | `app://gt65` |
| Proses main | esbuild watch | `dist-electron/main.cjs` |

`http://localhost` sudah merupakan secure context, jadi WebHID hidup di mode dev tanpa
skema kustom. Origin yang diizinkan berbeda antara kedua mode, dan itu disengaja:
build produksi tidak boleh memberi izin HID kepada `localhost`.

---

## 5. Artefak rilis

| OS | Target | Arsitektur |
|---|---|---|
| Windows | NSIS installer | x64 |
| Windows | Portable `.exe` | x64 |
| macOS | DMG | arm64 |
| macOS | DMG | x64 |
| Linux | AppImage | x64 |
| Linux | `.deb` | x64 |

Paket `.deb` memasang `/usr/lib/udev/rules.d/70-gt65.rules` berisi aturan yang
sekarang harus ditulis tangan sesuai README. Pengguna `.deb` tidak perlu langkah itu
lagi; pengguna AppImage tetap perlu, dan dokumentasi harus mengatakannya.

Aturan udev-nya juga mengenai keyboard Apple asli, karena GT65 memakai Vendor ID
Apple. Ini sudah tercatat di README dan tidak berubah.

---

## 6. Penandatanganan kode

**Tidak ada artefak yang ditandatangani.** Ini keputusan sadar, bukan kelalaian.
Sertifikat Apple Developer ID berbiaya $99/tahun dan sertifikat code signing Windows
sekitar $200/tahun ke atas; proyek ini tidak punya anggaran, dan menunda rilis sampai
punya berarti tidak merilis.

Konsekuensinya harus dinyatakan terus terang, bukan disembunyikan:

- **Windows** — SmartScreen menampilkan "Windows protected your PC". Pengguna menekan
  "More info" lalu "Run anyway".
- **macOS** — DMG tanpa notarisasi. Pengguna membuka lewat klik-kanan → Open, atau
  menjalankan `xattr -cr /Applications/GT65\ Configurator.app`.
- **Linux** — tidak ada penghadang. AppImage perlu `chmod +x`.

Aplikasi macOS ditandatangani secara *ad-hoc* (`identity: null` pada
`electron-builder`, yang tetap menerapkan tanda tangan ad-hoc pada arm64 karena
binary arm64 tanpa tanda tangan sama sekali tidak akan dijalankan Gatekeeper). Yang
perlu dicatat: hal ini **belum diverifikasi** untuk versi `electron-builder` yang
dipakai, dan harus dikonfirmasi dari log build CI sebelum rilis diumumkan. Kalau
ternyata tidak, konfigurasinya diperbaiki agar menandatangani ad-hoc secara eksplisit.

Sebagai ganti jaminan kriptografis dari sertifikat, tiap rilis menyertakan
`SHA256SUMS.txt`.

---

## 7. Alur rilis

`.github/workflows/release.yml`, terpicu `push` pada tag `v*`.

**Job `build`** — matriks `ubuntu-latest`, `windows-latest`, `macos-latest`:

1. `npm ci`
2. `npm test` — golden test byte, tidak butuh hardware
3. `npm run build` — `tsc --noEmit` lalu `vite build`
4. `npm run build:electron`
5. `npx electron-builder --publish never`
6. Unggah artefak

Langkah 2 dan 3 mendahului packaging dengan sengaja. Golden test byte adalah mekanisme
kebenaran utama proyek ini karena galat protokol gagal secara diam-diam; membangun
installer dari kode yang tidak lulus test berarti mendistribusikan paket yang mungkin
mengirim byte salah ke hardware yang tidak bisa dibaca balik.

**Job `release`** — `needs: build`, mengunduh semua artefak, menghitung
`SHA256SUMS.txt`, membuat GitHub Release beserta catatan rilis yang memuat instruksi
Bagian 6.

Izin workflow: `contents: write`, tidak lebih.

---

## 8. Testing

Suite vitest yang ada (7 berkas) harus tetap hijau tanpa perubahan. Itu batas
regresi: kalau ada yang merah, berarti pembungkusan menyentuh sesuatu yang seharusnya
tidak disentuh.

Dua berkas test baru, ditulis lebih dulu sebelum implementasinya:

`test/selectDevice.test.ts`
- daftar kosong → `null`
- tiga interface `05AC:024F`, satu punya feature report 64 byte → yang itu yang
  terpilih, bukan sekadar yang pertama cocok
- vendorId cocok, productId tidak (keyboard Apple asli) → `null`
- kandidat dengan collection `0xFFB5` dan tanpa feature report besar (mode dongle
  2.4 GHz) → `null`
- kandidat dengan feature report < 60 byte saja → `null`

Fixture-nya diambil dari keluaran `deviceList` sungguhan pada keyboard yang terpasang,
bukan dikarang, supaya test menguji bentuk data yang benar-benar diberikan Electron.

`test/resolvePath.test.ts`
- `/` → `index.html`
- `/lighting.html` → berkas itu
- `/assets/x.js?v=1#a` → query dan fragment dibuang
- `/../../etc/passwd` → `null`
- `..%2f..%2fetc/passwd` ter-encode → `null`

Yang **tidak** bisa diuji otomatis: apakah `navigator.hid` benar-benar terdefinisi di
dalam jendela Electron yang terpasang. Itu diverifikasi manual dengan menjalankan
aplikasi hasil build di mesin Linux ini dan memeriksa konsol.

---

## 9. Verifikasi dan batasnya

Keyboard GT65 sungguhan **terpasang** di mesin pengembangan (`05AC:024F`, tiga node
hidraw, aturan udev sudah aktif). Jadi verifikasi berikut bukan simulasi:

- Suite test hijau
- Build produksi berhasil
- Aplikasi Linux hasil build berjalan, `navigator.hid` terdefinisi
- Keyboard sungguhan terdeteksi, dan interface yang terpilih adalah kanal konfigurasi
- Navigasi antar keenam halaman mempertahankan izin perangkat tanpa dialog ulang
- Aplikasi berjalan dengan jaringan mati (bukti font sudah lokal)

Verifikasi deteksi dilakukan dengan **mode kering menyala** — status bawaan aplikasi.
Tidak ada byte yang dikirim ke keyboard dalam rangka pekerjaan pembungkusan ini.
Pembungkusan tidak menyentuh protokol, jadi menulis ke perangkat tidak akan
membuktikan apa pun tentangnya, sementara risikonya nyata: perangkat gagal diam-diam
dan tidak bisa dibaca balik.

Yang **tidak** bisa diverifikasi di lingkungan ini, dan harus dilaporkan apa adanya:

- Artefak Windows dan macOS berjalan di sistem operasinya masing-masing. Yang bisa
  dibuktikan hanyalah CI berhasil membangunnya. Pernyataan rilis tidak boleh
  mengklaim lebih dari itu.
- Apakah tanda tangan ad-hoc macOS benar diterapkan (Bagian 6). Hanya bisa dibaca dari
  log build CI, bukan dari peluncuran sungguhan.

---

## 10. Versi

Rilis pertama: **v0.1.0**.

Bukan v1.0.0. Verifikasi hardware pada `docs/hardware-checklist.md` belum dijalankan,
tombol "Pulihkan bawaan" belum pernah menyentuh perangkat fisik, dan dua asumsi
tentang tombol Fn masih terbuka — salah satunya, kalau keliru, menghapus layer Fn
pabrik secara permanen. Nomor versi yang mengklaim kematangan yang belum ada adalah
bentuk ketidakjujuran yang paling mudah dilakukan.

---

## 11. Setelah ini

Di luar lingkup dokumen ini, tercatat supaya tidak hilang.

Membungkus aplikasi menjadi desktop membatalkan dua aturan dasar yang melahirkan
sembilan verdict **cannot** di `PARITY.md`:

- **G2** — proses main punya akses hidraw mentah lewat `node-hid`, tanpa filter
  collection Chromium. Tester tombol bisa membaca laporan HID sungguhan dari
  keyboard, bukan event DOM. Monitor tombol (Report ID 5) menjadi mungkin.
- **G6** — aplikasi bisa tinggal residen dan menjalankan aksi sisi-host: Open Program,
  Send Text, aksi daya, dan pengikatan profil per-aplikasi.

Keduanya menuntut lapisan HID dipindahkan dari WebHID ke `node-hid` di proses main,
dengan renderer berbicara lewat IPC. Itu refactor terhadap `src/gt65/device.ts` dan
`useDevice.ts` — satu-satunya bagian basis kode yang sudah teruji terhadap hardware
sungguhan, dan karena itu bagian yang paling mahal kalau rusak. Kerjakan sebagai
proyek tersendiri, dengan sesi hardware, bukan sebagai tambahan pada pekerjaan
pembungkusan ini.

Prioritas backlog yang tidak berubah karena dokumen ini tetap seperti `PARITY.md` §7:
memberi nama kelima flag pengaturan masih pekerjaan dengan nilai per jam tertinggi,
dan memverifikasi asumsi layer Fn masih blocker keselamatan.
