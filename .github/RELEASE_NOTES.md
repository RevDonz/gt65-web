GT65 Configurator **v0.2.0** membawa UI Keyboard Studio baru dan editor tambahan untuk VortexSeries GT65 di Linux. Rilis ini memakai kode branch `master`.

## Perubahan

- Tampilan studio gelap, keyboard interaktif, navigasi yang mempertahankan koneksi perangkat dan riwayat sesi.
- Pustaka banyak profil: buat, duplikat, rename, impor/ekspor, dan hapus dengan konfirmasi.
- Editor RGB per tombol: multi-select, WASD/angka, warna kuas, impor/ekspor skema.
- Studio makro lokal: rekam keyboard, edit event tombol/mouse/jeda, atur urutan, impor/ekspor, dan validasi kapasitas.
- Pengaturan mode game, blokir Alt+Tab/Alt+F4/Super, Fn Momentary/Toggle, dan waktu tidur lampu.
- Fungsi sistem/browser 16-bit, kombinasi shortcut sendiri, dan impor/ekspor efek lampu terpisah.
- Profil v3; profil lama v1/v2 dimigrasi. Ekspor cadangan sebelum upgrade; profil v3 tidak dapat dibuka oleh aplikasi v0.1.0. Penyimpanan web dan desktop terpisah; pindahkan profil melalui Ekspor/Impor.

## Unduhan

| Sistem | Berkas |
|---|---|
| Ubuntu / Debian / Linux Mint, x64 | `gt65-configurator_0.2.0_amd64.deb` |
| Fedora / RHEL, x64 | `gt65-configurator-0.2.0.x86_64.rpm` |
| Linux lainnya, x64 | `gt65-configurator-0.2.0-x86_64.AppImage` |
| Linux ARM64 | `gt65-configurator_0.2.0_arm64.deb` atau `gt65-configurator-0.2.0-arm64.AppImage` |

```bash
# Ubuntu / Debian / Linux Mint
sudo apt install ./gt65-configurator_0.2.0_amd64.deb

# Fedora
sudo dnf install ./gt65-configurator-0.2.0.x86_64.rpm

# AppImage x64
chmod +x gt65-configurator-0.2.0-x86_64.AppImage
./gt65-configurator-0.2.0-x86_64.AppImage
```

`.deb` dan `.rpm` membawa aturan akses HID dan skrip instalasinya. Pengguna AppImage: unduh juga aset `70-gt65.rules` dari rilis ini, lalu jalankan perintah berikut di folder unduhannya:

```bash
sudo install -m644 70-gt65.rules /etc/udev/rules.d/70-gt65.rules
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=hidraw --action=add
```

Keyboard harus memakai **kabel USB**. Mode dongle 2.4 GHz menggunakan kanal berbeda dan belum didukung. Aplikasi desktop sudah menyertakan Chromium/Electron; tidak perlu browser atau Wine terpisah.

## Status fitur dan verifikasi

Rilis tetap **prerelease**. Mode kering aktif secara bawaan pada instalasi baru; pilihan pengguna yang sudah tersimpan tetap dipertahankan.

- Makro saat ini **editor lokal**, belum dapat di-upload atau diikat ke tombol perangkat. Mode putar firmware masih perlu diverifikasi; unduhan paket hanya pratinjau.
- Encoder RGB per tombol mengikuti hasil analisis driver vendor. Hasil fisik fitur baru ini dan tiap opsi pengaturan belum diuji ulang pada hardware dalam sesi rilis.
- Skema animasi khusus, sinkronisasi musik, aksi aplikasi/OS, dan update firmware belum tersedia.
- **Pulihkan bawaan** bukan factory reset hardware yang terverifikasi. Pemulihan layer Fn masih berisiko menghilangkan konfigurasi yang tidak dapat dibaca kembali. Ekspor profil sebelum menerapkan perubahan.
- Validasi lokal: 239 tes lulus; build produksi dan pemeriksaan tipe Electron lulus. Aplikasi produksi Linux x64 berhasil dijalankan dengan sembilan panel, impor/ekspor profil, editor makro/RGB, dan persistensi setelah restart. CI juga memeriksa isi paket. Instalasi melalui manajer paket pada setiap distro, ARM64 pada perangkat asli, serta konfigurasi AppArmor/user namespaces yang berbeda belum diuji menyeluruh.

Lihat [audit fitur dan batasannya](https://github.com/RevDonz/gt65-web/blob/v0.2.0/docs/vendor-feature-audit.md).

## Checksum

Artefak tidak ditandatangani. Setelah mengunduh `SHA256SUMS.txt` dan paket pilihan, periksa:

```bash
sha256sum --ignore-missing -c SHA256SUMS.txt
```
