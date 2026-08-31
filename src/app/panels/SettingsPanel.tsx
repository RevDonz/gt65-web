import type { Profile } from '../../store/profile';

/**
 * Label masih berupa nomor offset karena pemetaan flag ke makna belum
 * ditentukan — lihat spec Bagian 5.4. Step 3 task ini menggantinya.
 */
export function SettingsPanel({ profile, onChange, onApply }: {
  profile: Profile;
  onChange: (p: Profile) => void;
  onApply: () => void;
}) {
  const s = profile.settings;

  const setFlag = (i: number, v: boolean) => {
    const flags = [...s.flags] as typeof s.flags;
    flags[i] = v;
    onChange({ ...profile, settings: { ...s, flags } });
  };

  return (
    <section className="flex max-w-md flex-col gap-4">
      {s.flags.map((v, i) => (
        <label key={i} className="flex items-center gap-3">
          <input type="checkbox" checked={v}
                 onChange={(e) => setFlag(i, e.target.checked)} />
          Flag byte {i + 1} <span className="text-slate-500">(belum diberi nama)</span>
        </label>
      ))}

      <label className="flex items-center justify-between gap-4">
        Timeout lampu tidur (menit)
        <input type="number" min={0} max={255} value={s.sleepTimeout}
               onChange={(e) => onChange({
                 ...profile,
                 settings: { ...s, sleepTimeout: Number(e.target.value) },
               })}
               className="w-24 rounded bg-slate-800 px-2 py-1" />
      </label>

      <button onClick={onApply}
              className="rounded bg-emerald-700 px-4 py-2 hover:bg-emerald-600">
        Terapkan pengaturan
      </button>
    </section>
  );
}
