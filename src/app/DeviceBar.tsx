import type { Status } from './useDevice';

const LABEL: Record<Status, string> = {
  idle: 'Belum tersambung',
  connecting: 'Menyambungkan…',
  connected: 'Tersambung',
  error: 'Gagal',
};

export function DeviceBar({ status, error, dryRun, onConnect, onToggleDryRun }: {
  status: Status; error: string | null; dryRun: boolean;
  onConnect: () => void; onToggleDryRun: (v: boolean) => void;
}) {
  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-slate-700 px-6 py-3">
      <span className="font-semibold">GT65</span>
      <button onClick={onConnect}
              className="rounded border border-slate-600 px-3 py-1 hover:bg-slate-800">
        Sambungkan keyboard
      </button>
      <span className={status === 'connected' ? 'text-emerald-400' : 'text-slate-400'}>
        {LABEL[status]}
      </span>
      <label className="ml-auto flex items-center gap-2">
        <input type="checkbox" checked={dryRun}
               onChange={(e) => onToggleDryRun(e.target.checked)} />
        Mode kering (tidak menulis ke keyboard)
      </label>
      {error && <p className="w-full text-sm text-rose-400">{error}</p>}
    </header>
  );
}
