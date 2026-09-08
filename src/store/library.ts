import { defaultProfile, loadProfile, parseProfile } from './profile';
import type { Profile } from './profile';

export const LIBRARY_KEY = 'gt65.profile-library.v1';
export type ProfileItem = { id: string; profile: Profile };
export type ProfileLibrary = { version: 1; activeId: string; items: ProfileItem[] };
export function newProfileItem(profile = defaultProfile()): ProfileItem {
  return { id: crypto.randomUUID(), profile };
}
export function parseLibrary(raw: unknown): ProfileLibrary {
  const v = raw as Partial<ProfileLibrary> | null;
  if (!v || v.version !== 1 || !Array.isArray(v.items) || !v.items.length || v.items.length > 100) throw new Error('Pustaka profil tidak valid.');
  const ids = new Set<string>();
  const items = v.items.map((item) => {
    if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw new Error('ID profil tidak valid.');
    ids.add(item.id);
    return { id: item.id, profile: parseProfile(item.profile) };
  });
  if (typeof v.activeId !== 'string' || !ids.has(v.activeId)) throw new Error('Profil aktif tidak ditemukan.');
  return { version: 1, activeId: v.activeId, items };
}
export function loadLibrary(): { library: ProfileLibrary; error: string | null } {
  let error: string | null = null;
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (raw) return { library: parseLibrary(JSON.parse(raw)), error: null };
  } catch { error = 'Pustaka profil tidak dapat dibaca. Data asli tetap disimpan; ekspor profil aktif sebelum memperbaiki penyimpanan.'; }
  const item = newProfileItem(loadProfile());
  return { library: { version: 1, activeId: item.id, items: [item] }, error };
}
