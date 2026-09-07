# GT65 Configurator Desktop (Linux) — Desain

**Tanggal:** 2026-09-07
**Status:** disetujui untuk implementasi
**Dokumen pendahulu:** `2026-08-31-gt65-web-configurator-design.md`

> **Revisi 2, 2026-09-07.** Dokumen ini pernah memuat empat pernyataan yang keliru
> tentang API Electron dan satu instruksi yang tidak mungkin dijalankan. Semuanya
> ditemukan lewat verifikasi terhadap `electron.d.ts`, source Chromium, dan
> eksekusi sungguhan di mesin ini. Yang berubah dicatat di Bagian 12 supaya
> kekeliruannya bisa ditelusuri, bukan dihapus diam-diam.

---

## 1. Latar belakang

`gt65-web` sudah berjalan sebagai halaman web statis: React + WebHID, protokol hasil
rekayasa balik `DeviceDriver.exe`, dengan golden test byte sebagai jaring pengaman
utama. Aplikasinya bekerja, tetapi cara memakainya menuntut pengguna membuka peramban
Chromium, mengarahkannya ke sebuah URL, dan memahami bahwa "situs" itulah yang
menyimpan satu-satunya salinan konfigurasi keyboard mereka.

Dokumen ini merancang pembungkusan aplikasi yang sama menjadi aplikasi desktop Linux,
lalu merilisnya sebagai artefak biner di GitHub.

**Yang berubah adalah cara distribusinya, bukan kemampuannya.** Tidak ada fitur baru,
tidak ada perubahan protokol, tidak ada berkas di `src/gt65/` yang disentuh — dengan
satu pengecualian yang dijelaskan di Bagian 2 dan dirancang di Bagian 4.7.

### 1.1 Mengapa Linux saja

Pengguna Windows sudah punya software vendor. Software itu berjalan, ditandatangani,
dan sudah dibongkar tuntas di `ANALYSIS.md` — membangun paket Windows berarti
menduplikasi sesuatu yang sudah tersedia di platform itu. Linux justru satu-satunya
tempat pengguna GT65 tidak punya apa-apa, dan itulah alasan proyek ini ada sejak awal
(`PARITY.md` §6.1).

Mempersempit lingkup juga menghapus seluruh persoalan yang paling tidak bisa
dibuktikan dari rencana semula: tidak ada Gatekeeper, tidak ada notarisasi, tidak ada
SmartScreen, tidak ada tanda tangan ad-hoc yang perilakunya hanya bisa ditebak dari
log CI, dan tidak ada matriks runner.

macOS tetap tidak terlayani. Itu konsekuensi yang diterima sadar; jalurnya tetap
terbuka karena tidak ada keputusan di dokumen ini yang mengunci Electron ke Linux.

### 1.2 Mengapa Electron, bukan Qt

Dievaluasi ulang setelah lingkup dipersempit, karena alasan asli memilih Electron —
satu basis kode untuk tiga sistem operasi — kehilangan bobotnya begitu hanya Linux
yang dilayani.

**QtWebEngine tidak bisa menjalankan aplikasi ini.** `ContentBrowserClientQt` tidak
pernah menyediakan `content::HidDelegate` di branch 6.8 sampai `dev` (nol kecocokan
`hid` di 706 berkas `src/`), dan `HidService::Create()` di Chromium keluar diam-diam
bila delegate itu `nullptr` (`content/browser/hid/hid_service.cc:139-142`).

Cara gagalnya yang mendiskualifikasinya. Qt mematikan `kWebUsb` tetapi tidak
`WebHID`, sehingga sisi Blink tetap hidup sementara sisi browser mati, dan
`HID::CloseServiceConnection()` **me-resolve** promise dengan array kosong alih-alih
me-reject. Diuji sungguhan: `src/gt65/device.ts` tanpa modifikasi, dimuat di
QtWebEngine 6.11.2 pada mesin ini, menghasilkan `DeviceError kind=notfound` dengan
**nol pesan konsol dan nol stderr**. Berkas yang sama di Electron 44.2.0 mencapai
`wrongmode` — pesan yang benar. Proyek yang seluruh disiplinnya dibangun melawan
kegagalan senyap tidak boleh memilih platform yang gagal senyap di lapisan yang
golden test tidak bisa jangkau.

**Qt native adalah penulisan ulang, dan premis keuntungannya keliru.** G2 dan G6
gugur karena meninggalkan **WebHID**, bukan karena meninggalkan **Electron**:
`node-hid` adalah hidapi, dan hidapi di Linux adalah `HIDIOCSFEATURE`/`HIDIOCGFEATURE`
— dua ioctl yang sama yang akan dipanggil Qt. Qt tidak membuka satu pun fitur yang
tidak dibuka Electron + `node-hid`. Sisa keunggulannya adalah memori dan waktu buka
(265 → 50 MiB PSS), dengan harga sekitar 30 hari-kerja lawan 12, pada aplikasi yang
dibuka beberapa kali setahun.

---

## 2. Lingkup

Masuk:

- Proses main Electron yang memuat aplikasi renderer yang ada, apa adanya
- Origin aman lewat skema protokol kustom, supaya WebHID hidup di luar peramban
- Pemberian izin HID dari sisi proses main
- Kemandirian offline: font dibundel lokal
- Paket Linux lintas keluarga distro, dengan aturan udev terpasang otomatis di mana
  format paketnya memungkinkan
- Integrasi desktop freedesktop.org: `.desktop`, ikon hicolor, AppStream metainfo
- Workflow GitHub Actions yang membangun dan menerbitkan rilis dari tag
- Dokumentasi pemasangan per keluarga distro

Masuk, meski bukan pembungkusan — **deteksi akses hidraw hanya-baca** (Bagian 4.7).
Ini satu-satunya perubahan perilaku aplikasi yang dokumen ini izinkan, dan alasannya
memaksa: `services/device/hid/hid_service_linux.cc` membuka perangkat dengan
`FLAG_OPEN | FLAG_READ | FLAG_WRITE` dan **mundur ke hanya-baca bila akses ditolak**.
Artinya tanpa aturan udev, `device.open()` tetap sukses, `opened` tetap `true`, dan
setiap penulisan gagal tanpa satu pun galat. Karena AppImage tidak punya langkah
instalasi dan tidak bisa memasang aturan udev, merilisnya tanpa deteksi ini berarti
mendistribusikan aplikasi yang rusak secara senyap kepada sebagian pengguna. Itu
persis kegagalan yang seluruh proyek ini dibangun untuk mencegah.

Tidak masuk:

- Fitur apa pun yang bertanda **cannot** di `PARITY.md`. Membukanya menuntut
  pemindahan lapisan HID dari WebHID ke `node-hid`; itu proyek tersendiri (Bagian 11).
- Pembaruan otomatis. `PARITY.md` §6.9 mencatat "tanpa installer, tanpa proses
  residen, tanpa updater, tanpa telemetri" sebagai keunggulan atas software vendor.
- Perubahan pada versi web. Workflow `pages.yml` tetap apa adanya.

---

## 3. Kendala yang membentuk desain

### 3.1 WebHID menolak `file://`

`BrowserWindow.loadFile('dist/index.html')` menghasilkan dokumen dengan origin buram.
Origin buram bukan secure context, dan `navigator.hid` tidak terdefinisi di sana.
Aplikasi akan tampil normal sepenuhnya dan tidak pernah menemukan keyboard.

**Keputusan:** proses main mendaftarkan skema `app://` sebagai privileged, lalu
melayani isi `dist/` lewatnya.

```ts
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])
```

Pendaftaran ini harus terjadi **sebelum** `app.whenReady()` — syarat API, dibuktikan
dengan sengaja membaliknya dan mendapat error. Jendela memuat `app://gt65/index.html`.

Alternatif yang ditolak: server HTTP lokal. Berfungsi, tetapi membuka port yang
menyimak hanya untuk melayani berkas statis miliknya sendiri.

### 3.2 Aplikasi ini multi-halaman

`vite.config.ts` membangun enam entri HTML terpisah; `src/main.tsx` membaca
`document.body.dataset.page`. Berpindah tab berarti navigasi dokumen penuh.

Keenam halaman karena itu harus berbagi satu origin. Skema `app://` dengan host tetap
`gt65` memenuhi ini. Pegangan `HIDDevice` yang terbuka hilang saat navigasi, dan itu
sudah tertangani oleh `restoreAuthorizedDevice()` di `useDevice.ts`.

### 3.3 Font ditarik dari jaringan

Keenam berkas HTML memuat `<link>` ke `fonts.googleapis.com`. Di aplikasi desktop itu
berarti aplikasi butuh internet untuk tampil benar, dan tiap peluncuran mengirim
permintaan ke server Google. Proyek yang mengiklankan dirinya bebas telemetri tidak
boleh melakukan itu.

**Keputusan:** font disimpan sendiri, `<link>` diganti `@font-face` lokal.

### 3.4 Izin HID di Electron

Electron **mengizinkan** HID secara bawaan; yang tidak ada adalah pemilih perangkat.
Tanpa handler `select-hid-device`, `requestDevice()` menyelesaikan diri dengan array
kosong — kegagalan yang tampak seperti "keyboard tidak ditemukan".

Konsekuensi yang tidak jelas dari luar: karena bawaannya mengizinkan, memasang
gerbang izin yang menolak semua permission kecuali `hid` justru **mematahkan yang
sebelumnya bekerja**. Terukur A/B: `navigator.clipboard.writeText()` di
`src/app/panels/LogPanel.tsx:75` berubah dari `WRITE_OK` menjadi
`NotAllowedError: Write permission denied`, mematikan tombol "Salin log". Gerbangnya
harus mengizinkan `hid` **dan** `clipboard-sanitized-write`.

### 3.5 Tanpa aturan udev, aplikasi rusak secara senyap

Node hidraw GT65 adalah `root:root 0660`. Yang membuatnya bisa dibuka pengguna
hanyalah ACL dari `TAG+="uaccess"`. Sistem tidak memberikannya secara bawaan: satu-
satunya baris hidraw di `70-uaccess.rules` milik systemd adalah
`ENV{ID_AV_PRODUCTION_CONTROLLER}=="1"`.

Tanpa aturan itu, enumerasi tetap berhasil (membaca sysfs yang world-readable),
`open()` tetap sukses karena Chromium mundur ke hanya-baca, dan penulisan gagal
tanpa pesan. **Kriteria peringkat format paket karena itu bukan "bisakah ia lolos
sandbox", melainkan "bisakah ia memasang aturan udev".**

### 3.6 Sandbox bukan ancamannya

Diverifikasi ke tiga berkas source Chromium: `open()` pada `/dev/hidraw*` terjadi di
**proses browser** lewat Device Service in-process. Tidak ada keputusan sandbox yang
memutus akses perangkat.

Yang tetap perlu diurus adalah aplikasinya mau start di Ubuntu 23.10+ yang membatasi
unprivileged user namespace. Dua hal sudah ditangani electron-builder 26.15.3 sendiri:
ia mengirim profil AppArmor untuk `.deb`/`.rpm` (`appArmorProfile` ada di
`DebOptions`, `RpmOptions`, `PacmanOptions` — dan benar tidak ada di `AppImageOptions`),
dan `AppRun` AppImage menyisipkan `--no-sandbox` sendiri ketika `unshare -Ur` gagal.

---

## 4. Arsitektur

### 4.1 Struktur berkas

```
electron/
  main.ts              proses main: daur hidup, jendela, protokol, izin, dump HID
  lib/
    resolvePath.ts     fungsi murni: URL app:// -> lintasan berkas, dengan penjagaan
scripts/
  build-electron.mjs   esbuild: electron/*.ts -> dist-electron/*.cjs
  dev-electron.mjs     tunggu vite dev server, lalu luncurkan electron
  check-fonts.mjs      gagalkan build bila berkas font tidak ikut ke dist/
build/
  icon.png             1024x1024, sumber ikon
  70-gt65.rules        aturan udev, dipasang paket dan dirilis sebagai aset lepas
  gt65-configurator.desktop
  gt65-configurator.metainfo.xml
electron-builder.yml
```

**Tidak ada `preload.ts`.** Renderer tidak membutuhkan apa pun dari Node — seluruh
percakapan dengan perangkat terjadi lewat WebHID di dalam Chromium. Menambahkan
preload kosong hanya menambah permukaan tanpa guna.

Renderer tidak berubah kecuali penggantian `<link>` font (Bagian 3.3) dan penambahan
deteksi hanya-baca (Bagian 4.7).

### 4.2 Alur izin HID

Dipasang pada `session.defaultSession`:

**`setPermissionCheckHandler`** — ini gerbangnya, bukan `setPermissionRequestHandler`.
Mengizinkan `hid` dan `clipboard-sanitized-write` untuk origin `app://gt65`; menolak
sisanya.

**`on('select-hid-device')`** — event milik `class Session` (`electron.d.ts:12676`),
**bukan** `WebContents`. Memberi pemilih perangkat yang Electron sendiri tidak punya.

**`setDevicePermissionHandler`** — mengembalikan `true` untuk perangkat yang cocok
vendor+produk. Perannya bukan membuat izin bertahan lintas navigasi: itu terjadi
tanpa handler ini (dibuktikan dengan menghapusnya — dokumen kedua tetap melihat dua
perangkat). Perannya lebih berguna dari itu — `getDevices()` menjawab **tanpa
`requestDevice()` sama sekali sejak halaman pertama**, sehingga pemilih perangkat
tinggal jadi cadangan dan pengguna tidak perlu menekan "Sambungkan".

### 4.3 Pemilihan interface terjadi di renderer, bukan di proses main

Revisi 1 dokumen ini menginstruksikan proses main memilih interface konfigurasi lewat
diskriminator "feature report ≥ 60 byte". **Instruksi itu dicabut: tidak mungkin
dijalankan.**

Isi `collections` pada `deviceList` proses main **nondeterministik**. Empat kali
dijalankan pada perangkat yang sama memberi tiga kali interface keyboard (4
collection) dan satu kali interface `0xFFB5` (2 collection). Logika apa pun di proses
main yang bertumpu pada isi `collections` akan bekerja pada sebagian peluncuran dan
gagal pada sebagian lain — bentuk kegagalan yang paling mahal untuk didiagnosis.

Aturan yang benar:

- **Proses main** hanya menyaring `vendorId === 0x05AC && productId === 0x024F`, lalu
  menyerahkan seluruh yang cocok. Tidak ada pemeriksaan collection di sini.
- **Renderer** melakukan diskriminasi lewat `findConfigInterface()` di
  `src/gt65/device.ts` yang sudah ada dan sudah teruji — feature report ≥ 60 byte —
  dan penolakan mode dongle lewat `looksLikeDongle()`. Kode ini tidak berubah.

Mekanisme `reportSize`/`reportCount` sendiri terbukti tersedia di runtime
(`reportCount:7, reportSize:8` teramati pada `inputReports`), jadi keraguan revisi 1
soal `interface FeatureReports {}` yang kosong di typings sudah terjawab — datanya ada.

### 4.4 `resolveAssetPath()` — pemetaan dan penjagaan

Fungsi murni. Memetakan `app://gt65/lighting.html` ke berkas di dalam `dist/`.
Path `/` ke `/index.html`; query dan fragment dibuang; lintasan dinormalkan lalu
diverifikasi masih di dalam root.

Diuji tembus terhadap `..` polos, `..%2f`, `%2e%2e%2f`, `/foo/..%2f..%2f`, byte `\0`,
persen rusak, dan symlink — semuanya tertahan.

### 4.5 Konfigurasi jendela

`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Navigasi keluar
(`will-navigate`) dan `window.open` (`setWindowOpenHandler`) diblokir; tautan
eksternal dibuka ke peramban sistem lewat `shell.openExternal`.

**Nol flag Ozone.** Electron 44 memilih Wayland sendiri ketika sesinya Wayland.
Memaksa `--ozone-platform=wayland` pada sesi X11 terbukti mematikan prosesnya —
diuji di mesin ini. Jangan tambahkan flag apa pun.

CSP dipasang di proses main. Setelah Bagian 3.3 dikerjakan, CSP tidak boleh lagi
memuat `fonts.googleapis.com` maupun `fonts.gstatic.com`.

### 4.6 Dev dan produksi

| | Dev | Produksi |
|---|---|---|
| Renderer | `http://localhost:5173` | `app://gt65/index.html` |
| Origin izin | `http://localhost:5173` | `app://gt65` |

Build produksi tidak boleh memberi izin HID kepada `localhost`.

### 4.7 Deteksi akses hidraw hanya-baca

Perilaku yang dituju: ketika perangkat terbuka tetapi tidak bisa ditulis, aplikasi
mengatakan apa yang terjadi dan memberi perintah yang bisa disalin, alih-alih
membiarkan pengguna menyimpulkan keyboardnya rusak.

Pesan galat izin yang ada di `src/gt65/device.ts` sekarang hanya muncul ketika
`open()` melempar. Kasus yang berbahaya justru ketika `open()` **tidak** melempar.
Deteksinya karena itu harus terjadi pada penulisan pertama, bukan pada pembukaan.

Instruksi yang ditampilkan sama dengan yang dirilis sebagai aset lepas:

```
sudo install -m644 70-gt65.rules /etc/udev/rules.d/70-gt65.rules
sudo udevadm control --reload-rules && sudo udevadm trigger --subsystem-match=hidraw --action=add
```

`/etc/udev/rules.d` bisa ditulis bahkan di Silverblue dan NixOS, jadi resep ini
berlaku universal.

---

## 5. Artefak rilis

| Target | Arsitektur | Aturan udev otomatis |
|---|---|---|
| `.deb` | x64, arm64 | ya |
| `.rpm` | x64 | ya |
| AppImage | x64, arm64 | tidak — ditangani Bagian 4.7 |
| `70-gt65.rules` | — | aset lepas untuk pemasangan manual |

**Tidak dirilis, dengan alasan:**

- **Flatpak** — secara teknis bekerja: dengan `--device=all`, Electron 44 di dalam
  runtime `org.gnome.Platform//49` membuka hidraw dengan sukses (diuji). Tetapi
  Flatpak tidak bisa menulis ke `/etc/udev/rules.d` dan tidak punya hook pasca-
  instalasi, jadi ia tidak menghilangkan satu pun langkah manual, sambil menuntut
  akses ke *semua* perangkat yang akan dipersoalkan reviewer Flathub. Usaha tinggi,
  nilai tambah nol.
- **Snap** — tidak layak. `interfaces/builtin/hidraw.go` mensyaratkan slot dari snap
  bertipe `core`/`gadget` yang tidak ada di desktop classic, dan `raw_usb.go` tidak
  menyebut hidraw sama sekali.
- **pacman** — `depends` bawaan electron-builder memuat paket yang sudah tidak ada di
  repo Arch (`http-parser`, `libappindicator-gtk3`). Sediakan PKGBUILD untuk AUR.
- **tar.gz** — sama buruknya dengan AppImage soal udev, tanpa integrasi desktop.

Cakupan keluarga distro: Debian/Ubuntu/Mint/Pop dan Fedora/RHEL/openSUSE tercakup
penuh. Arch, Void, Gentoo, NixOS, dan distro immutable tercakup lewat AppImage dengan
langkah udev manual. Alpine tidak tercakup — Electron butuh glibc.

Lantai glibc **2.25**, diukur atas setiap ELF di kedua arsitektur. Debian 11 dan
Ubuntu 20.04 tidak tersingkir olehnya; yang menyingkirkan mereka adalah kebijakan
dukungan Chromium, dan dokumen rilis harus menyebut keduanya, bukan salah satu.

---

## 6. Penandatanganan dan integritas

Linux tidak punya penghadang setara Gatekeeper atau SmartScreen, jadi tidak ada
persoalan penandatanganan untuk diselesaikan. AppImage perlu `chmod +x`; `.deb` dan
`.rpm` dipasang seperti paket lain.

Tiap rilis menyertakan `SHA256SUMS.txt` berisi nama dasar saja, sehingga
`sha256sum -c SHA256SUMS.txt` bisa dijalankan pengguna langsung.

---

## 7. Alur rilis

`.github/workflows/release.yml`, terpicu `push` pada tag `v*`, satu runner
`ubuntu-latest`. Tidak ada matriks.

1. `sudo apt-get install -y rpm xz-utils` — `rpmbuild` wajib untuk target rpm; `fpm`
   diunduh sendiri oleh electron-builder, Ruby tidak perlu dipasang
2. `npm ci`
3. `npm test`
4. `npm run build`
5. `npm run build:electron`
6. `npx electron-builder --linux --publish never`
7. `SHA256SUMS.txt`, lalu GitHub Release

Langkah 3 dan 4 mendahului packaging dengan sengaja: golden test byte adalah
mekanisme kebenaran utama proyek karena galat protokol gagal senyap, dan membangun
installer dari kode yang tidak lulus test berarti mendistribusikan paket yang mungkin
mengirim byte salah ke hardware yang tidak bisa dibaca balik.

Cache `~/.cache/electron` (zip 123 MB) dan `~/.cache/electron-builder` (83 MB).
Izin workflow: `contents: write`, tidak lebih.

Cross-build arm64 berjalan di runner x64 tanpa emulasi, tambahan sekitar satu menit.

---

## 8. Testing

Suite vitest yang ada (13 berkas, 201 test) harus tetap hijau tanpa perubahan. Itu
batas regresi.

`test/resolvePath.test.ts` — baru, ditulis lebih dulu:
`/` → `index.html`; `/lighting.html` → berkas itu; query dan fragment dibuang;
`/../../etc/passwd`, `..%2f..%2fetc/passwd`, `%2e%2e%2f`, byte `\0`, dan persen rusak
semuanya → `null`.

Tidak ada `test/selectDevice.test.ts`. Revisi 1 merencanakannya untuk logika yang
Bagian 4.3 sekarang cabut; menyaring vendor+produk tidak butuh berkas test sendiri.

Yang tidak bisa diuji otomatis, dan diverifikasi manual: `navigator.hid` terdefinisi
di jendela terpasang, dan keyboard sungguhan terdeteksi lewat kabel.

---

## 9. Verifikasi dan batasnya

Bisa diverifikasi di mesin ini:

- Suite test hijau; build produksi berhasil
- Aplikasi berjalan, `navigator.hid` terdefinisi, keenam halaman ter-render
- Navigasi antar halaman mempertahankan izin tanpa dialog ulang
- Aplikasi berjalan dengan jaringan mati
- `.deb`, `.rpm`, dan AppImage terbentuk, dan isinya memuat aturan udev di tempat
  yang benar

**Dua hal yang menuntut langkah di luar kendali saya, dan harus dikatakan apa adanya:**

1. **Keyboard sedang tersambung lewat dongle 2.4 GHz** (`HID_NAME=USB Dongle` pada
   ketiga node hidraw). Mode itu tidak punya kanal konfigurasi (G4). Verifikasi
   deteksi kanal konfigurasi menuntut kabel USB dicolokkan.
2. **Mesin ini tidak akan mereproduksi masalah Ubuntu 24.04.** Linux Mint 22.2
   memasang `/etc/sysctl.d/20-apparmor-mint.conf` yang menyetel
   `kernel.apparmor_restrict_unprivileged_userns` kembali ke `0`. Uji AppImage dan
   `.deb` di VM Ubuntu 24.04 asli, atau tiru dengan `aa-exec -p unprivileged_userns`.

Seluruh verifikasi dilakukan dengan **mode kering menyala**. Pembungkusan tidak
menyentuh protokol, jadi menulis ke perangkat tidak membuktikan apa pun tentangnya.

---

## 10. Versi

Rilis pertama: **v0.1.0**, ditandai prerelease.

Verifikasi hardware pada `docs/hardware-checklist.md` belum dijalankan, tombol
"Pulihkan bawaan" belum pernah menyentuh perangkat fisik, dan dua asumsi tentang
tombol Fn masih terbuka — salah satunya, kalau keliru, menghapus layer Fn pabrik
secara permanen.

---

## 11. Setelah ini

Membungkus aplikasi tidak dengan sendirinya membuka sembilan verdict **cannot** di
`PARITY.md`. Yang membukanya adalah meninggalkan WebHID:

- **G2** — `node-hid` di proses main memberi akses hidraw mentah tanpa filter
  collection Chromium. Tester tombol bisa membaca laporan HID sungguhan; Monitor
  Report ID 5 menjadi mungkin.
- **G6** — proses residen bisa menjalankan aksi sisi-host.

Itu refactor terhadap `device.ts` (189 baris) — satu-satunya berkas yang menyentuh
WebHID. Sisa lapisan protokol dan profil (1.783 baris TypeScript) tidak punya satu
pun impor DOM, sehingga 182 dari 201 test tetap berjalan tanpa perubahan. Kerjakan
sebagai proyek tersendiri dengan sesi hardware.

Prioritas backlog tidak berubah: memberi nama kelima flag pengaturan masih pekerjaan
bernilai-per-jam tertinggi, dan memverifikasi asumsi layer Fn masih blocker
keselamatan yang lebih mendesak daripada fitur mana pun.

---

## 12. Yang berubah di revisi 2

Dicatat supaya kekeliruannya bisa ditelusuri.

| Bagian | Revisi 1 | Revisi 2 |
|---|---|---|
| Lingkup | Windows + macOS + Linux, enam artefak | Linux saja |
| §3.4 | "Electron menolak HID secara bawaan" | Bawaannya mengizinkan; yang hilang pemilih perangkat |
| §4.2 | Gerbangnya `setPermissionRequestHandler` | `setPermissionCheckHandler`; harus mengizinkan clipboard juga |
| §4.2 | `setDevicePermissionHandler` membuat izin bertahan lintas navigasi | Salah kausalitas; izin bertahan tanpanya |
| §4.3 | Proses main memilih interface lewat feature report ≥ 60 byte | Dicabut — `collections` di main nondeterministik |
| §4.1 | `electron/preload.ts` | Tidak diperlukan |
| §4.3 | Bentuk `featureReports` belum pasti | Terbukti tersedia di runtime |
| Baru | — | §3.5, §3.6, §4.7: akses hidraw adalah ancaman sesungguhnya, bukan sandbox |
