import type { Profile } from '../../store/profile';

// Vendor baseline encoder 0x426c40: _wtoi on the displayed minute value.
export const SLEEP_OPTIONS = [
  { value: 0, label: 'Tidak tidur' }, { value: 1, label: '1 menit' },
  { value: 5, label: '5 menit' }, { value: 30, label: '30 menit' },
];
const FLAGS = [
  ['Mode game', 'Aktifkan pembatasan shortcut agar permainan tidak terganggu.'],
  ['Blokir Alt + Tab', 'Cegah perpindahan jendela saat mode game aktif.'],
  ['Blokir Alt + F4', 'Cegah penutupan aplikasi saat mode game aktif.'],
  ['Blokir tombol Windows / Super', 'Cegah menu desktop terbuka saat mode game aktif.'],
];
export function SettingsPanel({ profile, onChange, onApply }: {
  profile: Profile; onChange: (p: Profile) => void; onApply: () => void;
}) {
  const s = profile.settings;
  const setFlag = (i: number, value: boolean) => {
    const flags = [...s.flags] as typeof s.flags;
    flags[i] = value;
    onChange({ ...profile, settings: { ...s, flags } });
  };
  return <section className="panel settings-card flex flex-col gap-4">
    <div className="label">Mode game &amp; shortcut</div>
    {FLAGS.map(([title, description], i) => <label key={title} className="setting-row">
      <span><strong>{title}</strong><small>{description}</small></span>
      <input type="checkbox" checked={s.flags[i]} disabled={i > 0 && !s.flags[0]} onChange={(e) => setFlag(i, e.target.checked)} />
    </label>)}
    <label className="setting-row"><span><strong>Perilaku tombol Fn</strong><small>Tahan untuk mengakses layer Fn, atau tekan untuk mengunci layer.</small></span>
      <select className="field" value={s.flags[4] ? 'toggle' : 'momentary'} onChange={(e) => setFlag(4, e.target.value === 'toggle')}><option value="momentary">Momentary · tahan Fn</option><option value="toggle">Toggle · tekan untuk berganti</option></select>
    </label>
    <label className="setting-row"><span><strong>Waktu tidur lampu</strong><small>Matikan pencahayaan setelah keyboard tidak digunakan.</small></span>
      <select className="field" value={s.sleepTimeout} onChange={(e) => onChange({ ...profile, settings: { ...s, sleepTimeout: Number(e.target.value) } })}>
        {SLEEP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        {!SLEEP_OPTIONS.some((o) => o.value === s.sleepTimeout) && <option value={s.sleepTimeout}>{s.sleepTimeout} menit (profil impor)</option>}
      </select>
    </label>
    <p className="text-[11px] text-[var(--ink-3)]">Pemetaan pengaturan mengikuti encoder driver GT65 asli. Perilaku tiap opsi pada firmware unit Anda belum diuji ulang dalam sesi ini.</p>
    <button className="btn btn-primary" onClick={onApply}>Terapkan pengaturan</button>
  </section>;
}
