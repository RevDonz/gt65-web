import { useEffect, useMemo, useState } from 'react';
import { KeyboardGrid, FN_USAGE } from '../KeyboardGrid';
import { KEYS } from '../../gt65/layout';
import { usageForCode } from '../../gt65/keyevents';
import { keyIndicesForUsage } from '../testerResolve';
import { defaultProfile } from '../../store/profile';
import type { Profile } from '../../store/profile';

/**
 * Tombol yang bisa diuji lewat event DOM: seluruh papan KECUALI Fn.
 * Kombinasi Fn diselesaikan di dalam firmware keyboard dan tidak pernah
 * dikirim sebagai event ke sistem operasi, jadi memasukkan Fn ke penyebut
 * hitungan hanya akan membuat sapuan penuh berhenti di 65/66 dan membuat
 * pengguna menyimpulkan ada tombol rusak. Kalau suatu saat sebuah sistem
 * operasi memang melaporkannya, keycap-nya tetap menyala di papan.
 */
const TESTABLE = KEYS.filter((k) => k.usage !== FN_USAGE);

/**
 * Legenda asli tiap tombol, untuk perbandingan "berubah dari bawaan" di
 * `KeyboardGrid` — sama seperti `DEFAULT_LAYERS` di RemapPanel. Aman
 * dihitung sekali di scope modul karena `defaultProfile()` murni.
 */
const DEFAULT_TOP = defaultProfile().layers.top;

type LastEvent = { code: string; usage: number | null; indices: number[]; repeat: boolean };

function hex(usage: number): string {
  return `0x${usage.toString(16).padStart(2, '0')}`;
}

/**
 * Ubah kumpulan `keyIndex` (posisi fisik) menjadi kumpulan usage PABRIK
 * tombol pada posisi itu, supaya bisa dioper ke `heldUsages`/`seenUsages`
 * milik `KeyboardGrid` — kedua prop itu mencocokkan usage pabrik tiap
 * keycap (`k.usage`), bukan keyIndex. Aman: setiap tombol fisik di papan
 * ini punya usage pabrik yang unik (diuji di layout.test.ts), jadi
 * pemetaan keyIndex → usage pabrik ini tidak pernah bertabrakan.
 */
function toFactoryUsages(indices: ReadonlySet<number>): Set<number> {
  const out = new Set<number>();
  for (const k of KEYS) {
    if (indices.has(k.keyIndex)) out.add(k.usage);
  }
  return out;
}

/**
 * Teks status untuk "Event terakhir" — hasil resolusi usage yang masuk
 * terhadap profil aktif (lihat `keyIndicesForUsage`). `ok: true` hanya
 * kalau usage itu menunjuk TEPAT SATU tombol fisik; kasus ganda maupun
 * kosong sama-sama tampil sebagai peringatan karena keduanya bukan jawaban
 * pasti yang boleh disamarkan.
 */
function describeResolution(usage: number | null, indices: number[]): { text: string; ok: boolean } {
  if (usage === null) return { text: 'kode tidak dikenal', ok: false };
  if (indices.length === 0) return { text: 'di luar papan ini', ok: false };
  if (indices.length > 1) {
    return { text: `${indices.length} tombol memetakan usage ini`, ok: false };
  }
  const key = KEYS.find((k) => k.keyIndex === indices[0]);
  return { text: `→ tombol "${key?.name ?? '?'}" (indeks ${indices[0]})`, ok: true };
}

export function TesterPanel({ profile }: { profile: Profile }) {
  const [held, setHeld] = useState<ReadonlySet<number>>(() => new Set());
  const [seen, setSeen] = useState<ReadonlySet<number>>(() => new Set());
  const [last, setLast] = useState<LastEvent | null>(null);

  /**
   * Sumber datanya adalah event keyboard DOM, BUKAN WebHID. Chromium
   * memblokir koleksi Generic Desktop/Keyboard perangkat ini, jadi laporan
   * HID keyboard-nya memang tidak pernah bisa dibaca halaman web — lihat
   * doc comment di `keyevents.ts`.
   *
   * `preventDefault()` dipanggil pada keydown dan keyup supaya tombol yang
   * diuji tidak sekaligus memicu pintasan browser atau mengetik ke dalam
   * halaman. Efek sampingnya: selama tab ini terbuka, papan ketik tidak
   * bisa dipakai menavigasi aplikasi — itu disebutkan di catatan bawah.
   *
   * `held`/`seen` menyimpan `keyIndex` (posisi tombol FISIK), bukan usage
   * yang dikirim. Usage yang masuk dicocokkan ke tombol fisik lewat
   * `keyIndicesForUsage` — terhadap layer utama PROFIL AKTIF dulu, baru
   * jatuh ke `layout.ts` pabrik kalau profil tidak punya entrinya. Itu
   * sebabnya efek ini bergantung pada `profile`: begitu profil berubah,
   * pemetaan usage → tombol fisik ikut berubah.
   */
  useEffect(() => {
    const down = (ev: KeyboardEvent) => {
      ev.preventDefault();
      const usage = usageForCode(ev.code);
      const indices = usage === null ? [] : keyIndicesForUsage(profile, usage);
      setLast({ code: ev.code, usage, indices, repeat: ev.repeat });
      if (indices.length === 0) return;
      setHeld((prev) => {
        const next = new Set(prev);
        let changed = false;
        for (const i of indices) if (!next.has(i)) { next.add(i); changed = true; }
        return changed ? next : prev;
      });
      setSeen((prev) => {
        const next = new Set(prev);
        let changed = false;
        for (const i of indices) if (!next.has(i)) { next.add(i); changed = true; }
        return changed ? next : prev;
      });
    };
    const up = (ev: KeyboardEvent) => {
      ev.preventDefault();
      const usage = usageForCode(ev.code);
      const indices = usage === null ? [] : keyIndicesForUsage(profile, usage);
      if (indices.length === 0) return;
      setHeld((prev) => {
        if (!indices.some((i) => prev.has(i))) return prev;
        const next = new Set(prev);
        for (const i of indices) next.delete(i);
        return next;
      });
    };
    /**
     * Kalau jendela kehilangan fokus di tengah penekanan (mis. Alt+Tab yang
     * ditangani sistem operasi), keyup-nya tidak pernah sampai dan tombol
     * itu akan tampak tertahan selamanya. Kosongkan saja.
     */
    const clearHeld = () => setHeld((prev) => (prev.size === 0 ? prev : new Set()));

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clearHeld);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clearHeld);
    };
  }, [profile]);

  const seenOnBoard = useMemo(
    () => TESTABLE.filter((k) => seen.has(k.keyIndex)),
    [seen],
  );
  const missing = useMemo(
    () => TESTABLE.filter((k) => !seen.has(k.keyIndex)).map((k) => k.name),
    [seen],
  );
  const heldUsages = useMemo(() => toFactoryUsages(held), [held]);
  const seenUsages = useMemo(() => toFactoryUsages(seen), [seen]);

  const done = seenOnBoard.length;
  const total = TESTABLE.length;
  const resolution = last === null ? null : describeResolution(last.usage, last.indices);

  return (
    <div className="flex flex-col gap-4">
      <div className="panel flex flex-wrap items-center gap-4 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="num text-[18px] font-medium"
                style={{ color: done === total ? 'var(--ok)' : 'var(--ink)' }}>
            {done} / {total}
          </span>
          <span className="label">tombol terlihat</span>
        </div>

        <button className="btn" onClick={() => { setSeen(new Set()); setLast(null); }}>
          Reset
        </button>

        <div className="well ml-auto min-w-[280px] px-3 py-2">
          <div className="label mb-1">Event terakhir</div>
          {last === null || resolution === null ? (
            <div className="num text-[var(--ink-3)]">menunggu penekanan tombol…</div>
          ) : (
            <div className="num flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span style={{ color: 'var(--ink)' }}>{last.code}</span>
              <span style={{ color: last.usage === null ? 'var(--ink-3)' : 'var(--ink)' }}>
                {last.usage === null ? 'usage —' : `usage ${hex(last.usage)}`}
              </span>
              <span style={{ color: resolution.ok ? 'var(--ok)' : 'var(--warn)' }}>
                {resolution.text}
              </span>
              {last.repeat && <span style={{ color: 'var(--ink-3)' }}>ulang</span>}
            </div>
          )}
        </div>
      </div>

      {/*
        `entries`/`defaultEntries` diisi (bukan Tester "kosong" seperti
        sebelumnya) supaya keycap menampilkan LEGENDA YANG BERLAKU SEKARANG
        sebagai tulisan utama — persis perlakuan dua-legenda RemapPanel.
        Tombol "del" yang dipetakan ulang ke Home harus tertulis "Home" di
        sini, dengan "del" kecil-redup di pojok — kalau tidak, tombol yang
        menyala saat ditekan terlihat seperti bug meski resolver di atas
        sudah benar.
      */}
      <KeyboardGrid entries={profile.layers.top} defaultEntries={DEFAULT_TOP}
                    heldUsages={heldUsages} seenUsages={seenUsages} />

      {missing.length > 0 && missing.length <= 12 && (
        <p className="text-[11px] text-[var(--ink-2)]">
          <span className="label">Belum terlihat</span>{' '}
          <span className="num">{missing.join('  ')}</span>
        </p>
      )}

      <div className="panel max-w-3xl px-4 py-3 text-[12px] leading-relaxed text-[var(--ink-2)]">
        <div className="label mb-2">Apa yang sebenarnya diuji</div>
        <p>
          Tester ini membaca <strong>event keyboard yang sampai ke sistem
          operasi</strong>, bukan laporan yang dikirim keyboard. Chromium
          memblokir koleksi keyboard perangkat HID, jadi tidak ada cara
          membaca langsung dari papan ini lewat browser. Usage yang masuk
          dicocokkan ke tombol fisik lewat <strong>profil yang sedang
          aktif</strong> dulu — bukan cuma layout pabrik — supaya tombol
          yang sudah dipetakan ulang tetap terdeteksi menyala di posisi
          fisiknya yang benar.
        </p>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
          <li>
            <strong>Bisa dibuktikan:</strong> hasil pemetaan ulang. Kalau
            tombol Caps sudah dipetakan jadi Esc, menekannya di sini akan
            menyalakan keycap Esc — itu bukti pemetaan benar-benar masuk.
          </li>
          <li>
            <strong>Tidak bisa dibuktikan:</strong> kombinasi Fn. Fn+1 dan
            kawan-kawannya diselesaikan di dalam firmware keyboard, jadi yang
            sampai ke sistem operasi cuma hasilnya (mis. F1) — tombol Fn
            sendiri tidak pernah muncul sebagai event.
          </li>
          <li>
            Tombol yang menyala berarti <em>sesuatu</em> sampai ke sistem
            operasi. Tombol yang tetap gelap setelah ditekan berarti sinyalnya
            tidak sampai — bisa dari sakelar, kabel, firmware, atau pemetaan
            yang salah; tester ini tidak bisa membedakan penyebabnya.
          </li>
          <li>
            Kalau dua tombol fisik kebetulan dipetakan ke usage yang sama,
            sistem operasi tidak bisa membedakan keduanya — tester menyalakan
            KEDUANYA dan bilang begitu di "Event terakhir", bukan menebak
            salah satu.
          </li>
          <li>
            Selama tab ini terbuka, penekanan tombol ditahan agar tidak
            mengetik ke halaman atau memicu pintasan browser. Pakai tetikus
            untuk berpindah tab.
          </li>
        </ul>
      </div>
    </div>
  );
}
