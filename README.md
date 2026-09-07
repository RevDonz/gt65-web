# GT65 Configurator

Konfigurator berbasis browser untuk keyboard VortexSeries GT65, sebagai
pengganti software vendor yang hanya tersedia di Windows.

Protokolnya hasil rekayasa balik dari `DeviceDriver.exe` lewat disassembly.
Tiap transaksi diuji lewat golden test byte yang membandingkannya, byte demi
byte, dengan urutan yang dibaca dari disassembly tersebut — tapi ini adalah
verifikasi terhadap binary vendor, **bukan** terhadap hardware sungguhan.
Langkah verifikasi hardware (Task 1 pada `docs/hardware-checklist.md`) belum
dijalankan; lihat "Yang belum diketahui" di bawah.

## Yang perlu diketahui sebelum memakai

**Hanya Chromium.** Aplikasi memakai WebHID, yang hanya ada di Chrome, Edge,
Brave, dan Opera. Firefox dan Safari tidak mendukungnya dan tidak akan bisa.

**Hanya mode kabel.** Sambungkan keyboard dengan kabel USB. Lewat dongle
2.4 GHz, keyboard menampilkan layout HID berbeda yang tidak memuat kanal
konfigurasi; aplikasi akan menolak dengan pesan jelas.

**Keyboard diasumsikan tidak bisa dibaca.** Ini adalah asumsi kerja, bukan
fakta yang sudah dibuktikan: perangkat *diasumsikan* hanya menerima tulisan
dan tidak mengembalikan konfigurasinya, tapi langkah probe yang akan
memastikannya pada hardware sungguhan belum dijalankan (lihat "Yang belum
diketahui"). Karena itu **aplikasi ini yang menjadi sumber kebenaran**, bukan
keyboard. Profil disimpan di browser, dan tombol Terapkan selalu menulis
ulang seluruh konfigurasi. Pakai tombol **Ekspor profil** di bar navigasi
sebagai cadangan — lihat "Cadangan profil" di bawah.

**Mode kering aktif secara bawaan.** Aplikasi menampilkan paket yang akan
dikirim tanpa benar-benar mengirimnya. Matikan hanya kalau Anda siap menulis.

## Memasang aplikasi desktop

Unduh dari [halaman Rilis](https://github.com/RevDonz/gt65-web/releases).

| Distro | Berkas | Aturan udev |
|---|---|---|
| Ubuntu, Debian, Mint, Pop!_OS | `.deb` | otomatis |
| Fedora, RHEL, openSUSE | `.rpm` | otomatis |
| Arch, Void, Gentoo, NixOS, immutable | `.AppImage` | manual |

```bash
# Debian dan turunannya — apt menyelesaikan dependensi, dpkg -i tidak
sudo apt install ./gt65-configurator_0.1.0_amd64.deb

# Fedora dan turunannya
sudo dnf install ./gt65-configurator-0.1.0.x86_64.rpm

# AppImage
chmod +x gt65-configurator-0.1.0-x86_64.AppImage
./gt65-configurator-0.1.0-x86_64.AppImage
```

Pakai `apt`/`dnf`, bukan `dpkg -i`/`rpm -i` polos: paket mendeklarasikan 15
dependensi, dan kalau ada yang kurang di sistem Anda, `dpkg -i`/`rpm -i`
meninggalkan paket **tidak terkonfigurasi** — skrip `postinst` yang menjalankan
`udevadm control --reload-rules` dan `udevadm trigger` (janji "tanpa
cabut-colok" di bawah) tidak pernah berjalan sama sekali.

Pengguna AppImage harus memasang aturan udev sendiri. Aplikasi akan
memberitahu bila belum terpasang, lengkap dengan lintasan absolut berkasnya di
dalam bundel yang sedang berjalan (mis. `/tmp/.mount_gt65XXXXXX/resources/70-gt65.rules`
— lintasan ini acak per peluncuran, jadi salin perintah dari spanduknya, jangan
memakai nama berkas telanjang). `70-gt65.rules` juga dirilis sebagai aset lepas
di [halaman Rilis](https://github.com/RevDonz/gt65-web/releases), berguna kalau
Anda ingin memasangnya sebelum membuka AppImage untuk pertama kali:

```bash
sudo install -m644 70-gt65.rules /etc/udev/rules.d/70-gt65.rules
sudo udevadm control --reload-rules && sudo udevadm trigger --subsystem-match=hidraw --action=add
```

Tanpa aturan itu keyboard tetap terdeteksi, tetapi setiap perubahan gagal
tanpa pesan galat — Chromium mundur ke mode hanya-baca secara diam-diam.

Versi web tetap tersedia dan tidak digantikan. Keduanya berbagi basis kode
yang sama.

## Yang belum diketahui

Tiga hal berikut menunggu penemuan lewat hardware sungguhan dan belum bisa
dianggap final:

- **Sifat write-only keyboard belum dikonfirmasi di hardware.** Seluruh desain
  persistensi aplikasi bertumpu pada asumsi ini. Halaman probe ada di
  `tools/hidprobe.html` dan langkahnya di `docs/hardware-checklist.md`, tapi
  belum dijalankan pada perangkat fisik.
- **Nilai `mode` pencahayaan yang valid belum diketahui.** Panel Lampu memakai
  input angka mentah untuk field mode, bukan daftar nama efek, karena
  pemetaan nilai ke efek belum ditemukan.
- **Arti kelima flag pengaturan belum diketahui.** Panel Pengaturan memberi
  label sementara "Flag byte N" pada tiap kotak centang; UI ini belum final
  dan akan diberi label sungguhan setelah pemetaannya ditemukan.

## Linux: izin perangkat

`/dev/hidraw*` bawaannya hanya bisa diakses root, sehingga browser tidak bisa
membuka keyboard. Pasang aturan udev dari `build/70-gt65.rules` — berkas ini
juga yang dirilis bersama paket desktop, jadi isinya satu-satunya sumber
kebenaran:

```bash
sudo install -m644 build/70-gt65.rules /etc/udev/rules.d/70-gt65.rules
sudo udevadm control --reload-rules && sudo udevadm trigger --subsystem-match=hidraw --action=add
```

Colok ulang keyboard setelahnya.

Catatan: GT65 memakai Vendor ID milik Apple (`05AC`) tanpa hak, jadi rule di
atas juga mengenai keyboard Apple asli.

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

WebHID menolak `file://`, jadi aplikasi harus diakses lewat `http://localhost`
atau HTTPS.

## Pengembangan

```bash
npm test                # golden test byte, tidak butuh keyboard
npm run build           # renderer
npm run build:electron  # proses main
npm run dev:desktop     # vite + Electron, hot reload
npm run pack:linux      # bangun paket ke release/
```

Kesalahan protokol tidak memunculkan error — keyboard mengabaikan paket yang
salah tanpa memberi tahu. Golden test byte adalah jaring pengaman utamanya.

## Cadangan profil

Karena keyboard tidak bisa dibaca, aplikasi ini yang menyimpan satu-satunya
salinan konfigurasi Anda — dan `localStorage` browser bisa hilang kapan saja
(profil dibersihkan, ganti perangkat, mode privat). Bar navigasi punya dua
tombol untuk ini:

- **Ekspor profil** mengunduh profil aktif sebagai berkas `.json`, dinamai
  dari nama profilnya.
- **Impor profil** membuka dialog berkas untuk memuat kembali berkas `.json`
  itu. Berkas dengan versi tak dikenal atau struktur rusak ditolak dengan
  pesan galat, dan profil yang sedang aktif tidak diganti.

Lakukan ekspor sebelum menulis remap tombol — ini yang disebut sebagai
"cadangan" di bagian atas README ini, dan sebelum menekan **Pulihkan
bawaan** kalau Anda ingin bisa kembali ke konfigurasi kustom Anda sendiri.

## Pemulihan

Tombol **Pulihkan bawaan** menulis ulang seluruh konfigurasi ke keadaan
wajar. Tidak ada perintah reset pabrik di protokol keyboard — software vendor
pun melakukan hal yang sama, sehingga pemulihan tidak memerlukan Windows.

**Peringatan: belum terverifikasi di hardware.** Tombol Pulihkan bawaan belum
pernah diuji pada perangkat fisik. Dua asumsi tentang tombol Fn masih
menunggu konfirmasi (lihat doc comment `defaultProfile()` di
`src/store/profile.ts`):

1. Tombol Fn ditulis sebagai `usage:0xAF` mengikuti XML vendor, padahal `0xAF`
   adalah Reserved di HID Keyboard usage page — penanda internal vendor, bukan
   usage HID asli. Belum diketahui apakah firmware memperlakukannya sebagai
   tombol layer atau tombol mati.
2. Layer Fn ditulis nol seluruhnya. Spec Bagian 5.5 menyebut `0x00` sebagai
   "default / nonaktif" — dua makna berlawanan. **Kalau maksudnya "nonaktif",
   pemulihan ini menghapus layer Fn pabrik secara permanen,** dan aplikasi
   tidak bisa membangunnya kembali.

Ikuti `docs/hardware-checklist.md` Task 14 sebelum menekan tombol ini: catat
daftar kombinasi Fn yang berfungsi (Fn + media, kecerahan, panah, Del, PrtSc,
dst.), terapkan pemulihan, lalu uji ulang. Kalau ada yang patah, **berhenti
dan laporkan** — jangan lanjut sampai asumsi Fn dipastikan.

## Dokumentasi

- `docs/superpowers/specs/` — desain dan spesifikasi protokol lengkap
- `docs/hardware-checklist.md` — langkah verifikasi hardware yang masih
  tertunda (izin perangkat, sifat write-only, nilai mode, pemetaan flag)
