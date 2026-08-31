# GT65 Web Configurator — Desain

**Tanggal:** 2026-08-31
**Status:** disetujui untuk implementasi

---

## 1. Latar belakang

VortexSeries GT65 adalah keyboard mekanik 67-tombol tri-mode (kabel USB, dongle 2.4 GHz, Bluetooth) buatan ODM 华奋达（东莞）科技有限公司 / HFD. Software konfigurasinya hanya tersedia untuk Windows, dan keyboard ini tidak mendukung QMK maupun VIA karena MCU-nya berinti 8051, bukan ARM.

Protokol HID-nya sudah direkayasa balik sepenuhnya untuk fitur-fitur dalam lingkup dokumen ini. Hasil lengkapnya ada di laporan pembongkaran; ringkasan yang dibutuhkan implementasi disalin ke Bagian 5 supaya dokumen ini berdiri sendiri.

Tujuan proyek: konfigurator lintas platform berbasis browser, sehingga keyboard bisa diatur dari Linux dan macOS tanpa Windows.

Motivasi lebih luas: keyboard OEM Tiongkok kelas ini umumnya memakai basis software yang sama dan terkunci ke Windows. Noir Spade65 adalah kandidat perangkat kedua yang sudah teridentifikasi.

---

## 2. Lingkup v1

Masuk:

- Remap tombol, dua layer (Top dan Fn)
- Pencahayaan RGB (mode, warna, kecepatan, kecerahan, arah)
- Pengaturan sistem (game mode, nonaktifkan Win / Alt+Tab / Alt+F4, timeout lampu tidur)
- Monitor event tombol (Report ID 5)

Tidak masuk v1, karena protokolnya belum dibongkar:

- Makro
- Pencahayaan per-tombol kustom
- Konfigurasi lewat dongle 2.4 GHz (layout HID berbeda, lihat Bagian 3)
- Pembaruan firmware

---

## 3. Kendala teknis

Empat kendala ini membentuk seluruh desain. Semuanya sudah diverifikasi pada hardware, bukan asumsi.

### 3.1 Hanya mode kabel

Saat tersambung kabel USB, keyboard tampil sebagai `hfd.cn USB DEVICE` dengan dua interface, dan report descriptor-nya identik byte-per-byte dengan yang diekstrak dari firmware.

Saat tersambung lewat dongle 2.4 GHz, perangkat tampil sebagai `USB Dongle` dengan tiga interface dan layout berbeda — kanal feature 64-byte tidak ada, digantikan kanal vendor `0xFFB5` dengan in/out 7 byte yang protokolnya belum diketahui.

**Aplikasi hanya mendukung mode kabel.** Deteksi mode dongle harus memberi pesan jelas, bukan gagal diam-diam.

### 3.2 WebHID memfilter per-report

Kanal konfigurasi adalah feature report 64-byte di dalam top-level collection `Generic Desktop / Keyboard` — kategori yang dilindungi. Namun Chromium memfilter berdasarkan **usage tiap report**, bukan collection-nya. Feature report ini dideklarasikan dengan usage page Consumer (`05 0C 09 00`), sehingga lolos filter.

Diverifikasi di Brave: feature report 64-byte terlihat; input keyboard 8-byte, output LED, dan NKRO 15-byte diblokir.

### 3.3 Perangkat tidak bisa dibaca

Software vendor me-resolve `HidD_GetFeature` tetapi tidak pernah memanggilnya. Seluruh 38 titik komunikasi hanya menulis.

Konsekuensi: **aplikasi adalah sumber kebenaran, bukan keyboard.** Profil disimpan sisi klien; tombol Terapkan selalu menulis ulang seluruh konfigurasi.

Langkah implementasi pertama harus menguji `receiveFeatureReport(0)`. Kalau keyboard ternyata menjawab, kendala ini gugur dan desain persistensi bisa disederhanakan. Sampai terbukti, asumsikan write-only.

**Pembaruan: perangkat BISA dibaca, tapi bukan konfigurasi tersimpan.**
`receiveFeatureReport(0)` memang menjawab — klaim "write-only" di atas terlalu
kuat. Yang dikembalikan, bagaimanapun, bukan konfigurasi yang bisa di-query
sesuka hati; ia adalah **buffer echo**: isi laporan fitur terakhir yang
ditulis ke perangkat, apa pun itu. Ini terbukti saat menyelidiki bug
`payload[8]` di Bagian 5.4 — membaca feature report 0 setelah software
vendor mengirim paket lampu mengembalikan persis paket data lampu itu
(termasuk penanda `AA 55` di posisi yang sama), bukan representasi
"pengaturan lampu yang sedang aktif" yang independen dari histori tulis.
Konsekuensinya tetap sama seperti sebelumnya untuk tujuan persistensi —
aplikasi tetap harus jadi sumber kebenaran, karena pembacaan ini tidak bisa
dipakai untuk mengambil konfigurasi tersimpan kapan saja — tetapi jalur baca
ini berguna sebagai alat diagnostik: mengirim satu paket lalu segera
membacanya kembali adalah cara memverifikasi byte demi byte apa yang benar-benar
diterima perangkat, seperti yang dipakai untuk menemukan `payload[8]`.

### 3.4 Izin perangkat di Linux

`/dev/hidraw*` bawaannya root-only, sehingga browser tidak bisa membuka perangkat. Perlu udev rule:

```
KERNEL=="hidraw*", ATTRS{idVendor}=="05ac", ATTRS{idProduct}=="024f", TAG+="uaccess"
```

Enumerasi dan pembacaan descriptor tetap jalan tanpa rule ini; hanya `open()` dan I/O yang butuh. Aplikasi harus mendeteksi kegagalan `open()` dan menampilkan instruksi ini.

Catatan: VID `05AC` adalah milik Apple Inc. yang dipakai tanpa hak oleh keyboard ini, sehingga rule di atas juga mengenai keyboard Apple asli.

---

## 4. Arsitektur

Aplikasi statis, tanpa backend. Seluruh komunikasi terjadi di browser; tidak ada data yang meninggalkan mesin pengguna.

Stack: React + Vite + Tailwind, build statis. Deploy ke GitHub Pages (HTTPS wajib untuk WebHID) atau dijalankan dari localhost.

```
gt65-web/
  src/
    gt65/                  inti — nol dependensi UI
      protocol.ts            fungsi murni: konfigurasi → array byte
      device.ts              transport WebHID
      layout.ts              67 tombol dari KeyboardLayout.xml
      keycodes.ts            tabel HID usage, consumer, preset shortcut
      types.ts
    store/
      profile.ts             model profil + persistensi localStorage
    app/                     komponen React
  test/
    protocol.test.ts         golden test byte
```

Aturan batas: `protocol.ts` tidak boleh mengimpor apa pun dari `device.ts`, `app/`, atau WebHID. Ia hanya mengubah konfigurasi menjadi byte. Ini yang membuatnya bisa diuji tanpa hardware dan yang membuat penambahan perangkat kedua tidak menyentuh UI.

---

## 5. Spesifikasi protokol

### 5.1 Transport

Satu transaksi terdiri atas beberapa feature report. Di Windows setiap report berukuran 65 byte dengan `buf[0]` sebagai Report ID bernilai 0.

**WebHID membuang Report ID dari argumen data.** Panggilannya:

```ts
device.sendFeatureReport(0, payload)   // payload = 64 byte
```

Seluruh offset dalam dokumen ini memakai koordinat **payload** (0–63). Salah menggeser satu byte membuat perintah diabaikan tanpa error.

### 5.2 Tata bahasa perintah

```
payload[0] = 0x04        penanda kelas perintah
payload[1] = opcode
payload[2..] = argumen
```

Paket data tidak memakai penanda `0x04`; byte pertamanya langsung berisi data.

Penanda akhir `AA 55` **tidak berada di posisi tetap**. Ia menutup daerah yang benar-benar dipakai perintah bersangkutan:

| Transaksi | Posisi `AA 55` (payload) |
|---|---|
| Blok pengaturan | 62–63 |
| Paket pencahayaan | 14–15 |
| Tabel remap 576 byte | dua byte terakhir (574–575) |

### 5.3 Transfer besar

Untuk data melebihi satu paket, buffer dipecah menjadi potongan 64 byte, masing-masing dikirim sebagai satu feature report, dengan jeda 1 ms. Jumlah paket pada software asli dihitung `n = (len >> 6) - 1`; untuk tabel remap hasilnya 9 paket = 576 byte.

### 5.4 Transaksi

**Pencahayaan**

```
cmd(0x18)                       buka sesi
cmd(0x13, {8: 1})               pilih pencahayaan
data({0: mode, 1: R, 2: G, 3: B,
      8: 1,
      9: speed + 1, 10: brightness + 1, 11: direction}, term_at = 14)
cmd(0x02)                       commit
cmd(0xF0)                       finalisasi
```

`speed` dan `brightness` disimpan berbasis nol di UI dan dinaikkan satu sebelum dikirim.

**Bug yang sudah ditemukan dan diperbaiki: `payload[8]` pada paket data hilang
dari spec ini.** Versi sebelumnya dari pseudocode di atas tidak menyebut
`payload[8]` sama sekali, dan implementasi awal mengikutinya persis —
akibatnya paket data dikirim tanpa byte itu, dan keyboard mengabaikan
transaksi tanpa memunculkan error apa pun. Disassembly vendor (`DeviceDriver.exe`,
FUNC `0x41D7B0`) menulis byte ini bersama mode/R/G/B, sebelum penanda AA 55.
Nilai `0x01` diperoleh dengan membaca kembali feature report 0 dari perangkat
sungguhan setelah software vendor menulis paket lampu — lihat catatan
pembaruan di Bagian 3.3 tentang apa sebenarnya yang dikembalikan pembacaan
itu. Makna byte ini sendiri belum diketahui; `1` diperlakukan sebagai
konstanta sampai ada bukti sebaliknya, bukan opsi yang diekspos ke pengguna.

**Yang belum pasti: daftar nilai `mode` yang sah.** Software vendor mengambilnya
dari daftar mode di UI-nya, dan nilainya tidak muncul sebagai konstanta di
disassembly. Ini juga murah ditentukan secara empiris — kirim nilai 0, 1, 2, …
berurutan dan amati efek lampunya, karena hasilnya terlihat seketika dan tidak
berbahaya. Lakukan sebagai bagian dari tahap 4 di Bagian 10, lalu catat hasilnya
kembali ke dokumen ini.

**Pengaturan sistem**

```
cmd(0x18)
cmd(0x17, {2: profileIndex, 8: 1})
data({1: flag, 2: flag, 3: flag, 4: flag, 5: flag,
      6: sleep_timeout}, term_at = 62)
cmd(0x02)
```

Struktur paket ini pasti — disassembly memperlihatkan lima byte boolean di
`payload[1..5]` yang diisi dari hasil `GetCheck` kotak centang UI, dan satu
nilai numerik di `payload[6]` hasil konversi string.

**Yang belum pasti: pemetaan flag ke offset.** Kelima boolean tidak bisa
dibedakan secara statis karena UI membacanya lewat pointer kontrol. Urutannya
harus ditentukan secara empiris, dan itu murah karena tiap flag langsung
teramati: tulis satu flag bernilai 1 sementara sisanya 0, lalu uji perilakunya
di keyboard (mis. tekan tombol Win). Ulangi lima kali.

Sampai pemetaan itu selesai, tab Pengaturan tidak boleh dirilis dengan label
yang menebak-nebak. Kerjakan langkah ini sebagai bagian dari tahap 5 di
Bagian 10.

Nilai `payload[2]` pada `cmd(0x17)` diambil dari state aplikasi dan diduga
indeks profil; kirim 0 sampai terbukti sebaliknya.

**Remap tombol**

```
cmd(0x18)
cmd(layer == 'fn' ? 0x27 : 0x11, {8: 9})
chunks(table576)                9 paket × 64 byte
cmd(0x02)
cmd(0xF0)
```

Tabel berisi 144 entri × 4 byte, diindeks oleh `key_index` dari `KeyboardLayout.xml`. Slot yang tidak dipakai tetap nol.

### 5.5 Encoding entri tombol

```
entry[0] = tag tipe
entry[1] = modifier
entry[2] = HID usage / nilai
entry[3] = tambahan
```

| Tag | Arti | Isi |
|---|---|---|
| `0x00` | default / nonaktif | seluruh entri nol |
| `0x01` | fungsi mouse | `[1]` = 1 tombol / 3 roda, `[2]` = nilai |
| `0x02` | tombol keyboard atau shortcut | `[1]` = bitmask modifier, `[2]` = HID usage |
| `0x03` | multimedia | `[1]` = HID Consumer usage |
| `0x05` | aksi sisi PC | `[1]` = sub-jenis, `[2]` = indeks slot |
| `0x06` | makro | `[1]` = slot, `[2..3]` = mode & pengulangan |

Modifier memakai bitmask HID standar: `0x01` LeftCtrl, `0x02` LeftShift, `0x04` LeftAlt, `0x08` LeftGUI.

**Multimedia** (`entry[1]`), seluruhnya HID Consumer Page resmi:

| Fungsi | Kode | Fungsi | Kode |
|---|---|---|---|
| Play/Pause | `0xCD` | Volume + | `0xE9` |
| Stop | `0xB7` | Volume − | `0xEA` |
| Previous | `0xB6` | Mute | `0xE2` |
| Next | `0xB5` | | |

**Fungsi mouse** (`entry[1]`, `entry[2]`):

| Fungsi | `[1]` | `[2]` |
|---|---|---|
| Klik kiri | 1 | `0x01` |
| Klik kanan | 1 | `0x02` |
| Klik tengah | 1 | `0x04` |
| Tombol 4 | 1 | `0x08` |
| Tombol 5 | 1 | `0x10` |
| Klik ganda | 1 | `0x03` |
| Scroll naik | 3 | `0x01` |
| Scroll turun | 3 | `0xFF` |

**Preset shortcut** (tag `0x02`):

| Aksi | `[1]` | `[2]` | Kombinasi |
|---|---|---|---|
| Show Desktop | `0x08` | `0x07` | Win+D |
| My Computer | `0x08` | `0x08` | Win+E |
| Lock | `0x08` | `0x0F` | Win+L |
| Close Window | `0x01` | `0x1A` | Ctrl+W |
| Switch Windows | `0x04` | `0x2B` | Alt+Tab |
| Copy | `0x01` | `0x06` | Ctrl+C |
| Paste | `0x01` | `0x19` | Ctrl+V |
| Cut | `0x01` | `0x1B` | Ctrl+X |

Tag `0x05` tidak diimplementasikan di v1: aksi tersebut memerlukan software yang berjalan terus-menerus untuk mengeksekusinya di sisi PC.

### 5.6 Jalur baca

Report ID 5 pada Interface 1, collection vendor `0xFFFF`, 3 byte input. `payload[2]` berisi indeks aksi. Software vendor mem-polling tiap 10 ms.

Dipakai v1 hanya untuk tab Monitor.

---

## 6. Model data

```ts
type Profile = {
  version: 1
  name: string
  layers: { top: Entry[]; fn: Entry[] }    // 144 entri masing-masing
  lighting: { mode: number; r: number; g: number; b: number
              speed: number; brightness: number; direction: number }
  settings: { gameMode: boolean; disableWin: boolean
              disableAltTab: boolean; disableAltF4: boolean
              sleepTimeout: number }
}
```

Persistensi di `localStorage`, dengan ekspor/impor JSON supaya konfigurasi tidak tersandera satu browser.

Profil default harus berisi layout keyboard bawaan yang benar, karena inilah jalur pemulihan (Bagian 8).

---

## 7. UI

Satu halaman, empat tab. Bar atas: tombol sambung dengan indikator status, pemilih profil, toggle mode kering, tombol Terapkan.

**Remap** — grid 67 tombol digambar dari `KeyboardLayout.xml` (posisi, ukuran, label sudah tersedia di sana). Toggle Top/Fn. Klik tombol membuka panel properti dengan pemilih jenis fungsi.

**Lampu** — pemilih mode, color picker, slider kecepatan dan kecerahan, arah.

**Pengaturan** — toggle dan satu input angka.

**Monitor** — event Report ID 5 secara langsung plus log hex mentah.

---

## 8. Pengaman perangkat

Kita menulis ke perangkat yang tidak bisa dibaca balik, jadi pengaman bersifat wajib, bukan opsional.

**Mode kering adalah bawaan.** Aplikasi menampilkan paket hex yang akan dikirim; pengguna harus sengaja mematikannya untuk menulis sungguhan.

**Urutan pengembangan mengikuti tingkat risiko.** Pencahayaan lebih dulu — hasilnya terlihat seketika dan kegagalan terburuknya hanya warna yang salah. Pengaturan berikutnya. Remap terakhir, karena kegagalannya bisa membuat keyboard sulit dipakai.

**Jalur pemulihan.** Pembongkaran memastikan tidak ada perintah reset pabrik di protokol: handler "Reset keyboard" dan "Restore Factory Settings" pada software vendor tidak mengirim apa pun ke keyboard, melainkan menghapus baris profil di SQLite lokal lalu menulis ulang nilai default melalui jalur apply biasa.

Karena itu pemulihan sepenuhnya ada di tangan kita: **tulis profil default menggunakan transaksi yang sudah dispesifikasikan di atas.** Aplikasi harus menyediakan tombol "Pulihkan bawaan" yang melakukan tepat itu. Tidak ada ketergantungan pada Windows.

---

## 9. Pengujian

**Golden test byte** adalah jaring pengaman utama, karena kesalahan protokol tidak memunculkan error — perintah hanya diabaikan. Setiap transaksi dibandingkan byte-per-byte dengan urutan yang dibaca dari disassembly. Berjalan tanpa hardware.

Contoh yang harus lolos: transaksi pencahayaan menghasilkan lima paket, paket kedua punya `payload[0..1] = 04 13` dan `payload[8] = 1`, paket ketiga punya `AA 55` di `payload[14..15]`.

**Uji manual** mengikuti urutan risiko di Bagian 8, dengan tab Monitor sebagai alat verifikasi.

---

## 10. Urutan implementasi

1. Uji `open()` dan `receiveFeatureReport(0)` pada hardware — memastikan izin dan menjawab pertanyaan write-only (Bagian 3.3)
2. `protocol.ts` + golden test (tanpa hardware)
3. `device.ts` + penanganan kegagalan izin
4. Pencahayaan, ujung ke ujung — **termasuk memetakan daftar nilai `mode`** (Bagian 5.4)
5. Pengaturan sistem — **termasuk memetakan lima flag ke offset** (Bagian 5.4)
6. Monitor
7. Remap
8. Pulihkan bawaan

Tahap 4 dan 5 masing-masing memuat satu langkah penemuan yang harus selesai
sebelum tab bersangkutan dianggap jadi. Temuan keduanya dicatat kembali ke
dokumen ini.

---

## 11. Referensi

- Laporan pembongkaran lengkap (artifact)
- Artefak ekstraksi: `~/Projects/gt65-re/`
- `KeyboardLayout.xml` — sumber layout 67 tombol
- `1033.lan` — katalog fitur dan nama fungsi tombol
