import { useEffect, useMemo, useState } from 'react';
import { KeyboardGrid, FN_USAGE } from '../KeyboardGrid';
import { KEYS } from '../../gt65/layout';
import { usageForCode } from '../../gt65/keyevents';

/**
 * Tombol yang bisa diuji lewat event DOM: seluruh papan KECUALI Fn.
 * Kombinasi Fn diselesaikan di dalam firmware keyboard dan tidak pernah
 * dikirim sebagai event ke sistem operasi, jadi memasukkan Fn ke penyebut
 * hitungan hanya akan membuat sapuan penuh berhenti di 65/66 dan membuat
 * pengguna menyimpulkan ada tombol rusak. Kalau suatu saat sebuah sistem
 * operasi memang melaporkannya, keycap-nya tetap menyala di papan.
 */
const TESTABLE = KEYS.filter((k) => k.usage !== FN_USAGE);
const LAYOUT_USAGES = new Set(KEYS.map((k) => k.usage));

type LastEvent = { code: string; usage: number | null; repeat: boolean };

function hex(usage: number): string {
  return `0x${usage.toString(16).padStart(2, '0')}`;
}

export function TesterPanel() {
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
   */
  useEffect(() => {
    const down = (ev: KeyboardEvent) => {
      ev.preventDefault();
      const usage = usageForCode(ev.code);
      setLast({ code: ev.code, usage, repeat: ev.repeat });
      if (usage === null) return;
      setHeld((prev) => (prev.has(usage) ? prev : new Set(prev).add(usage)));
      setSeen((prev) => (prev.has(usage) ? prev : new Set(prev).add(usage)));
    };
    const up = (ev: KeyboardEvent) => {
      ev.preventDefault();
      const usage = usageForCode(ev.code);
      if (usage === null) return;
      setHeld((prev) => {
        if (!prev.has(usage)) return prev;
        const next = new Set(prev);
        next.delete(usage);
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
  }, []);

  const seenOnBoard = useMemo(
    () => TESTABLE.filter((k) => seen.has(k.usage)),
    [seen],
  );
  const missing = useMemo(
    () => TESTABLE.filter((k) => !seen.has(k.usage)).map((k) => k.name),
    [seen],
  );

  const done = seenOnBoard.length;
  const total = TESTABLE.length;

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
          {last === null ? (
            <div className="num text-[var(--ink-3)]">menunggu penekanan tombol…</div>
          ) : (
            <div className="num flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span style={{ color: 'var(--ink)' }}>{last.code}</span>
              <span style={{ color: last.usage === null ? 'var(--ink-3)' : 'var(--ink)' }}>
                {last.usage === null ? 'usage —' : `usage ${hex(last.usage)}`}
              </span>
              <span style={{
                color: last.usage !== null && LAYOUT_USAGES.has(last.usage)
                  ? 'var(--ok)' : 'var(--warn)',
              }}>
                {last.usage === null
                  ? 'kode tidak dikenal'
                  : LAYOUT_USAGES.has(last.usage)
                    ? 'ada di papan ini'
                    : 'di luar papan ini'}
              </span>
              {last.repeat && <span style={{ color: 'var(--ink-3)' }}>ulang</span>}
            </div>
          )}
        </div>
      </div>

      <KeyboardGrid heldUsages={held} seenUsages={seen} />

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
          membaca langsung dari papan ini lewat browser.
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
            Selama tab ini terbuka, penekanan tombol ditahan agar tidak
            mengetik ke halaman atau memicu pintasan browser. Pakai tetikus
            untuk berpindah tab.
          </li>
        </ul>
      </div>
    </div>
  );
}
