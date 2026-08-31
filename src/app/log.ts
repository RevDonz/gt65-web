import { statusByte } from '../gt65/device';
import { formatHex, hexLine } from './hex';
import type { SendDecision } from './useDevice';

/**
 * Balikan (read-back) satu paket, dibaca lewat `receiveFeatureReport(0)`
 * sesaat sesudah paket itu dikirim (lihat `sendTransaction` di device.ts).
 * `hex` kosong berarti pembacaannya sendiri gagal — penulisannya tetap
 * dianggap berhasil karena sudah terjadi sebelum pembacaan dicoba.
 * `status` adalah nilai dari {@link statusByte}: angka untuk paket
 * perintah dengan balikan yang cukup panjang, `null` untuk paket data
 * atau balikan yang gagal/terlalu pendek — lihat catatan di statusByte
 * soal kenapa ini bukan "diterima/ditolak".
 */
export type PacketReadback = { hex: string; status: number | null };

/** Bandingkan dua larik byte apa adanya; panjang beda dianggap tak cocok. */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Bangun daftar `PacketReadback`, satu per paket yang dikirim, dari paket
 * yang dikirim (`sent`) dan balikan yang dibaca sesudahnya (`got`) —
 * seperti yang dikembalikan `sendTransaction`. Kalau `got` lebih pendek
 * dari `sent` (transaksi berhenti di tengah jalan karena gagal kirim),
 * hanya paket yang sempat punya balikan yang dimasukkan.
 */
export function makeReadbackList(sent: Uint8Array[], got: Uint8Array[]): PacketReadback[] {
  return got.map((g, i) => ({
    hex: g.length > 0 ? hexLine(g) : '',
    status: statusByte(sent[i], g),
  }));
}

export type LogEntry = {
  at: string;
  label: string;
  decision: SendDecision;
  packetCount: number;
  connected: boolean;
  packetsHex: string;
  outcome: string;
  readbacks: PacketReadback[];
};

export function makeLogEntry(params: {
  at: string;
  label: string;
  decision: SendDecision;
  packets: Uint8Array[];
  connected: boolean;
  outcome: string;
  readbacks: PacketReadback[];
}): LogEntry {
  return {
    at: params.at,
    label: params.label,
    decision: params.decision,
    packetCount: params.packets.length,
    connected: params.connected,
    packetsHex: formatHex(params.packets),
    outcome: params.outcome,
    readbacks: params.readbacks,
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
    if (e.readbacks.length === 0) {
      lines.push('  baca balik per paket: tidak dicoba (mode kering / tanpa perangkat)');
    } else {
      lines.push('  baca balik per paket:');
      e.readbacks.forEach((r, i) => {
        const status = r.status === null ? '—' : String(r.status);
        const hex = r.hex || '(gagal dibaca)';
        lines.push(`    paket ${i + 1}/${e.packetCount}: status ${status} | ${hex}`);
      });
    }
    lines.push('  paket:');
    for (const row of e.packetsHex.split('\n')) {
      lines.push(row ? `    ${row}` : '');
    }
    lines.push('');
  }

  return lines.join('\n');
}
