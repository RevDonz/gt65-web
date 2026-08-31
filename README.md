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
membuka keyboard. Pasang udev rule:

```bash
echo 'KERNEL=="hidraw*", ATTRS{idVendor}=="05ac", ATTRS{idProduct}=="024f", TAG+="uaccess"' \
  | sudo tee /etc/udev/rules.d/70-gt65.rules
sudo udevadm control --reload-rules && sudo udevadm trigger
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
npm test        # golden test byte, tidak butuh keyboard
npm run build
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

## Dokumentasi

- `docs/superpowers/specs/` — desain dan spesifikasi protokol lengkap
- `docs/hardware-checklist.md` — langkah verifikasi hardware yang masih
  tertunda (izin perangkat, sifat write-only, nilai mode, pemetaan flag)
