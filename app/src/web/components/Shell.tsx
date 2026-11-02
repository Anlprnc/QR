import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

type Me = { email: string; org: string };

export default function Shell({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    api<Me>('/me').then(setMe).catch((e) => {
      if (e instanceof ApiError && e.status === 401) nav('/giris', { replace: true });
    });
  }, [nav]);

  async function logout() {
    await api('/auth/logout', { method: 'POST', body: {} });
    nav('/giris');
  }

  if (!me) return <p className="p-6 text-gri">Yükleniyor…</p>;
  const link = ({ isActive }: { isActive: boolean }) =>
    `font-semibold underline-offset-4 decoration-2 ${isActive ? 'underline' : 'text-gri hover:underline'}`;

  return (
    <>
      <header className="border-b-2 border-dokum bg-sac print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
          <Link to="/panel" className="plaka text-xl">ArızaQR</Link>
          <nav className="flex gap-5">
            <NavLink to="/panel" className={link}>Panel</NavLink>
            <NavLink to="/makineler" className={link}>Makineler</NavLink>
          </nav>
          <p className="ml-auto text-sm text-gri">{me.org} · {me.email}</p>
          <button onClick={logout} className="btn-ghost text-sm">Çıkış yap</button>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-8">{children}</div>
    </>
  );
}
