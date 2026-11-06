import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lamp } from '../components/ui';
import { api, ApiError, formatDuration, type MachineSummary } from '../lib/api';

type Ticket = { id: string; machine: string; description: string; status: string; machineStopped: number; createdAt: number };

// Atölye duvarındaki ekran için: koyu, büyük, kendiliğinden yenilenen durum panosu
export default function Tv() {
  const nav = useNavigate();
  const [machines, setMachines] = useState<MachineSummary[] | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [now, setNow] = useState(Date.now());
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, t] = await Promise.all([api<MachineSummary[]>('/machines'), api<Ticket[]>('/tickets')]);
      setMachines(m); setTickets(t.filter((x) => x.status !== 'resolved')); setOffline(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) nav('/giris', { replace: true });
      else setOffline(true);
    }
  }, [nav]);

  useEffect(() => {
    load();
    const a = setInterval(load, 10000), b = setInterval(() => setNow(Date.now()), 1000);
    document.title = 'ArızaQR · TV';
    return () => { clearInterval(a); clearInterval(b); };
  }, [load]);

  const stopped = machines?.filter((m) => m.state === 'stopped').length ?? 0;
  const faults = machines?.filter((m) => m.state === 'fault').length ?? 0;
  const ok = (machines?.length ?? 0) - stopped - faults;
  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});

  return (
    <div className="tv px-6 py-5">
      <header className="flex flex-wrap items-center gap-x-8 gap-y-2">
        <h1 className="plaka text-3xl">ArızaQR</h1>
        <p className="seri text-lg"><span className="text-yesil">●</span> {ok} çalışıyor</p>
        <p className="seri text-lg"><span className="text-amber">●</span> {faults} arızalı</p>
        <p className="seri text-lg"><span className="text-kirmizi">●</span> {stopped} durdu</p>
        {offline && <p role="alert" className="font-bold text-amber">Bağlantı yok, yeniden deneniyor…</p>}
        <p className="seri plaka ml-auto text-3xl">{new Date(now).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
        <button onClick={fullscreen} className="rounded-sm border border-white/40 px-3 py-1 text-sm">Tam ekran</button>
        <Link to="/panel" className="text-sm underline underline-offset-4">Panele dön</Link>
      </header>

      {machines?.length === 0 && <p className="mt-10 text-xl text-white/70">Henüz makine yok. Panelden makine ekleyin.</p>}

      <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {machines?.map((m) => (
          <li key={m.id} className={`tv-kart flex items-center gap-4 rounded-sm p-5 ${m.state === 'stopped' ? 'tv-durdu' : m.state === 'fault' ? 'tv-ariza' : ''}`}>
            <Lamp state={m.state} size={m.state === 'ok' ? 28 : 40} />
            <div className="min-w-0">
              <p className="plaka truncate text-xl">{m.name}</p>
              <p className="text-sm text-white/70">
                {m.state === 'stopped' ? 'MAKİNE DURDU' : m.state === 'fault' ? `${m.openCount} açık arıza` : m.location ?? 'Çalışıyor'}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {tickets.length > 0 && (
        <section className="mt-8" aria-label="Açık arızalar">
          <h2 className="plaka text-2xl">Açık arızalar</h2>
          <ul className="mt-3 space-y-2">
            {[...tickets].sort((a, b) => b.machineStopped - a.machineStopped || a.createdAt - b.createdAt).slice(0, 8).map((t) => (
              <li key={t.id} className="tv-kart flex flex-wrap items-center gap-x-5 gap-y-1 rounded-sm px-4 py-3 text-lg">
                <span className="plaka">{t.machine}</span>
                <span className="grow text-white/85">{t.description}</span>
                {t.machineStopped === 1 && <span className="rounded-sm bg-kirmizi px-2 text-sm font-bold">DURDU</span>}
                <span className="seri text-white/70">Açık: {formatDuration(now - t.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
