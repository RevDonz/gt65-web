# Audit fitur software asli VortexSeries GT65

Tanggal: 8 September 2026. Target: baseline `DeviceDriver.exe` 1.0.1.1, VID/PID `05ac:024f`, bukan model GT65 QMK/VIA atau driver LITE.

## Bukti dan batas pengamatan

- Software vendor benar-benar dijalankan melalui Wine 9.0 dan berhasil mengenali keyboard. Screenshot seluruh halaman ada di [artifacts/vendor-audit](../artifacts/vendor-audit).
- Wine khusus pengujian: `WINEPREFIX=/tmp/gt65-vendor-preview/wine`. Backend SDL dimatikan dengan `HKLM\System\CurrentControlSet\Services\winebus`, DWORD `Enable SDL=0`. Salinan `device.xml` memakai `product_name="hfd.cn USB DEVICE"`. Sumber di Downloads tidak diubah.
- Nama kontrol dicocokkan dengan `language/1033.lan`; format paket dicocokkan dengan `Downloads/keyboard/ANALYSIS.md` §4 dan `PARITY.md`. Dokumen lama merupakan hasil analisis sebelumnya, bukan hasil verifikasi hardware baru.
- Membuka beberapa halaman vendor dapat mengirim paket otomatis. Halaman Music teramati memanggil `HidD_SetFeature` berulang. Aplikasi vendor dihentikan setelah audit agar tidak mengirim bersamaan dengan aplikasi Linux.
- **Pengamatan UI tidak membuktikan keberhasilan penulisan firmware.** Penambahan aplikasi diuji dengan tes byte dan UI; tidak diklaim sudah diuji pada hardware.

## Hasil per menu dan status aplikasi kita

| Menu / fitur vendor | Bukti | Hasil / tindakan |
|---|---|---|
| Beranda, pilihan perangkat, nama keyboard | Screenshot awal | Koneksi GT65 dan status USB sudah tersedia. Tidak menambahkan pilihan model palsu. |
| Banyak configuration scheme | Keymap + string 100–104 | Ditambahkan pustaka profil: buat, pilih, duplikat, rename, hapus dengan konfirmasi. Pemilihan profil tidak otomatis menulis perangkat. |
| Impor/ekspor konfigurasi | Keymap | JSON aplikasi tetap tersedia. Profil baru v3 menyertakan RGB dan makro, migrasi v1/v2 tanpa membuang isinya. Format berkas vendor belum diimpor. |
| Profil per aplikasi (`Application`) | String 60, kolom DB `t_keyprofile.app` | Belum tersedia. Perlu pemantau aplikasi aktif di Electron/Linux, bukan byte keymap saja. |
| Layout keyboard | XML vendor | Satu layout fisik. Picker layout berbeda belum relevan. Ada perbedaan jumlah 66/67 entri yang perlu diperiksa sebelum mengubah generator. |
| Top layer / Fn layer | Screenshot keymap | Sudah tersedia; Fn fisik tetap dilindungi dari remap. |
| Fn Momentary / Toggle | Screenshot keymap + encoder 0x426c40 | Ditambahkan label/perilaku pilihan yang benar pada Pengaturan, `flags[4]`. |
| Tombol biasa dan kelompok tombol | Screenshot keymap | Sudah tersedia, termasuk fungsi navigasi dan F1–F12. |
| Default Function | String 160 | Sudah tersedia: pemulihan binding per tombol dari profil bawaan. |
| Disabled | String 120/161 + ANALYSIS §4.2 | Ada kontrol lama, tetapi perlu audit encoding lanjutan: dokumen menyebut Disabled=`05 03 00 00`, sedangkan `none` lama=`00 00 00 00`. Tidak menyamakan keduanya tanpa pembuktian baru. |
| Mouse Function: 8 aksi | String 170–178 | Sudah tersedia: klik kiri/kanan/tengah/ganda, tombol 4/5, scroll naik/turun. |
| Multimedia: 7 aksi | String 179–185 | Sudah tersedia. |
| Windows Shortcut: 8 chord | String 186–190, 54–56 | Sudah tersedia; ditambahkan editor modifier Ctrl/Shift/Alt/Super untuk chord sendiri. Respons shortcut mengikuti desktop Linux. |
| System/consumer: 18 fungsi | String 570–587 + encoder macrotype 12 | Ditambahkan 11 fungsi sistem/browser 16-bit; 7 multimedia sebelumnya melengkapi kelompok ini. Tidak membuang byte tinggi consumer usage. |
| Open Program / Open File | String 127/164 + host action tag 05 | Belum tersedia; memerlukan handler desktop, pemilihan target, dan verifikasi indeks laporan vendor. |
| Open Website / Send Text | String 128/129 | Belum tersedia; layanan desktop harus tetap berjalan dan menyelesaikan event vendor. |
| Sign Out / Sleep / Shutdown / Restart | String 191–194 | Belum tersedia; membutuhkan integrasi sesi/power Linux. Bukan fungsi firmware yang dapat ditiru dengan keycode tebakan. |
| Switch Configuration dari tombol | String 130 | Belum tersedia; indeks aksi host belum dibuktikan. Pemilihan manual profil tersedia. |
| Multiple keys | String 131 | Belum tersedia sebagai fitur khusus vendor: tag 07 belum dipetakan. Editor chord modifier biasa tersedia secara terpisah. |
| Macro list: New / Delete / Copy / Import / Export | Screenshot macros | Ditambahkan editor makro lokal dengan 100 slot, nama, duplikasi, hapus dengan konfirmasi, impor/ekspor JSON. |
| Record / Stop Recording | Screenshot macros | Ditambahkan rekaman keyboard, jeda terukur/tetap/tanpa jeda; Esc atau blur menghentikan rekaman. Tombol yang masih ditekan mendapat event release saat berhenti. |
| Insert keyboard / mouse / delay | Screenshot macros | Ditambahkan event di akhir/sebelum/setelah pilihan, edit nilai/jenis event, pindah atas/bawah, dan hapus. |
| Kapasitas makro | String 560–562 + encoder | Ditambahkan validasi 3584 byte: direktori 400 byte, header 8 byte setiap makro, 4 byte tiap event. Bukan 796 event bebas tanpa biaya header. |
| Macro upload / binding | ANALYSIS §4.3 | Encoder dan unduh pratinjau paket tersedia. **Tidak ada upload/binding live** karena mode putar dan perilaku firmware belum diverifikasi. |
| Play once / repeat / until pressed again | String 196–199 | Belum tersedia. Nilai mode binding harus direkam dari vendor sebelum dikirim ke keyboard. |
| Preset lighting effects | Screenshot lighting | 20 label terlihat di software vendor. Aplikasi tetap memakai rentang lama 1–19 yang pernah dikalibrasi; mode 0/20/21 tidak diaktifkan hanya karena ada label. |
| Brightness / Speed / Direction | Screenshot lighting + catatan hardware | Slider aplikasi tersedia. **UI baseline terlihat bernilai 15**; rentang 0–4 di aplikasi berasal dari driver lain. Perlu capture byte baseline untuk menyelesaikan konflik. Jangan menganggap rentang semua versi sama. |
| RGB palette / RGB fields | Screenshot lighting | Picker warna dan swatch tersedia. |
| Random Color | Screenshot lighting, nilai ON terlihat | Belum ditambahkan. Nama `colortype` diketahui; asosiasi nilai 0/1 belum direkam. Nilai ON pada layar saja tidak membuktikan byte kabel. |
| Impor/ekspor efek lampu | String 23/24 | Ditambahkan berkas JSON khusus efek, terpisah dari profil lengkap. Validasi rentang editor sebelum impor. |
| Per-key custom lighting | Screenshot custom-lighting + encoder 0x41d960 | Ditambahkan editor RGB per tombol, multi-select, All/Numbers/WASD, warnai/matikan pilihan, impor/ekspor. Pengiriman 144×4 byte lewat 0x23 diikuti aktivasi 0x80. **Belum divalidasi visual di hardware sesi ini.** |
| Named per-key schemes | Screenshot custom-lighting | Skema per profil dan berkas mandiri tersedia; banyak skema dalam satu profil belum tersedia. |
| Custom Lighting Mode / 0x20 | Screenshot lighting-schemes | Belum tersedia. Bank 512 byte berbeda dari tabel 576 byte RGB; layout record belum terpecahkan. |
| Music: visualization/background/amplitude | Screenshot music | Belum tersedia. Butuh sumber audio Linux, pemrosesan spektrum, dan streaming RGB; vendor teramati mengirim terus-menerus. Bukan preset firmware mandiri. |
| Game Mode | Screenshot settings + encoder 0x426c40 | Label ditambahkan. Encoder kini menolkan tiga flag blokir saat Game Mode mati, mengikuti percabangan vendor. |
| Disable Alt+Tab / Alt+F4 / Windows | Screenshot settings | Ditambahkan tiga kontrol yang hanya aktif saat Mode Game menyala. Pilihan disimpan ketika mode dimatikan; byte keluaran tetap nol. |
| LED sleep timeout | String 269–273 + `_wtoi` encoder | Pilihan 0/1/5/30 menit diberi label yang benar. Timeout tidak terlihat pada screenshot settings baseline; didukung oleh encoder yang dianalisis. |
| Key Response Time | Hanya driver LITE | Tidak ditambahkan ke baseline sebagai fitur terkonfirmasi. Byte 8 dan dukungan firmware belum diuji. |
| Language | Screenshot settings, tiga .lan | Aplikasi masih bahasa Indonesia; EN/ID belum ditambahkan. Tiga bahasa vendor adalah EN/Chinese simplified/traditional. |
| Auto Run | Screenshot settings | Belum tersedia. Dapat dibuat di Electron melalui autostart XDG; klaim lama “mustahil” hanya berlaku untuk web. |
| Reset Keyboard Data / Restore Factory Settings | Screenshot settings + handler DB | Pemulihan bawaan lama tersedia; bukan factory reset firmware yang terbukti. Jangan menambahkan opcode reset tebakan. Risiko Fn layer nol masih perlu diuji. |
| Firmware Upgrade | Screenshot settings | Tidak diimplementasikan. Format updater, recovery, bootloader, dan verifikasi firmware diperlukan; tidak ada prosedur pemulihan yang terbukti. |
| Software update / storefront | String MAIN.DIALOG | Bukan kontrol keyboard. Distribusi/update Electron perlu alur rilis tersendiri. |
| Battery / wireless | String MAIN.DIALOG + perangkat USB | Belum tersedia; jangan menampilkan persentase baterai fiktif. Protokol BT/dongle berbeda. |
| Mouse DPI / polling / pointer settings | String 800+ | Aset bersama untuk produk mouse, tidak muncul sebagai fitur keyboard pada audit; tidak ditambahkan. |

## Koreksi penting terhadap dokumen lama

1. Repo sekarang mempunyai Electron: fitur host-side tidak otomatis “mustahil”, tetapi belum memiliki handler event dan integrasi Linux.
2. Tampilan vendor mempunyai rentang lampu yang berbeda dari asumsi driver versi baru. Nilai 15 terlihat langsung; kemampuan firmware tetap perlu pengujian tersendiri.
3. `tools/perkey.html` lama menggunakan 192 byte packed RGB dan tidak mengisi chunk count 9. Ini tidak sesuai dengan encoder RGB yang dianalisis. Implementasi baru memakai tabel indexed 576 byte dan aktivasi terpisah. Halaman probe lama harus dianggap historis, bukan acuan protokol.
4. “Tidak ada read command” dari catatan lama bukan bukti seluruh firmware sudah dieksplorasi. Aplikasi tetap tidak mempunyai mekanisme membaca konfigurasi; echo feature report tidak boleh ditampilkan sebagai isi keymap.
5. Data extended memakai profil v3 agar aplikasi lama menolak versi baru secara jelas, alih-alih diam-diam membuang data RGB/makro.

## Urutan verifikasi lanjutan

1. Capture paket vendor terkontrol: Random Color OFF/ON, brightness/speed minimum/maksimum, per-key satu tombol, Disabled vs Default, mode putar makro.
2. Bandingkan byte capture dengan encoder dan simpan fixtures tes. Macro block header, jumlah chunk, mode binding, terminator adalah titik kritis.
3. Uji RGB baru pada hardware lalu kembali ke preset yang diketahui, dan uji flag game/Fn satu per satu. Pengiriman sukses/echo bukan bukti perilaku benar.
4. Setelah fixture macro binding terbukti, aktifkan upload dan assignment. Setelah format 0x20 jelas, bangun skema animasi.
5. Rancang daemon/IPC Electron untuk host actions, autostart, auto profile, dan music. Pisahkan aksi berkas/aplikasi dari akses arbitrer shell.

Consumer usages diperiksa terhadap [USB-IF HID Usage Tables](https://www.usb.org/sites/default/files/hut1_21_0.pdf), Consumer Page. Respons aktual tetap tergantung pemetaan desktop Linux.
