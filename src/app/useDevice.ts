import { useCallback, useState } from 'react';
import { requestDevice, sendTransaction, DeviceError } from '../gt65/device';

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
   */
  const send = useCallback(async (...transactions: Uint8Array[][]) => {
    setLastPackets(transactions.flat());
    switch (sendDecision(dryRun, device)) {
      case 'dry':
        return;
      case 'nodevice':
        setError('Belum tersambung ke keyboard.');
        return;
      case 'send':
        setError(null);
        try {
          // Berhenti di kegagalan pertama: melanjutkan penulisan setelah
          // satu transaksi gagal hanya menambah keadaan yang tak diketahui
          // pada perangkat yang tidak bisa dibaca balik.
          for (const t of transactions) {
            await sendTransaction(device as HIDDevice, t);
          }
        } catch (e) {
          setError(`Gagal mengirim: ${String(e)}`);
        }
        return;
    }
  }, [device, dryRun]);

  return { device, status, error, connect, send, lastPackets };
}
