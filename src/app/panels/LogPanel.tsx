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

function EchoBadge({ echo }: { echo: LogEntry['echo'] }) {
  if (echo === null) {
    return <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-400">echo: tidak dicoba</span>;
  }
  if (!echo.ok) {
    return (
      <span className="rounded bg-amber-950 px-2 py-0.5 text-amber-300">
        echo: gagal dibaca ({echo.error})
      </span>
    );
  }
  return echo.matched ? (
    <span className="rounded bg-emerald-950 px-2 py-0.5 text-emerald-300">echo: COCOK</span>
  ) : (
    <span className="rounded bg-rose-950 px-2 py-0.5 text-rose-300">echo: TIDAK COCOK</span>
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
                <EchoBadge echo={e.echo} />
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-slate-400">
                  Detail paket &amp; echo
                </summary>
                <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-3 text-xs">
                  {e.packetsHex}
                  {e.echo?.ok ? `\n\necho: ${e.echo.hex}` : ''}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
