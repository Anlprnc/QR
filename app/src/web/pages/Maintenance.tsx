import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Shell from '../components/Shell';
import { api, dueInfo, timeAgo, type MachineSummary } from '../lib/api';

type Task = { id: string; title: string; intervalDays: number; lastDoneAt: number | null; dueAt: number; machineId: string; machine: string };
const TONE = { late: 'border-kirmizi text-kirmizi', soon: 'border-amber text-amber-700', ok: 'border-dokum text-gri' };

export default function Maintenance() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [machines, setMachines] = useState<MachineSummary[]>([]);
  const [machineId, setMachineId] = useState('');
  const [title, setTitle] = useState('');
  const [days, setDays] = useState(30);

  const load = useCallback(() => {
    api<Task[]>('/maintenance').then(setTasks);
    api<MachineSummary[]>('/machines').then((ms) => { setMachines(ms); setMachineId((id) => id || ms[0]?.id || ''); });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    await api('/maintenance', { method: 'POST', body: { machineId, title, intervalDays: days } });
    setTitle('');
    load();
  }
  async function done(t: Task) {
    await api(`/maintenance/${t.id}/done`, { method: 'POST', body: { doneBy: localStorage.getItem('ad') || undefined } });
    load();
  }

  const late = tasks?.filter((t) => t.dueAt < Date.now()).length ?? 0;

  return (
    <Shell>
      <h1 className="plaka text-3xl">Planlı bakım</h1>
      <p className="mt-2 text-gri" aria-live="polite">
        {tasks === null ? 'Yükleniyor…' : tasks.length === 0 ? 'Periyodik bakım görevlerini ekleyin; vadesi gelince burada ve menüde görünür.'
          : late ? `${late} bakım gecikti.` : 'Geciken bakım yok.'}
      </p>

      {machines.length > 0 ? (
        <form onSubmit={add} className="mt-6 flex max-w-3xl flex-wrap gap-3">
          <select required value={machineId} onChange={(e) => setMachineId(e.target.value)} aria-label="Makine" className="alan !w-auto">
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input required minLength={2} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bakım görevi (Yağ kontrolü)" aria-label="Bakım görevi" className="alan min-w-48 flex-1" />
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Periyot" className="alan !w-auto">
            {[[1, 'Her gün'], [7, 'Haftalık'], [30, 'Aylık'], [90, '3 aylık'], [180, '6 aylık'], [365, 'Yıllık']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="btn">Görev ekle</button>
        </form>
      ) : tasks && <p className="mt-6">Önce <Link to="/makineler" className="underline">bir makine ekleyin</Link>.</p>}

      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {tasks?.map((t) => {
          const d = dueInfo(t.dueAt);
          return (
            <li key={t.id} className={`kart flex flex-wrap items-center justify-between gap-3 border-l-8 p-4 ${TONE[d.tone].split(' ')[0]}`}>
              <div>
                <p className="font-semibold">{t.title}</p>
                <Link to={`/makineler/${t.machineId}`} className="text-sm underline underline-offset-4">{t.machine}</Link>
                <p className="text-xs text-gri">Her {t.intervalDays} günde · {t.lastDoneAt ? `son: ${timeAgo(t.lastDoneAt)}` : 'henüz yapılmadı'}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`seri font-bold ${TONE[d.tone].split(' ')[1]}`}>{d.text}</span>
                <button onClick={() => done(t)} className="btn-ghost text-sm">Yapıldı</button>
              </div>
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}
