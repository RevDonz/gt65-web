import type { Profile } from '../../store/profile';

/**
 * Software vendor hanya menawarkan empat pilihan waktu tidur lampu, bukan
 * satu angka bebas: tabel string vendor `1033.lan` ID 269 "Light Sleep
 * Time" diikuti tepat empat opsi — ID 270 "Not Sleep", 271 "1 min",
 * 272 "5 min", 273 "30 min". Disiplin proyek adalah mengirim hanya byte
 * yang dikirim vendor, jadi UI ini menawarkan empat pilihan yang sama.
 *
 * BELUM PASTI: nilai byte di balik keempat label ini. Yang dipersempit di
 * sini adalah daftar pilihannya, bukan encoding-nya. Angka menit dipakai
 * sebagai dugaan sementara karena spec Bagian 5.4 mencatat `payload[6]`
 * diisi dari hasil konversi string; kandidat lain yang sama masuk akal
 * adalah indeks 0-3. Harus dipastikan di hardware sebelum diperlakukan
 * sebagai fakta — lihat docs/hardware-checklist.md.
 */
export const SLEEP_OPTIONS: { value: number; label: string }[] = [
  { value: 0,  label: 'Tidak tidur' },
  { value: 1,  label: '1 menit' },
  { value: 5,  label: '5 menit' },
  { value: 30, label: '30 menit' },
];

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
    <section className="panel flex max-w-xl flex-col gap-4 p-4">
      <div className="label">Pengaturan perangkat</div>
      {s.flags.map((v, i) => (
        <label key={i} className="flex items-center gap-3 text-[12px]">
          <input type="checkbox" checked={v} className="accent-[var(--ok)]"
                 onChange={(e) => setFlag(i, e.target.checked)} />
          <span className="num text-[11px] text-[var(--ink-2)]">flag[{i + 1}]</span>
          <span className="text-[var(--ink-3)]">belum diberi nama</span>
        </label>
      ))}

      <label className="flex items-center justify-between gap-4 border-t
                        border-[var(--edge)] pt-4">
        <span className="label">Waktu tidur lampu</span>
        <select value={String(s.sleepTimeout)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isInteger(v)) return;
                  onChange({ ...profile, settings: { ...s, sleepTimeout: v } });
                }}
                className="field w-40">
          {SLEEP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
          {!SLEEP_OPTIONS.some((o) => o.value === s.sleepTimeout) && (
            <option value={s.sleepTimeout}>
              Nilai lain ({s.sleepTimeout}) — bukan pilihan vendor
            </option>
          )}
        </select>
      </label>
      <p className="-mt-2 text-[11px] leading-relaxed text-[var(--ink-3)]">
        Vendor hanya menawarkan empat pilihan ini. Nilai byte di baliknya
        belum dipastikan di hardware.
      </p>

      <button onClick={onApply}
              className="btn btn-primary">
        Terapkan pengaturan
      </button>
    </section>
  );
}
