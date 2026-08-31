import { useState } from 'react';
import { formatLogText } from '../log';
import type { LogEntry } from '../log';

const DECISION_LABEL: Record<LogEntry['decision'], string> = {
  dry: 'Mode kering',
  nodevice: 'Tanpa perangkat',
  send: 'Terkirim',
};

const DECISION_COLOR: Record<LogEntry['decision'], string> = {
  dry: 'var(--ink-3)',
  nodevice: 'var(--warn)',
  send: 'var(--ok)',
};

function downloadFilename(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `gt65-log-${stamp}.txt`;
}

function ReadbackBadge({ readbacks }: { readbacks: LogEntry['readbacks'] }) {
  if (readbacks.length === 0) {
    return <span className="rounded-[3px] bg-[var(--panel-2)] px-2 py-0.5 text-[var(--ink-3)]">baca balik: tidak dicoba</span>;
  }
  const gagal = readbacks.filter((r) => r.hex === '').length;
  return (
    <span className="rounded-[3px] bg-[var(--panel-2)] px-2 py-0.5 text-[var(--ink-2)]">
      baca balik: {readbacks.length} paket{gagal > 0 ? ` (${gagal} gagal dibaca)` : ''}
    </span>
  );
}

/**
 * Tabel status per paket. `status` datang dari `statusByte()` (device.ts) —
 * angka mentah untuk paket perintah, "—" untuk paket data atau balikan
 * yang gagal/terlalu pendek. Ini pengamatan, bukan makna "diterima/ditolak"
 * yang pasti — lihat catatan di device.ts.
 */
function ReadbackTable({ readbacks }: { readbacks: LogEntry['readbacks'] }) {
  if (readbacks.length === 0) return null;
  return (
    <table className="mt-2 w-full table-fixed border-collapse text-[11px]">
      <thead>
        <tr className="text-[var(--ink-3)]">
          <th className="w-14 text-left font-normal">paket</th>
          <th className="w-16 text-left font-normal">status</th>
          <th className="text-left font-normal">balikan (hex)</th>
        </tr>
      </thead>
      <tbody>
        {readbacks.map((r, i) => (
          <tr key={i} className="border-t border-[var(--edge)]">
            <td className="py-1 text-[var(--ink-2)]">{i + 1}/{readbacks.length}</td>
            <td className="num py-1">{r.status === null ? '—' : r.status}</td>
            <td className="num truncate py-1 text-[var(--ink-2)]">{r.hex || '(gagal dibaca)'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function LogPanel({ entries, dryRun, productName }: {
  entries: LogEntry[];
  dryRun: boolean;
  productName: string | null;
}) {
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const text = () => formatLogText(entries, { dryRun, productName });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text());
      setCopyStatus('Log tersalin ke clipboard.');
    } catch (e) {
      setCopyStatus(`Gagal menyalin: ${String(e)}`);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([text()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFilename();
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="label">Log transaksi</span>
        <button onClick={handleCopy}
                className="btn">
          Salin log
        </button>
        <button onClick={handleDownload}
                className="btn">
          Unduh log
        </button>
        <span className="num text-[11px] text-[var(--ink-3)]">{entries.length} entri</span>
        {copyStatus && <span className="text-[12px] text-[var(--ink-2)]">{copyStatus}</span>}
      </div>

      {entries.length === 0 ? (
        <p className="panel px-4 py-3 text-[12px] text-[var(--ink-2)]">
          Belum ada transaksi. Klik salah satu tombol "Terapkan" di tab lain.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((e, i) => (
            <li key={i} className="panel p-3">
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className="num text-[10px] text-[var(--ink-3)]">{new Date(e.at).toLocaleString()}</span>
                <span className="font-semibold">{e.label}</span>
                <span style={{ color: DECISION_COLOR[e.decision] }}>{DECISION_LABEL[e.decision]}</span>
                <span className="text-[var(--ink-3)]">{e.packetCount} paket</span>
                <span style={{ color: e.outcome === 'ok' ? 'var(--ok)' : 'var(--crit)' }}>
                  {e.outcome === 'ok' ? 'berhasil' : e.outcome}
                </span>
                <ReadbackBadge readbacks={e.readbacks} />
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] text-[var(--ink-2)]">
                  Detail paket &amp; balikan
                </summary>
                <ReadbackTable readbacks={e.readbacks} />
                <pre className="well num mt-2 overflow-x-auto p-3 text-[10px] leading-[1.7]
                                text-[var(--ink-2)]">
                  {e.packetsHex}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
