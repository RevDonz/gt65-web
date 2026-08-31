import { useCallback, useState } from 'react';
import { requestDevice, sendTransaction, DeviceError } from '../gt65/device';
import { formatLogText, makeLogEntry, makeReadbackList, pushLogEntry } from './log';
import type { LogEntry } from './log';
import { sendToDevLogSink } from './devLogSink';

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
    // Balikan (read-back) dikumpulkan per paket oleh `sendTransaction` itu
    // sendiri (satu baca sesudah tiap kirim — lihat device.ts). Di sini
    // cuma digabung lintas transaksi; tetap kosong untuk 'dry'/'nodevice'
    // karena keduanya tidak pernah memanggil sendTransaction sama sekali.
    let readbacks: Uint8Array[] = [];

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
            readbacks = readbacks.concat(await sendTransaction(device as HIDDevice, t));
          }
        } catch (e) {
          const msg = `Gagal mengirim: ${String(e)}`;
          setError(msg);
          outcome = msg;
        }
        break;
    }

    const entry = makeLogEntry({
      at: new Date().toISOString(),
      label: entryLabel,
      decision,
      packets,
      connected,
      outcome,
      readbacks: makeReadbackList(packets, readbacks),
    });
    setLog((prev) => pushLogEntry(prev, entry));

    // Salin entri ini ke dev-server log sink (lihat devLogSink.ts) — tak
    // aktif di build produksi, dan kegagalannya tak pernah memengaruhi
    // transaksi nyata di atas. Format persis sama dengan tombol "Salin
    // log" (satu entri saja) supaya kedua log tidak pernah berbeda cerita.
    sendToDevLogSink(formatLogText([entry], {
      dryRun,
      productName: device?.productName ?? null,
    }));
  }, [device, dryRun]);

  return { device, status, error, connect, send, lastPackets, log };
}
