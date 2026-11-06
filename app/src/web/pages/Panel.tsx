import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Shell, { useMe } from '../components/Shell';
import { api, clock, formatDuration, timeAgo } from '../lib/api';

type Status = 'open' | 'in_progress' | 'resolved';
type Ticket = {
  id: string; description: string; status: Status; reporterName: string | null;
  createdAt: number; machineStopped: number; resolvedAt: number | null; machine: string; machineId: string;
  assignee: string | null; resolution: string | null;
};
type TicketEvent = { type: string; note: string | null; createdAt: number };

const COLUMNS: Array<{ s: Status; title: string; lamp: string; empty: string; action?: [Status, string] }> = [
  { s: 'open', title: 'Arızalı', lamp: 'bg-kirmizi', empty: 'Açık arıza yok.', action: ['in_progress', 'Üstlen'] },
  { s: 'in_progress', title: 'Müdahale ediliyor', lamp: 'bg-amber', empty: 'Şu an işlemde olan iş yok.', action: ['resolved', 'Çözüldü yap'] },
  { s: 'resolved', title: 'Çözüldü', lamp: 'bg-yesil', empty: 'Henüz çözülen arıza yok.', action: ['open', 'Yeniden aç'] },
];
const EVENT_LABEL: Record<string, string> = {
  created: 'Bildirildi', in_progress: 'Üstlenildi', resolved: 'Çözüldü', open: 'Yeniden açıldı', note: 'Not',
};

function beep() {
  try {
    const ctx = new AudioContext();
    [880, 660].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.22);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.22 + 0.2);
      o.start(ctx.currentTime + i * 0.22); o.stop(ctx.currentTime + i * 0.22 + 0.2);
    });
  } catch { /* ses desteklenmiyor */ }
}

function History({ id }: { id: string }) {
  const [events, setEvents] = useState<TicketEvent[] | null>(null);
  const [note, setNote] = useState('');
  const load = useCallback(() => api<TicketEvent[]>(`/tickets/${id}/events`).then(setEvents).catch(() => setEvents([])), [id]);
  useEffect(() => { load(); }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    await api(`/tickets/${id}/notes`, { method: 'POST', body: { note } });
    setNote('');
    load();
  }

  if (!events) return <p className="mt-2 text-sm text-gri">Yükleniyor…</p>;
  return (
    <div className="mt-3">
      <ol className="space-y-1.5 border-l-2 border-dokum pl-3 text-sm">
        {events.map((e, i) => (
          <li key={i}>
            <span className="font-semibold">{EVENT_LABEL[e.type] ?? e.type}</span>{' '}
            <span className="text-gri">{clock(e.createdAt)}</span>
            {e.note && <p className="mt-0.5 bg-boya px-2 py-1">{e.note}</p>}
          </li>
        ))}
      </ol>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Not ekle (parça bekleniyor…)"
          aria-label="Not ekle" className="alan !py-1.5 text-sm" />
        <button className="btn-ghost shrink-0 text-sm">Ekle</button>
      </form>
    </div>
  );
}

function TicketCard({ t, col, onChange }: { t: Ticket; col: (typeof COLUMNS)[number]; onChange: () => void }) {
  const { email } = useMe();
  const [history, setHistory] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolution, setResolution] = useState('');
  const [busy, setBusy] = useState(false);
  const stoppedNow = t.machineStopped === 1 && t.status !== 'resolved';

  async function patch(body: object) {
    setBusy(true);
    try { await api(`/tickets/${t.id}`, { method: 'PATCH', body }); onChange(); } finally { setBusy(false); }
  }
  const me = localStorage.getItem('ad') || email.split('@')[0];

  function act() {
    const next = col.action![0];
    if (next === 'resolved') return setResolving(true);
    patch(next === 'in_progress' ? { status: next, assignee: me } : { status: next });
  }

  return (
    <li className={`kart p-4 ${stoppedNow ? 'kart-durdu pt-5' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <Link to={`/makineler/${t.machineId}`} className="plaka text-lg underline-offset-4 hover:underline">{t.machine}</Link>
        {stoppedNow && <span className="shrink-0 rounded-sm bg-kirmizi px-2 py-0.5 text-xs font-bold text-white">Makine durdu</span>}
      </div>
      <p className="mt-1 whitespace-pre-line">{t.description}</p>
      <p className="mt-2 text-sm text-gri">
        {t.reporterName ? `${t.reporterName} · ` : ''}{timeAgo(t.createdAt)}
        {t.resolvedAt ? ` · ${formatDuration(t.resolvedAt - t.createdAt)} sürdü` : ''}
      </p>
      {t.assignee && <p className="mt-1 text-sm"><span className="etiket-rozet">Üstlenen</span> <span className="font-semibold">{t.assignee}</span></p>}
      {t.resolution && <p className="mt-2 border-l-4 border-yesil bg-boya px-2 py-1 text-sm"><b>Çözüm:</b> {t.resolution}</p>}

      {resolving ? (
        <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); patch({ status: 'resolved', resolution }); }}>
          <label className="block text-sm font-semibold">Ne yapıldı? (isteğe bağlı)
            <input autoFocus value={resolution} onChange={(e) => setResolution(e.target.value)} maxLength={500}
              placeholder="Conta değiştirildi" className="alan mt-1 !py-1.5 font-normal" />
          </label>
          <div className="flex gap-3">
            <button disabled={busy} className="btn text-sm !py-1.5">Çözüldü olarak kapat</button>
            <button type="button" onClick={() => setResolving(false)} className="text-sm underline underline-offset-4">Vazgeç</button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {col.action && <button disabled={busy} onClick={act} className="btn-ghost text-sm">{col.action[1]}</button>}
          <button onClick={() => setHistory(!history)} aria-expanded={history} className="text-sm underline underline-offset-4">Geçmiş ve notlar</button>
        </div>
      )}
      {history && <History id={t.id} />}
    </li>
  );
}

export default function Panel() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState(false);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [sound, setSound] = useState(() => localStorage.getItem('ses') === '1');
  const prevOpen = useRef<number | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const machineFilter = params.get('makine');

  const load = useCallback(() => {
    api<Ticket[]>('/tickets').then((t) => {
      const open = t.filter((x) => x.status === 'open').length;
      if (soundRef.current && prevOpen.current !== null && open > prevOpen.current) beep();
      prevOpen.current = open;
      setTickets(t); setError(false);
    }).catch(() => setError(true));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  function toggleSound() {
    const next = !sound;
    setSound(next);
    localStorage.setItem('ses', next ? '1' : '0');
    if (next) beep();
  }

  const needle = q.trim().toLocaleLowerCase('tr');
  const shown = (tickets ?? []).filter((t) =>
    (!machineFilter || t.machineId === machineFilter) &&
    (!needle || `${t.machine} ${t.description} ${t.assignee ?? ''} ${t.reporterName ?? ''}`.toLocaleLowerCase('tr').includes(needle)));
  const open = tickets?.filter((t) => t.status === 'open').length ?? 0;
  const stopped = tickets?.filter((t) => t.status !== 'resolved' && t.machineStopped).length ?? 0;
  const filterName = machineFilter ? tickets?.find((t) => t.machineId === machineFilter)?.machine : null;

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="plaka text-3xl">Arıza panosu</h1>
          <p className="mt-2 text-gri" aria-live="polite">
            {tickets === null ? 'Yükleniyor…'
              : open === 0 ? 'Bekleyen arıza yok. Tüm makineler çalışıyor.'
              : `${open} arıza henüz üstlenilmedi${stopped ? `, ${stopped} makine durmuş durumda` : ''}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="block">
            <span className="sr-only">Arızalarda ara</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Makine, arıza veya kişi ara"
              className="alan !w-64 !py-1.5" />
          </label>
          <button onClick={toggleSound} aria-pressed={sound} className={`btn-ghost text-sm ${sound ? '!bg-dokum !text-sac' : ''}`}>
            Sesli uyarı: {sound ? 'açık' : 'kapalı'}
          </button>
        </div>
      </div>
      {filterName && (
        <p className="mt-3 text-sm">Yalnızca <b>{filterName}</b> gösteriliyor.{' '}
          <button className="underline underline-offset-4" onClick={() => setParams({})}>Filtreyi kaldır</button></p>
      )}
      {error && <p role="alert" className="mt-3 font-medium text-kirmizi">Liste yenilenemedi. Bağlantınızı kontrol edin, birazdan tekrar denenecek.</p>}

      {tickets?.length === 0 && (
        <div className="kart mt-8 max-w-xl p-5">
          <p className="plaka text-xl">Henüz arıza bildirilmedi</p>
          <p className="mt-2 text-gri">Makineler sayfasından makinelerinizi ekleyin, QR etiketlerini yazdırıp makinelere yapıştırın. Operatör QR kodu okutunca arıza burada belirir.</p>
          <Link to="/makineler" className="btn mt-4 inline-block">Makine ekle</Link>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = shown.filter((t) => t.status === col.s);
          return (
            <section key={col.s} aria-label={col.title}>
              <h2 className="flex items-center gap-3 border-b-2 border-dokum pb-2 text-lg font-bold">
                <span className={`h-4 w-4 rounded-full ${col.lamp}`} aria-hidden="true" />
                {col.title}
                <span className="seri ml-auto text-gri">{items.length}</span>
              </h2>
              <ul className="mt-4 space-y-4">
                {items.length === 0 && tickets && <li className="text-gri">{col.empty}</li>}
                {items.map((t) => <TicketCard key={t.id} t={t} col={col} onChange={load} />)}
              </ul>
            </section>
          );
        })}
      </div>
    </Shell>
  );
}
