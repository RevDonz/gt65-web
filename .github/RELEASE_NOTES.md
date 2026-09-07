Konfigurator desktop untuk keyboard VortexSeries GT65 di Linux.

## Mana yang harus diunduh

| Distro | Berkas |
|---|---|
| Ubuntu, Debian, Mint, Pop!_OS | `gt65-configurator_*_amd64.deb` |
| Fedora, RHEL, openSUSE | `gt65-configurator-*.x86_64.rpm` |
| Arch, dan lainnya | `gt65-configurator-*-x86_64.AppImage` |
| ARM64 (Asahi, Raspberry Pi) | berkas `arm64` |

`.deb` dan `.rpm` memasang aturan udev secara otomatis. **Pengguna AppImage harus
memasangnya sendiri** — aplikasi akan menampilkan perintahnya, atau:

```
sudo install -m644 70-gt65.rules /etc/udev/rules.d/70-gt65.rules
sudo udevadm control --reload-rules && sudo udevadm trigger --subsystem-match=hidraw --action=add
```

Tanpa aturan itu keyboard akan terdeteksi tetapi setiap perubahan gagal tanpa pesan.

## Syarat

- glibc 2.25 atau lebih baru (`ldd --version`)
- Diuji pada Ubuntu 22.04+, Debian 12+, Fedora 39+
- **Keyboard harus tersambung lewat kabel USB.** Lewat dongle 2.4 GHz, kanal
  konfigurasi tidak tersedia dan aplikasi akan menolak dengan pesan jelas.

## Peringatan

Ini rilis 0.1.0 dan ditandai prerelease. Mode kering menyala secara bawaan —
aplikasi menampilkan paket yang akan dikirim tanpa mengirimnya. Ekspor profil Anda
sebelum menulis apa pun.

Tombol **Pulihkan bawaan** belum pernah diuji pada perangkat fisik dan berisiko
menghapus layer Fn pabrik secara permanen. Jangan pakai sampai
`docs/hardware-checklist.md` Task 14 dijalankan.

Artefak tidak ditandatangani. Verifikasi dengan `sha256sum -c SHA256SUMS.txt`.
