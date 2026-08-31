import { useRef, useState } from 'react';
import { DeviceBar } from './DeviceBar';
import { useDevice } from './useDevice';
import { formatHex } from './hex';
import { RestoreButton } from './RestoreButton';
import { LightingPanel } from './panels/LightingPanel';
import { SettingsPanel } from './panels/SettingsPanel';
import { MonitorPanel } from './panels/MonitorPanel';
import { RemapPanel } from './panels/RemapPanel';
import { lighting, settings, remap } from '../gt65/protocol';
import {
  defaultProfile, exportProfile, importProfile, loadProfile, saveProfile,
} from '../store/profile';
import type { Profile } from '../store/profile';

const TABS = ['Remap', 'Lampu', 'Pengaturan', 'Monitor'] as const;
type Tab = (typeof TABS)[number];

/** Nama berkas unduhan dari nama profil; jatuh ke default kalau kosong/aneh. */
function exportFilename(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${slug || 'profil-gt65'}.json`;
}

export function App() {
  const [dryRun, setDryRun] = useState(true);
  const [tab, setTab] = useState<Tab>('Lampu');
  const [profile, setProfileState] = useState<Profile>(loadProfile);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dev = useDevice(dryRun);

  const setProfile = (p: Profile) => { setProfileState(p); saveProfile(p); };

  const handleExport = () => {
    const json = exportProfile(profile);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFilename(profile.name);
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      setProfile(importProfile(text));
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <DeviceBar status={dev.status} error={dev.error} dryRun={dryRun}
                 onConnect={dev.connect} onToggleDryRun={setDryRun} />
      <nav className="flex gap-2 px-6 py-3">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
                  className={`rounded px-3 py-1 ${
                    tab === t ? 'bg-slate-700' : 'hover:bg-slate-800'}`}>
            {t}
          </button>
        ))}
        <RestoreButton onRestore={async () => {
          const d = defaultProfile();
          setProfile(d);
          await dev.send(remap('top', d.layers.top));
          await dev.send(remap('fn', d.layers.fn));
          await dev.send(lighting(d.lighting));
          await dev.send(settings(d.settings));
        }} />
        <button onClick={handleExport}
                className="rounded border border-slate-600 px-3 py-1 hover:bg-slate-800">
          Ekspor profil
        </button>
        <button onClick={() => fileInputRef.current?.click()}
                className="rounded border border-slate-600 px-3 py-1 hover:bg-slate-800">
          Impor profil
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" hidden
               onChange={handleImportChange} />
      </nav>
      {importError && (
        <p className="px-6 text-sm text-rose-400">Gagal impor profil: {importError}</p>
      )}
      <main className="px-6 pb-10">
        {tab === 'Remap' && (
          <RemapPanel profile={profile} onChange={setProfile}
                      onApply={(l) => dev.send(remap(l, profile.layers[l]))} />
        )}
        {tab === 'Lampu' && (
          <LightingPanel profile={profile} onChange={setProfile}
                         onApply={() => dev.send(lighting(profile.lighting))} />
        )}
        {tab === 'Pengaturan' && (
          <SettingsPanel profile={profile} onChange={setProfile}
                         onApply={() => dev.send(settings(profile.settings))} />
        )}
        {tab === 'Monitor' && <MonitorPanel device={dev.device} />}
        <button onClick={() => setProfile({ ...profile, name: profile.name })}
                className="mt-4 rounded border border-slate-600 px-3 py-1">
          Simpan profil
        </button>
        {dev.lastPackets.length > 0 && (
          <pre className="mt-6 overflow-x-auto rounded bg-slate-950 p-4 text-xs">
            {formatHex(dev.lastPackets)}
          </pre>
        )}
      </main>
    </div>
  );
}
