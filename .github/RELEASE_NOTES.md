Konfigurator desktop untuk keyboard VortexSeries GT65 di Linux.

## Mana yang harus diunduh

| Distro | Berkas |
|---|---|
| Ubuntu, Debian, Mint, Pop!_OS | `gt65-configurator_*_amd64.deb` |
| Fedora, RHEL, openSUSE | `gt65-configurator-*.x86_64.rpm` |
| Arch, dan lainnya | `gt65-configurator-*-x86_64.AppImage` |
| ARM64 (Asahi, Raspberry Pi) | `gt65-configurator_*_arm64.deb` atau `gt65-configurator-*-arm64.AppImage` — **rpm hanya dibangun untuk x64**, tidak ada `.rpm` arm64 |

Pasang `.deb` lewat `apt install ./...deb` dan `.rpm` lewat `dnf install ./...rpm`
(bukan `dpkg -i`/`rpm -i` — lihat "Memasang" di bawah) supaya dependensi
terselesaikan dan aturan udev otomatis benar-benar terpasang.

**Pengguna AppImage harus memasang aturan udev sendiri.** Aplikasi akan
menampilkan perintahnya dengan lintasan berkas yang benar begitu keyboard
terdeteksi tak bisa ditulis. `70-gt65.rules` juga dirilis sebagai aset lepas di
halaman rilis ini (unduh langsung, di luar isi AppImage) — berguna kalau Anda
ingin memasang aturannya sebelum membuka AppImage untuk pertama kali:

```
sudo install -m644 70-gt65.rules /etc/udev/rules.d/70-gt65.rules
sudo udevadm control --reload-rules && sudo udevadm trigger --subsystem-match=hidraw --action=add
```

Tanpa aturan itu keyboard akan terdeteksi tetapi setiap perubahan gagal tanpa pesan.

## Memasang

```bash
# Debian dan turunannya — apt menyelesaikan dependensi, dpkg -i tidak
sudo apt install ./gt65-configurator_0.1.0_amd64.deb

# Fedora dan turunannya
sudo dnf install ./gt65-configurator-0.1.0.x86_64.rpm
```

`dpkg -i`/`rpm -i` polos melewatkan resolusi dependensi: paket mendeklarasikan
15 dependensi, dan kalau ada yang kurang di sistem Anda, manajer paket
meninggalkan paket **tidak terkonfigurasi** — skrip `postinst` yang menjalankan
`udevadm control --reload-rules` dan `udevadm trigger` (janji "tanpa
cabut-colok") tidak pernah berjalan.

## Syarat

- glibc 2.25 atau lebih baru (`ldd --version`). Angka ini diukur dari simbol
  ELF biner Electron, **bukan** dari menjalankan paket ini di sistem glibc
  2.25 sungguhan — syarat perlu, bukan syarat cukup.
- **Belum ada pemasangan sungguhan yang diverifikasi di sistem apa pun.**
  `sudo` di mesin build membutuhkan sandi interaktif (tidak tersedia di CI/skrip
  ini), `rpmbuild` tidak terpasang di mesin verifikasi, dan Mint 22.2 yang
  sempat dicoba mengembalikan `apparmor_restrict_unprivileged_userns` ke 0.
  Yang SUDAH diverifikasi: isi paket lewat `dpkg-deb -c`, field
  control paket, skrip maintainer (`postinst`/`postrm`) **setelah** makro fpm
  disubstitusi, dan mode berkas hasil build. Yang BELUM diverifikasi: instalasi
  nyata di distro mana pun, pembangunan target rpm dari mesin ini (`rpmbuild`
  tidak terpasang, jadi belum pernah ada berkas `.rpm` untuk diperiksa sama
  sekali), perilaku di Ubuntu 24.04+ dengan pembatasan userns AppArmor aktif,
  dan artefak arm64 berjalan di perangkat arm64 sungguhan.
- **Keyboard harus tersambung lewat kabel USB.** Lewat dongle 2.4 GHz, kanal
  konfigurasi tidak tersedia dan aplikasi akan menolak dengan pesan jelas.

## Peringatan

Ini rilis 0.1.0 dan ditandai prerelease. Mode kering menyala secara bawaan —
aplikasi menampilkan paket yang akan dikirim tanpa mengirimnya. Ekspor profil Anda
sebelum menulis apa pun.

Tombol **Pulihkan bawaan** belum pernah diuji pada perangkat fisik dan berisiko
menghapus layer Fn pabrik secara permanen. Jangan pakai sampai
`docs/hardware-checklist.md` Task 14 dijalankan.

Artefak tidak ditandatangani. Verifikasi dengan `sha256sum -c SHA256SUMS.txt` —
atau, kalau Anda hanya mengunduh satu berkas (bukan keenamnya),
`sha256sum --ignore-missing -c SHA256SUMS.txt` supaya berkas yang tidak Anda
unduh tidak dilaporkan sebagai "FAILED open or read".
