import { useState } from 'react';

export function RestoreButton({ onRestore }: { onRestore: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)}
              className="rounded border border-amber-600 px-3 py-1 text-amber-400
                         hover:bg-amber-950">
        Pulihkan bawaan
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-sm">
      Tulis ulang seluruh konfigurasi ke bawaan?
      <button onClick={() => { setConfirming(false); onRestore(); }}
              className="rounded bg-amber-700 px-3 py-1">Ya, tulis</button>
      <button onClick={() => setConfirming(false)}
              className="rounded border border-slate-600 px-3 py-1">Batal</button>
    </span>
  );
}
