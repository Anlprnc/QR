import { useCallback, useEffect, useState } from 'react';
import Shell from '../components/Shell';
import { api, timeAgo } from '../lib/api';

type Status = 'open' | 'in_progress' | 'resolved';
type Ticket = { id: string; description: string; status: Status; reporterName: string | null; createdAt: number; machine: string };

const COLUMNS: Array<{ s: Status; title: string; lamp: string; empty: string; action?: [Status, string] }> = [
  { s: 'open', title: 'Arızalı', lamp: 'bg-kirmizi', empty: 'Açık arıza yok.', action: ['in_progress', 'Üstlen'] },
  { s: 'in_progress', title: 'Müdahale ediliyor', lamp: 'bg-amber', empty: 'Şu an işlemde olan iş yok.', action: ['resolved', 'Çözüldü yap'] },
  { s: 'resolved', title: 'Çözüldü', lamp: 'bg-yesil', empty: 'Henüz çözülen arıza yok.', action: ['open', 'Yeniden aç'] },
];

export default function Panel() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    api<Ticket[]>('/tickets').then((t) => { setTickets(t); setError(false); }).catch(() => setError(true));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  async function move(t: Ticket, status: Status) {
    await api(`/tickets/${t.id}`, { method: 'PATCH', body: { status } });
    load();
  }

  const open = tickets?.filter((t) => t.status === 'open').length ?? 0;

  return (
    <Shell>
      <h1 className="plaka text-3xl">Arıza panosu</h1>
      <p className="mt-2 text-gri" aria-live="polite">
        {tickets === null ? 'Yükleniyor…' : open === 0 ? 'Bekleyen arıza yok. Tüm makineler çalışıyor.' : `${open} makine arıza bildirdi, henüz kimse üstlenmedi.`}
      </p>
      {error && <p role="alert" className="mt-3 font-medium text-kirmizi">Liste yenilenemedi. Bağlantınızı kontrol edin, birazdan tekrar denenecek.</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = (tickets ?? []).filter((t) => t.status === col.s);
          return (
            <section key={col.s} aria-label={col.title}>
              <h2 className="flex items-center gap-3 border-b-2 border-dokum pb-2 text-lg font-bold">
                <span className={`h-4 w-4 rounded-full ${col.lamp}`} aria-hidden="true" />
                {col.title}
                <span className="seri ml-auto text-gri">{items.length}</span>
              </h2>
              <ul className="mt-4 space-y-3">
                {items.length === 0 && tickets && <li className="text-gri">{col.empty}</li>}
                {items.map((t) => (
                  <li key={t.id} className="border-2 border-dokum bg-sac p-4">
                    <p className="plaka text-lg">{t.machine}</p>
                    <p className="mt-1">{t.description}</p>
                    <p className="mt-2 text-sm text-gri">
                      {t.reporterName ? `${t.reporterName} · ` : ''}{timeAgo(t.createdAt)}
                    </p>
                    {col.action && (
                      <button onClick={() => move(t, col.action![0])} className="btn-ghost mt-3 text-sm">{col.action[1]}</button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Shell>
  );
}
