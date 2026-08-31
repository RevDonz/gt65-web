import { useState } from 'react';
import { formatLogText } from '../log';
import type { LogEntry } from '../log';

const DECISION_LABEL: Record<LogEntry['decision'], string> = {
  dry: 'Mode kering',
  nodevice: 'Tanpa perangkat',
  send: 'Terkirim',
};

const DECISION_CLASS: Record<LogEntry['decision'], string> = {
  dry: 'text-slate-400',
  nodevice: 'text-amber-400',
  send: 'text-emerald-400',
};

function downloadFilename(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `gt65-log-${stamp}.txt`;
}

function ReadbackBadge({ readbacks }: { readbacks: LogEntry['readbacks'] }) {
  if (readbacks.length === 0) {
    return <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-400">baca balik: tidak dicoba</span>;
  }
  const gagal = readbacks.filter((r) => r.hex === '').length;
  return (
    <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">
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
    <table className="mt-2 w-full table-fixed border-collapse text-xs">
      <thead>
        <tr className="text-slate-400">
          <th className="w-12 text-left font-normal">paket</th>
          <th className="w-16 text-left font-normal">status</th>
          <th className="text-left font-normal">balikan (hex)</th>
        </tr>
      </thead>
      <tbody>
        {readbacks.map((r, i) => (
          <tr key={i} className="border-t border-slate-800">
            <td className="py-1 text-slate-400">{i + 1}/{readbacks.length}</td>
            <td className="py-1">{r.status === null ? '—' : r.status}</td>
            <td className="py-1 truncate text-slate-300">{r.hex || '(gagal dibaca)'}</td>
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
        <button onClick={handleCopy}
                className="rounded border border-slate-600 px-3 py-1 hover:bg-slate-800">
          Salin log
        </button>
        <button onClick={handleDownload}
                className="rounded border border-slate-600 px-3 py-1 hover:bg-slate-800">
          Unduh log
        </button>
        <span className="text-slate-400">{entries.length} entri</span>
        {copyStatus && <span className="text-sm text-slate-400">{copyStatus}</span>}
      </div>

      {entries.length === 0 ? (
        <p className="text-slate-400">
          Belum ada transaksi. Klik salah satu tombol "Terapkan" di tab lain.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((e, i) => (
            <li key={i} className="rounded border border-slate-700 bg-slate-950 p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-400">{new Date(e.at).toLocaleString()}</span>
                <span className="font-semibold">{e.label}</span>
                <span className={DECISION_CLASS[e.decision]}>{DECISION_LABEL[e.decision]}</span>
                <span className="text-slate-400">{e.packetCount} paket</span>
                <span className={e.outcome === 'ok' ? 'text-emerald-400' : 'text-rose-400'}>
                  {e.outcome === 'ok' ? 'berhasil' : e.outcome}
                </span>
                <ReadbackBadge readbacks={e.readbacks} />
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-slate-400">
                  Detail paket &amp; balikan
                </summary>
                <ReadbackTable readbacks={e.readbacks} />
                <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-3 text-xs">
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
