import { useCallback, useState } from 'react';
import { requestDevice, sendTransaction, receiveFeatureEcho, DeviceError } from '../gt65/device';
import { makeEchoResult, makeLogEntry, pushLogEntry } from './log';
import type { EchoResult, LogEntry } from './log';

export type Status = 'idle' | 'connecting' | 'connected' | 'error';

export type SendDecision = 'dry' | 'nodevice' | 'send';

/**
 * Keputusan tunggal apakah pengiriman ke keyboard sungguhan boleh terjadi.
 *
 * Ini adalah pengaman keselamatan utama aplikasi: keyboard bersifat write-only
 * (tidak bisa dibaca balik), sehingga penulisan tak sengaja tidak menimbulkan
 * gejala apa pun. Fungsi murni dan sinkron ini dipisahkan dari hook React
 * agar cabang keputusan ini bisa diuji otomatis tanpa infrastruktur React.
 */
export function sendDecision(dryRun: boolean, device: HIDDevice | null): SendDecision {
  if (dryRun) return 'dry';
  if (!device) return 'nodevice';
  return 'send';
}

export function useDevice(dryRun: boolean) {
  const [device, setDevice] = useState<HIDDevice | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastPackets, setLastPackets] = useState<Uint8Array[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);

  const connect = useCallback(async () => {
    setStatus('connecting');
    setError(null);
    try {
      setDevice(await requestDevice());
      setStatus('connected');
    } catch (e) {
      setStatus('error');
      setError(e instanceof DeviceError ? e.message : String(e));
    }
  }, []);

  /**
   * Menerima satu transaksi atau beberapa sekaligus. Beberapa transaksi
   * tetap dikirim terpisah dan berurutan — persis seperti software vendor —
   * tapi pratinjau mode kering menampilkan gabungan semuanya. Sebelumnya
   * tiap transaksi menimpa `lastPackets`, sehingga pemulihan bawaan (dua
   * remap 13 paket, pencahayaan, pengaturan) hanya memperlihatkan 4 paket
   * terakhir: justru dua penulisan terbesar yang tak pernah terlihat oleh
   * pengguna yang sedang meninjau operasi paling berisiko di aplikasi ini.
   *
   * `label` bersifat opsional supaya penambahan parameter ini tidak memaksa
   * setiap pemanggilan lama berubah bentuk (mis. membungkus transaksi ke
   * dalam objek opsi) — tanpa label, entri log tetap tercatat dengan label
   * generik. Panggilan nyata di App.tsx selalu mengisi label yang berarti.
   */
  const send = useCallback(async (label?: string, ...transactions: Uint8Array[][]) => {
    const packets = transactions.flat();
    const entryLabel = label ?? 'Kirim transaksi';
    const connected = device !== null;
    const decision = sendDecision(dryRun, device);
    let outcome = 'ok';
    let echo: EchoResult | null = null;

    setLastPackets(packets);

    switch (decision) {
      case 'dry':
        break;
      case 'nodevice': {
        const msg = 'Belum tersambung ke keyboard.';
        setError(msg);
        outcome = msg;
        break;
      }
      case 'send':
        setError(null);
        try {
          // Berhenti di kegagalan pertama: melanjutkan penulisan setelah
          // satu transaksi gagal hanya menambah keadaan yang tak diketahui
          // pada perangkat yang tidak bisa dibaca balik.
          for (const t of transactions) {
            await sendTransaction(device as HIDDevice, t);
          }
          // Baca balik feature report 0 hanya sesudah pengiriman
          // sungguhan berhasil. Ini echo dari paket terakhir yang
          // ditulis, bukan konfigurasi tersimpan — cukup untuk
          // membuktikan byte sampai ke perangkat. Kegagalan di sini
          // dicatat tapi tidak menggagalkan transaksi: penulisannya
          // sudah terjadi.
          try {
            const echoBytes = await receiveFeatureEcho(device as HIDDevice);
            echo = makeEchoResult(echoBytes, packets[packets.length - 1]);
          } catch (e) {
            echo = { ok: false, error: String(e) };
          }
        } catch (e) {
          const msg = `Gagal mengirim: ${String(e)}`;
          setError(msg);
          outcome = msg;
        }
        break;
    }

    setLog((prev) => pushLogEntry(prev, makeLogEntry({
      at: new Date().toISOString(),
      label: entryLabel,
      decision,
      packets,
      connected,
      outcome,
      echo,
    })));
  }, [device, dryRun]);

  return { device, status, error, connect, send, lastPackets, log };
}
