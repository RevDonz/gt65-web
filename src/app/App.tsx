import { useState } from 'react';
import { DeviceBar } from './DeviceBar';
import { useDevice } from './useDevice';
import { formatHex } from './hex';
import { LightingPanel } from './panels/LightingPanel';
import { SettingsPanel } from './panels/SettingsPanel';
import { lighting, settings } from '../gt65/protocol';
import { loadProfile, saveProfile } from '../store/profile';
import type { Profile } from '../store/profile';

const TABS = ['Remap', 'Lampu', 'Pengaturan', 'Monitor'] as const;
type Tab = (typeof TABS)[number];

export function App() {
  const [dryRun, setDryRun] = useState(true);
  const [tab, setTab] = useState<Tab>('Lampu');
  const [profile, setProfileState] = useState<Profile>(loadProfile);
  const dev = useDevice(dryRun);

  const setProfile = (p: Profile) => { setProfileState(p); saveProfile(p); };

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
      </nav>
      <main className="px-6 pb-10">
        {tab === 'Lampu' && (
          <LightingPanel profile={profile} onChange={setProfile}
                         onApply={() => dev.send(lighting(profile.lighting))} />
        )}
        {tab === 'Pengaturan' && (
          <SettingsPanel profile={profile} onChange={setProfile}
                         onApply={() => dev.send(settings(profile.settings))} />
        )}
        {tab !== 'Lampu' && tab !== 'Pengaturan' && (
          <p className="text-slate-400">
            Profil <strong>{profile.name}</strong> — tab {tab}, panel diisi pada task berikutnya.
          </p>
        )}
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
