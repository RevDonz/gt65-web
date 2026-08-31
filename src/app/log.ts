import { formatHex, hexLine } from './hex';
import type { SendDecision } from './useDevice';

/**
 * Hasil pembacaan balik feature report 0 sesudah pengiriman sungguhan.
 * `ok: true` berarti pembacaan berhasil (`matched` memberi tahu apakah
 * isinya cocok dengan paket terakhir yang dikirim); `ok: false` berarti
 * pembacaan itu sendiri gagal — transaksi pengiriman tetap dianggap
 * berhasil karena penulisannya sudah terjadi sebelum pembacaan dicoba.
 */
export type EchoResult =
  | { ok: true; hex: string; matched: boolean }
  | { ok: false; error: string };

export type LogEntry = {
  at: string;
  label: string;
  decision: SendDecision;
  packetCount: number;
  connected: boolean;
  packetsHex: string;
  outcome: string;
  echo: EchoResult | null;
};

/** Bandingkan dua larik byte apa adanya; panjang beda dianggap tak cocok. */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Bangun `EchoResult` dari byte balikan dan paket terakhir yang dikirim. */
export function makeEchoResult(echoBytes: Uint8Array, lastPacket: Uint8Array | undefined): EchoResult {
  return {
    ok: true,
    hex: hexLine(echoBytes),
    matched: lastPacket !== undefined && bytesEqual(echoBytes, lastPacket),
  };
}

export function makeLogEntry(params: {
  at: string;
  label: string;
  decision: SendDecision;
  packets: Uint8Array[];
  connected: boolean;
  outcome: string;
  echo: EchoResult | null;
}): LogEntry {
  return {
    at: params.at,
    label: params.label,
    decision: params.decision,
    packetCount: params.packets.length,
    connected: params.connected,
    packetsHex: formatHex(params.packets),
    outcome: params.outcome,
    echo: params.echo,
  };
}

/** Tambahkan entri terbaru di depan, batasi panjang log. */
export function pushLogEntry(log: LogEntry[], entry: LogEntry, cap = 100): LogEntry[] {
  return [entry, ...log].slice(0, cap);
}

const DECISION_LABEL: Record<SendDecision, string> = {
  dry: 'mode kering',
  nodevice: 'tanpa perangkat',
  send: 'terkirim',
};

/**
 * Ekspor log sebagai teks polos (bukan JSON) supaya bisa ditempel langsung
 * ke obrolan dukungan tanpa perlu membuka aplikasi ini.
 */
export function formatLogText(entries: LogEntry[], ctx: {
  dryRun: boolean;
  productName: string | null;
}): string {
  const totalPackets = entries.reduce((n, e) => n + e.packetCount, 0);
  const lines: string[] = [
    '=== Log transaksi GT65 ===',
    `Diekspor: ${new Date().toISOString()}`,
    `Mode kering: ${ctx.dryRun ? 'aktif' : 'nonaktif'}`,
    `Perangkat: ${ctx.productName ?? 'tidak tersambung'}`,
    `Jumlah entri: ${entries.length}`,
    `Total paket: ${totalPackets}`,
    '',
  ];

  for (const e of entries) {
    lines.push(`[${e.at}] ${e.label}`);
    lines.push(
      `  keputusan: ${DECISION_LABEL[e.decision]} | paket: ${e.packetCount} | ` +
      `perangkat tersambung: ${e.connected ? 'ya' : 'tidak'}`,
    );
    lines.push(`  hasil: ${e.outcome}`);
    if (e.echo === null) {
      lines.push('  echo: tidak dicoba');
    } else if (e.echo.ok) {
      lines.push(`  echo: ${e.echo.matched ? 'COCOK' : 'TIDAK COCOK'} (${e.echo.hex})`);
    } else {
      lines.push(`  echo: gagal dibaca (${e.echo.error})`);
    }
    lines.push('  paket:');
    for (const row of e.packetsHex.split('\n')) {
      lines.push(row ? `    ${row}` : '');
    }
    lines.push('');
  }

  return lines.join('\n');
}
