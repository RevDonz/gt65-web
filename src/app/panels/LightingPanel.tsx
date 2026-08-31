import type { Profile } from '../../store/profile';

export function LightingPanel({ profile, onChange, onApply }: {
  profile: Profile;
  onChange: (p: Profile) => void;
  onApply: () => void;
}) {
  const l = profile.lighting;
  const set = (patch: Partial<typeof l>) =>
    onChange({ ...profile, lighting: { ...l, ...patch } });

  const hex = `#${[l.r, l.g, l.b].map((v) =>
    v.toString(16).padStart(2, '0')).join('')}`;

  return (
    <section className="flex max-w-md flex-col gap-4">
      <label className="flex items-center justify-between gap-4">
        Mode
        <input type="number" min={0} max={30} value={l.mode}
               onChange={(e) => set({ mode: Number(e.target.value) })}
               className="w-24 rounded bg-slate-800 px-2 py-1" />
      </label>

      <label className="flex items-center justify-between gap-4">
        Warna
        <input type="color" value={hex}
               onChange={(e) => {
                 const v = e.target.value;
                 set({ r: parseInt(v.slice(1, 3), 16),
                       g: parseInt(v.slice(3, 5), 16),
                       b: parseInt(v.slice(5, 7), 16) });
               }} />
      </label>

      <label className="flex items-center justify-between gap-4">
        Kecepatan
        <input type="range" min={0} max={4} value={l.speed}
               onChange={(e) => set({ speed: Number(e.target.value) })} />
      </label>

      <label className="flex items-center justify-between gap-4">
        Kecerahan
        <input type="range" min={0} max={4} value={l.brightness}
               onChange={(e) => set({ brightness: Number(e.target.value) })} />
      </label>

      <label className="flex items-center justify-between gap-4">
        Arah
        <input type="number" min={0} max={3} value={l.direction}
               onChange={(e) => set({ direction: Number(e.target.value) })}
               className="w-24 rounded bg-slate-800 px-2 py-1" />
      </label>

      <button onClick={onApply}
              className="rounded bg-emerald-700 px-4 py-2 hover:bg-emerald-600">
        Terapkan pencahayaan
      </button>
    </section>
  );
}
