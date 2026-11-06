import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Shell from '../components/Shell';
import Label, { qrUrl } from '../components/Label';
import { StateBadge, Tile } from '../components/ui';
import { api, clock, dueInfo, formatDuration, timeAgo, type MachineSummary } from '../lib/api';

type Detail = MachineSummary & {
  stats: { total: number; stopped: number | null; avgResolveMs: number | null; downtimeMs: number | null };
  tickets: Array<{
    id: string; description: string; status: 'open' | 'in_progress' | 'resolved'; assignee: string | null;
    resolution: string | null; machineStopped: number; createdAt: number; resolvedAt: number | null; reporterName: string | null;
  }>;
};
type Task = { id: string; title: string; intervalDays: number; lastDoneAt: number | null; dueAt: number; machineId: string };

const STATUS = { open: 'Açık', in_progress: 'İşlemde', resolved: 'Çözüldü' };
const TONE = { late: 'text-kirmizi', soon: 'text-amber-700', ok: 'text-gri' };

export default function MachineDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [m, setM] = useState<Detail | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [title, setTitle] = useState('');
  const [days, setDays] = useState(30);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setM(await api<Detail>(`/machines/${id}`));
      setTasks((await api<Task[]>('/maintenance')).filter((t) => t.machineId === id));
    } catch { setMissing(true); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    await api(`/machines/${id}`, { method: 'PATCH', body: { name, location } });
    setEditing(false);
    load();
  }
  async function archive() {
    if (!confirm(`${m!.name} arşivlensin mi? QR kodu geçersiz olur, geçmiş arızalar ve raporlar korunur.`)) return;
    await api(`/machines/${id}`, { method: 'DELETE' });
    nav('/makineler');
  }
  async function addTask(e: FormEvent) {
    e.preventDefault();
    await api('/maintenance', { method: 'POST', body: { machineId: id, title, intervalDays: days } });
    setTitle('');
    load();
  }
  async function done(t: Task) {
    await api(`/maintenance/${t.id}/done`, { method: 'POST', body: { doneBy: localStorage.getItem('ad') || undefined } });
    load();
  }
  async function removeTask(t: Task) {
    if (!confirm(`"${t.title}" bakım görevi silinsin mi?`)) return;
    await api(`/maintenance/${t.id}`, { method: 'DELETE' });
    load();
  }
  async function copy() {
    await navigator.clipboard.writeText(qrUrl(m!.qrToken)).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  if (missing) return <Shell><p>Makine bulunamadı. <Link to="/makineler" className="underline">Makinelere dön</Link></p></Shell>;
  if (!m) return <Shell><p className="text-gri">Yükleniyor…</p></Shell>;

  return (
    <Shell>
      <p className="text-sm print:hidden"><Link to="/makineler" className="underline underline-offset-4">← Makineler</Link></p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3 print:hidden">
        {editing ? (
          <form onSubmit={save} className="flex flex-wrap gap-3">
            <input required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} aria-label="Makine adı" className="alan !w-64" />
            <input maxLength={80} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Bölüm" aria-label="Bölüm" className="alan !w-48" />
            <button className="btn">Kaydet</button>
            <button type="button" onClick={() => setEditing(false)} className="underline underline-offset-4">Vazgeç</button>
          </form>
        ) : (
          <div>
            <h1 className="plaka text-3xl">{m.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-3 text-gri">
              <StateBadge state={m.state} />{m.location && <span>· {m.location}</span>}
              <button onClick={() => { setName(m.name); setLocation(m.location ?? ''); setEditing(true); }} className="text-sm underline underline-offset-4">Düzenle</button>
            </p>
          </div>
        )}
        {m.openCount > 0 && <Link to={`/panel?makine=${m.id}`} className="btn">{m.openCount} açık arızayı panoda gör</Link>}
      </div>

      <h2 className="plaka mt-8 text-xl print:hidden">Son 90 gün</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        <Tile label="Bildirilen arıza" value={String(m.stats.total)} />
        <Tile label="Makineyi durduran" value={String(m.stats.stopped ?? 0)} />
        <Tile label="Toplam duruş süresi" value={m.stats.downtimeMs ? formatDuration(m.stats.downtimeMs) : '–'} />
        <Tile label="Ortalama çözüm süresi" value={formatDuration(m.stats.avgResolveMs)} />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="print:hidden">
          <h2 className="plaka text-xl">Planlı bakım</h2>
          <ul className="mt-3 space-y-3">
            {tasks.length === 0 && <li className="text-gri">Bu makine için periyodik bakım tanımlı değil. Örn. “Yağ kontrolü”, her 30 günde.</li>}
            {tasks.map((t) => {
              const d = dueInfo(t.dueAt);
              return (
                <li key={t.id} className="kart flex flex-wrap items-center justify-between gap-3 p-3">
                  <div>
                    <p className="font-semibold">{t.title}</p>
                    <p className="text-sm text-gri">Her {t.intervalDays} günde · {t.lastDoneAt ? `son: ${timeAgo(t.lastDoneAt)}` : 'henüz yapılmadı'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`seri text-sm font-bold ${TONE[d.tone]}`}>{d.text}</span>
                    <button onClick={() => done(t)} className="btn-ghost text-sm">Yapıldı</button>
                    <button onClick={() => removeTask(t)} className="text-sm underline underline-offset-4" aria-label={`${t.title} görevini sil`}>Sil</button>
                  </div>
                </li>
              );
            })}
          </ul>
          <form onSubmit={addTask} className="mt-4 flex flex-wrap gap-3">
            <input required minLength={2} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bakım görevi (Yağ kontrolü)" aria-label="Bakım görevi" className="alan min-w-48 flex-1" />
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Periyot" className="alan !w-auto">
              {[[1, 'Her gün'], [7, 'Haftalık'], [30, 'Aylık'], [90, '3 aylık'], [180, '6 aylık'], [365, 'Yıllık']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button className="btn">Ekle</button>
          </form>

          <h2 className="plaka mt-10 text-xl">Arıza geçmişi</h2>
          <ul className="mt-3 space-y-3">
            {m.tickets.length === 0 && <li className="text-gri">Bu makine için henüz arıza bildirilmedi.</li>}
            {m.tickets.map((t) => (
              <li key={t.id} className="kart p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{t.description}</p>
                  <span className="etiket-rozet">{STATUS[t.status]}</span>
                </div>
                <p className="mt-1 text-sm text-gri">
                  {clock(t.createdAt)}{t.reporterName ? ` · ${t.reporterName}` : ''}{t.machineStopped ? ' · makine durdu' : ''}
                  {t.resolvedAt ? ` · ${formatDuration(t.resolvedAt - t.createdAt)} sürdü` : ''}{t.assignee ? ` · ${t.assignee}` : ''}
                </p>
                {t.resolution && <p className="mt-1 text-sm"><b>Çözüm:</b> {t.resolution}</p>}
              </li>
            ))}
          </ul>
        </div>

        <aside className="yazdir">
          <h2 className="plaka mb-3 text-xl print:hidden">QR etiketi</h2>
          <ul><Label name={m.name} token={m.qrToken} big /></ul>
          <div className="mt-3 flex flex-wrap gap-3 print:hidden">
            <button onClick={() => window.print()} className="btn">Yazdır</button>
            <button onClick={copy} className="btn-ghost">{copied ? 'Kopyalandı' : 'Bağlantıyı kopyala'}</button>
          </div>
          <button onClick={archive} className="btn-tehlike mt-10 text-sm print:hidden">Makineyi arşivle</button>
        </aside>
      </div>
    </Shell>
  );
}
