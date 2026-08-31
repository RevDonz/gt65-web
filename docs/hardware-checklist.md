# Checklist langkah hardware

Enam langkah dalam plan butuh keyboard fisik dan browser, jadi tidak bisa
dikerjakan subagent. Kerjakan yang bisa dikerjakan sekarang; sisanya menunggu
kode panelnya jadi.

Browser harus Chromium (Brave, Chrome, atau Edge). Keyboard harus tersambung
**kabel USB**, bukan dongle 2.4 GHz.

---

## Sekarang — Task 1: izin dan sifat perangkat

Ini memblokir semua uji hardware berikutnya, dan hasilnya bisa mengubah spec.

### 1. Pasang udev rule

```bash
echo 'KERNEL=="hidraw*", ATTRS{idVendor}=="05ac", ATTRS{idProduct}=="024f", TAG+="uaccess"' \
  | sudo tee /etc/udev/rules.d/70-gt65.rules
sudo udevadm control --reload-rules && sudo udevadm trigger
```

Cabut dan colok ulang keyboard, lalu pastikan aksesnya berubah:

```bash
ls -l /dev/hidraw* | grep -v 'root root'
```

Harus muncul minimal satu baris. Kalau tidak ada, udev rule belum kena —
periksa `HID_ID` perangkat dengan `cat /sys/class/hidraw/hidraw*/device/uevent`.

### 2. Jalankan probe

Halaman probe dibuat pada Task 1 di `tools/hidprobe.html`. Sajikan lewat
localhost — WebHID menolak `file://`:

```bash
npx --yes http-server tools -p 8765 -a 127.0.0.1
```

Buka `http://localhost:8765/hidprobe.html`, klik tombolnya, pilih
`hfd.cn USB DEVICE` di dialog izin.

### 3. Yang dicari

Dua baris menentukan langkah berikutnya:

| Keluaran | Artinya |
|---|---|
| `open(): BERHASIL` | izin sudah benar, lanjut |
| `open(): GAGAL` | udev rule belum kena, ulangi langkah 1 |
| `receiveFeatureReport(0): GAGAL` | perangkat write-only — sesuai asumsi spec, lanjut normal |
| `receiveFeatureReport(0): BERHASIL` | **berhenti dan beri tahu saya** — spec Bagian 3.3 dan model profil perlu direvisi |

Tempelkan hasilnya ke saya apa adanya.

---

## Nanti — setelah panelnya jadi

### Task 10 langkah 4: daftar nilai mode lampu

Paling aman dari semua eksperimen. Kegagalan terburuknya hanya warna yang salah.

Dropdown Mode sekarang berisi 22 nama efek dari tabel string vendor
(`1033.lan` ID 200–221), dengan indeks daftar sebagai nilai byte. **Urutan itu
dugaan, bukan fakta** — yang diuji di sini justru apakah dugaannya benar.

Matikan mode kering, lalu pilih tiap entri berurutan dari `0 · Static` sampai
`21 · Floweriness`, klik Terapkan, dan catat efek lampu yang benar-benar
terlihat di sebelah nama yang dipilih.

Tiga kemungkinan hasil, semuanya berguna:

- nama cocok dengan efek di seluruh daftar → urutan terkonfirmasi, hapus
  peringatan di panel Lampu;
- cocok tapi tergeser konstan → catat pergeserannya;
- tidak ada hubungan → daftar nama tetap berguna, tapi pemetaan harus
  disusun ulang dari nol.

Catat juga nilai mana yang tidak menghasilkan perubahan apa pun.

### Task 11 langkah 3: pemetaan lima flag pengaturan

Untuk tiap `i` dari 0 sampai 4: centang **hanya** flag ke-`i`, klik Terapkan,
lalu uji:

- tombol Win masih berfungsi?
- Alt+Tab masih berfungsi?
- Alt+F4 masih berfungsi?
- ada indikasi game mode aktif?

Catat flag mana memicu perilaku mana. Setelah selesai, kosongkan semua flag dan
terapkan ulang.

### Task 11 tambahan: nilai byte waktu tidur lampu

Vendor hanya menawarkan empat pilihan (`1033.lan` ID 270–273: Not Sleep, 1 min,
5 min, 30 min), dan UI kini mengikuti. Yang belum pasti adalah **nilai byte di
balik keempat label itu** — kode sementara mengirim angka menitnya (0, 1, 5,
30); kandidat lain yang sama masuk akal adalah indeks 0–3.

Pilih "1 menit", terapkan, lalu biarkan keyboard diam dan hitung berapa lama
lampu benar-benar mati. Ulangi untuk "5 menit". Kalau lampu mati jauh lebih
cepat dari labelnya, encoding-nya kemungkinan indeks, bukan menit — catat dan
ganti `SLEEP_OPTIONS` di `src/app/panels/SettingsPanel.tsx`.

### Task 12 langkah 2: monitor

Buka tab Monitor dengan keyboard tersambung. Kalau ada tombol yang sudah
dipetakan ke aksi sisi PC oleh software vendor, menekannya memunculkan baris.
Daftar kosong juga hasil yang sah — catat saja.

**Kalau ada baris yang muncul, selesaikan sekalian selisih offset ini.**
`MonitorPanel` membaca indeks aksi dari `bytes[1]`, sedangkan spec Bagian 5.6
menyebut `payload[2]` — dan Bagian 5.1 menegaskan seluruh offset spec memakai
koordinat payload, jadi keduanya sungguh berselisih satu byte. Salah satunya
keliru dan belum ada yang tahu mana.

Laporannya cuma 3 byte, jadi hex mentah di tiap baris sudah cukup: tekan tombol
yang sama dua kali dan lihat byte ke berapa yang berubah. Perbaiki sisi yang
salah — kode atau spec — lalu hapus komentar penanda di
`src/app/panels/MonitorPanel.tsx`.

### Task 13 langkah 4: remap

Penulisan paling berisiko. **Ekspor profil sebagai cadangan lebih dulu.**

Ubah satu tombol yang tidak kritis — tombol kutip di baris rumah cocok — lalu
terapkan dan uji. Kalau berhasil, baru lanjut ke perubahan lain.

### Task 14 langkah 4: pemulihan

Klik Pulihkan bawaan dan pastikan seluruh tombol kembali normal. Uji ini yang
membuat Task 13 aman untuk dieksplorasi.

**Ekspor profil dulu.** Lakukan langkah ini setelah Task 13, saat masih ada
satu tombol tak kritis yang sengaja dipetakan ulang — kalau tidak, tidak ada
yang membuktikan pemulihannya benar-benar menulis sesuatu.

Uji "semua tombol kembali normal" tidak cukup: dua asumsi di
`defaultProfile()` justru tidak akan terlihat olehnya, dan keduanya ada di
jalur pemulihan.

#### a. Fn masih menjadi Fn?

`defaultProfile()` menulis tombol Fn sebagai `{kind:'key', usage:0xAF}`, ikut
`code="0xaf"` di XML vendor. **0xAF adalah Reserved di HID Keyboard usage
page** — itu penanda internal vendor, bukan usage sungguhan. Belum ada yang
tahu apakah firmware memperlakukannya sebagai "tetap jadi tombol layer" atau
justru sebagai tombol biasa yang tidak melakukan apa-apa.

Sebelum menekan Pulihkan bawaan, catat satu kombinasi Fn yang berfungsi
(mis. `Fn` + tombol panah, atau `Fn` + F-key untuk media). Sesudahnya, coba
kombinasi yang sama.

- masih bekerja → asumsi 0xAF benar, catat di spec;
- Fn jadi mati total → **berhenti dan laporkan**. Pemulihan tidak boleh
  dirilis sampai encoding Fn yang benar diketahui.

#### b. Layer Fn pabrik masih ada?

`defaultProfile()` menulis layer Fn nol seluruhnya. Tabel tag spec Bagian 5.5
menyebut `0x00` sebagai "default / nonaktif" — dua makna yang berlawanan.
Kalau maksudnya "default firmware", pemulihan ini benar. Kalau maksudnya
"nonaktif", pemulihan **menghapus layer Fn pabrik**, dan aplikasi tidak bisa
membangunnya kembali: XML vendor hanya memuat satu layer, jadi tidak ada
sumber untuk isi layer Fn aslinya.

Uji ini yang menentukannya, dan biayanya permanen kalau ternyata salah — jadi
kerjakan **setelah** poin (a), dan catat dulu daftar selengkap mungkin
kombinasi Fn yang berfungsi (media, kecerahan, panah, Del, PrtSc, dan
seterusnya). Sesudah memulihkan, uji ulang seluruh daftar itu.

- semuanya masih bekerja → `0x00` berarti "default firmware", asumsi aman;
- semuanya mati → **berhenti dan laporkan**. Layer Fn pabrik hilang dan tidak
  bisa dikembalikan aplikasi; `defaultProfile()` harus berhenti menulis layer
  Fn sama sekali sebelum siapa pun memakai tombol pemulihan lagi.

Apa pun hasilnya, catat kembali ke spec Bagian 5.5 dan hapus blok asumsi di
doc comment `defaultProfile()`.

---

## Kalau keyboard jadi aneh

Tombol **Pulihkan bawaan** menulis ulang seluruh konfigurasi ke keadaan wajar.
Tidak ada perintah reset pabrik di protokol keyboard — software vendor pun
melakukan hal yang sama — jadi pemulihan tidak memerlukan Windows.
