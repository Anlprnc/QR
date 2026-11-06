import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

type Me = { email: string; org: string };
const MeContext = createContext<Me & { reload: () => void }>({ email: '', org: '', reload: () => {} });
export const useMe = () => useContext(MeContext);

type Badges = { faults: number; late: number };

export default function Shell({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [badges, setBadges] = useState<Badges>({ faults: 0, late: 0 });
  const [menu, setMenu] = useState(false);
  const nav = useNavigate();

  const loadMe = () => api<Me>('/me').then(setMe).catch((e) => {
    if (e instanceof ApiError && e.status === 401) nav('/giris', { replace: true });
  });
  useEffect(() => { loadMe(); }, [nav]);

  // Menüdeki rozetler ve sekme başlığı: açık arıza ve geciken bakım sayısı
  useEffect(() => {
    if (!me) return;
    const load = async () => {
      try {
        const [ms, ks] = await Promise.all([
          api<Array<{ openCount: number }>>('/machines'),
          api<Array<{ dueAt: number }>>('/maintenance'),
        ]);
        setBadges({ faults: ms.reduce((n, m) => n + m.openCount, 0), late: ks.filter((k) => k.dueAt < Date.now()).length });
      } catch { /* sessizce geç, sayfa kendi hatasını gösterir */ }
    };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [me]);

  useEffect(() => {
    document.title = badges.faults ? `(${badges.faults}) ArızaQR` : 'ArızaQR';
  }, [badges.faults]);

  async function logout() {
    await api('/auth/logout', { method: 'POST', body: {} });
    nav('/giris');
  }

  if (!me) return <p className="p-6 text-gri">Yükleniyor…</p>;
  const link = ({ isActive }: { isActive: boolean }) =>
    `nav-link ${isActive ? 'nav-link-aktif' : ''}`;
  const badge = (n: number, tone: string) =>
    n > 0 ? <span className={`seri ml-1.5 rounded-full px-1.5 text-xs font-bold text-white ${tone}`}>{n}</span> : null;

  return (
    <MeContext.Provider value={{ ...me, reload: loadMe }}>
      <header className="sticky top-0 z-10 border-b-2 border-dokum bg-dokum text-sac print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <Link to="/panel" className="plaka flex items-center gap-2 text-xl">
            <span aria-hidden="true" className="flex gap-1">
              <i className="h-2.5 w-2.5 rounded-full bg-kirmizi" /><i className="h-2.5 w-2.5 rounded-full bg-amber" /><i className="h-2.5 w-2.5 rounded-full bg-yesil" />
            </span>
            ArızaQR
          </Link>
          <button className="ml-auto rounded-sm border border-sac/40 px-3 py-1 text-sm font-semibold md:hidden"
            aria-expanded={menu} onClick={() => setMenu(!menu)}>Menü</button>
          <nav className={`${menu ? 'flex' : 'hidden'} w-full flex-col gap-1 md:flex md:w-auto md:flex-row md:gap-1`} onClick={() => setMenu(false)}>
            <NavLink to="/panel" className={link}>Panel{badge(badges.faults, 'bg-kirmizi')}</NavLink>
            <NavLink to="/makineler" className={link}>Makineler</NavLink>
            <NavLink to="/bakim" className={link}>Bakım{badge(badges.late, 'bg-amber !text-dokum')}</NavLink>
            <NavLink to="/raporlar" className={link}>Raporlar</NavLink>
            <NavLink to="/ayarlar" className={link}>Ayarlar</NavLink>
          </nav>
          <div className={`${menu ? 'flex' : 'hidden'} w-full items-center gap-3 md:ml-auto md:flex md:w-auto`}>
            <Link to="/tv" className="rounded-sm border border-sac/40 px-3 py-1 text-sm font-semibold hover:bg-sac hover:text-dokum">TV modu</Link>
            <p className="hidden text-sm text-sac/70 lg:block">{me.org}</p>
            <button onClick={logout} className="text-sm underline underline-offset-4">Çıkış</button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-8">{children}</div>
    </MeContext.Provider>
  );
}
