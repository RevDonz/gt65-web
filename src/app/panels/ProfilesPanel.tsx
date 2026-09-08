import { useState } from 'react';
import type { ProfileLibrary } from '../../store/library';

export function ProfilesPanel({ library, onSelect, onCreate, onDuplicate, onDelete }: {
  library: ProfileLibrary; onSelect: (id: string) => void; onCreate: () => void;
  onDuplicate: (id: string) => void; onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);
  return <section className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center gap-3"><span className="pill">{library.items.length} / 100 profil lokal</span><button className="btn btn-primary ml-auto" disabled={library.items.length >= 100} onClick={onCreate}>Buat profil</button></div>
    <p className="text-[12px] text-[var(--ink-3)]">Buat konfigurasi untuk bekerja, bermain, atau aplikasi tertentu. Memilih profil hanya mengubah editor; gunakan tombol Terapkan untuk menulis ke keyboard. Ubah nama profil aktif di bagian atas. Ekspor dan impor menggunakan JSON aplikasi ini.</p>
    <div className="profile-grid">{library.items.map(({ id, profile }) => <article key={id} className="panel profile-card" data-active={library.activeId === id}>
      <span className="label">{library.activeId === id ? 'Profil aktif' : 'Tersimpan lokal'}</span><h2>{profile.name || 'Tanpa nama'}</h2><p>2 layer · RGB · Pengaturan perangkat</p>
      <div className="flex flex-wrap gap-2"><button className="btn btn-primary" disabled={library.activeId === id} onClick={() => onSelect(id)}>Gunakan</button><button className="btn" disabled={library.items.length >= 100} onClick={() => onDuplicate(id)}>Duplikat</button><button className="btn btn-quiet" disabled={library.items.length === 1} onClick={() => setDeleting(id)}>Hapus</button></div>
      {deleting === id && <div className="well p-3 mt-3" role="alert"><p>Hapus profil “{profile.name}” dari komputer ini?</p><div className="flex gap-2 mt-2"><button className="btn" onClick={() => { onDelete(id); setDeleting(null); }}>Ya, hapus</button><button className="btn" onClick={() => setDeleting(null)}>Batal</button></div></div>}
    </article>)}</div>
  </section>;
}
