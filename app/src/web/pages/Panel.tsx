import { useCallback, useEffect, useState } from 'react';
import Shell from '../components/Shell';
import { api, formatDuration, timeAgo } from '../lib/api';

type Status = 'open' | 'in_progress' | 'resolved';
type Ticket = {
  id: string; description: string; status: Status; reporterName: string | null;
  createdAt: number; machineStopped: number; resolvedAt: number | null; machine: string;
};
type TicketEvent = { type: string; createdAt: number };

const COLUMNS: Array<{ s: Status; title: string; lamp: string; empty: string; action?: [Status, string] }> = [
  { s: 'open', title: 'Arızalı', lamp: 'bg-kirmizi', empty: 'Açık arıza yok.', action: ['in_progress', 'Üstlen'] },
  { s: 'in_progress', title: 'Müdahale ediliyor', lamp: 'bg-amber', empty: 'Şu an işlemde olan iş yok.', action: ['resolved', 'Çözüldü yap'] },
  { s: 'resolved', title: 'Çözüldü', lamp: 'bg-yesil', empty: 'Henüz çözülen arıza yok.', action: ['open', 'Yeniden aç'] },
];
const EVENT_LABEL: Record<string, string> = {
  created: 'Bildirildi', in_progress: 'Üstlenildi', resolved: 'Çözüldü', open: 'Yeniden açıldı',
};

function History({ id }: { id: string }) {
  const [events, setEvents] = useState<TicketEvent[] | null>(null);
  useEffect(() => { api<TicketEvent[]>(`/tickets/${id}/events`).then(setEvents).catch(() => setEvents([])); }, [id]);
  if (!events) return <p className="mt-2 text-sm text-gri">Yükleniyor…</p>;
  return (
    <ol className="mt-3 space-y-1 border-l-2 border-dokum pl-3 text-sm">
      {events.map((e, i) => (
        <li key={i}><span className="font-semibold">{EVENT_LABEL[e.type] ?? e.type}</span>{' '}
          <span className="text-gri">{new Date(e.createdAt).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></li>
      ))}
    </ol>
  );
}

export default function Panel() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState(false);
  const [openHistory, setOpenHistory] = useState<string | null>(null);

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
  const stopped = tickets?.filter((t) => t.status !== 'resolved' && t.machineStopped).length ?? 0;

  return (
    <Shell>
      <h1 className="plaka text-3xl">Arıza panosu</h1>
      <p className="mt-2 text-gri" aria-live="polite">
        {tickets === null ? 'Yükleniyor…'
          : open === 0 ? 'Bekleyen arıza yok. Tüm makineler çalışıyor.'
          : `${open} arıza henüz üstlenilmedi${stopped ? `, ${stopped} makine durmuş durumda` : ''}.`}
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
                  <li key={t.id} className={`border-2 bg-sac p-4 ${t.machineStopped && t.status !== 'resolved' ? 'border-kirmizi' : 'border-dokum'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="plaka text-lg">{t.machine}</p>
                      {t.machineStopped === 1 && t.status !== 'resolved' && (
                        <span className="shrink-0 rounded-sm bg-kirmizi px-2 py-0.5 text-xs font-bold text-white">Makine durdu</span>
                      )}
                    </div>
                    <p className="mt-1">{t.description}</p>
                    <p className="mt-2 text-sm text-gri">
                      {t.reporterName ? `${t.reporterName} · ` : ''}{timeAgo(t.createdAt)}
                      {t.resolvedAt ? ` · ${formatDuration(t.resolvedAt - t.createdAt)} sürdü` : ''}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {col.action && <button onClick={() => move(t, col.action![0])} className="btn-ghost text-sm">{col.action[1]}</button>}
                      <button onClick={() => setOpenHistory(openHistory === t.id ? null : t.id)}
                        aria-expanded={openHistory === t.id} className="text-sm underline underline-offset-4">Geçmiş</button>
                    </div>
                    {openHistory === t.id && <History id={t.id} />}
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
