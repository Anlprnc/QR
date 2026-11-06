import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Shell from '../components/Shell';
import Label from '../components/Label';
import { Lamp, StateBadge } from '../components/ui';
import { api, timeAgo, type MachineSummary } from '../lib/api';

export default function Machines() {
  const [machines, setMachines] = useState<MachineSummary[] | null>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [showLabels, setShowLabels] = useState(false);

  const load = () => api<MachineSummary[]>('/machines').then(setMachines);
  useEffect(() => { load(); }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/machines', { method: 'POST', body: { name, location: location || undefined } });
      setName(''); setLocation('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  const printAll = () => { setShowLabels(true); setTimeout(() => window.print(), 100); };
  const bad = machines?.filter((m) => m.state !== 'ok').length ?? 0;

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="plaka text-3xl">Makineler</h1>
          <p className="mt-2 text-gri">
            {machines && machines.length > 0
              ? `${machines.length} makine · ${machines.length - bad} çalışıyor${bad ? `, ${bad} arızalı` : ''}.`
              : 'Her makine için bir QR etiketi yazdırın ve görünür bir yere yapıştırın.'}
          </p>
        </div>
        {machines && machines.length > 0 && (
          <div className="flex gap-3">
            <button onClick={() => setShowLabels(!showLabels)} className="btn-ghost" aria-pressed={showLabels}>{showLabels ? 'Etiketleri gizle' : 'Etiketleri göster'}</button>
            <button onClick={printAll} className="btn">Tüm etiketleri yazdır</button>
          </div>
        )}
      </div>

      <form onSubmit={add} className="mt-6 flex max-w-2xl flex-wrap gap-3 print:hidden">
        <label className="min-w-48 grow">
          <span className="sr-only">Makine adı</span>
          <input required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Örn. Hidrolik Pres 2" className="alan" />
        </label>
        <label className="min-w-40 grow-0 basis-48">
          <span className="sr-only">Bölüm veya konum</span>
          <input maxLength={80} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Bölüm (isteğe bağlı)" className="alan" />
        </label>
        <button disabled={busy} className="btn">Makine ekle</button>
      </form>

      {machines?.length === 0 && <p className="mt-8 text-gri print:hidden">Henüz makine yok. İlk makinenizin adını yazıp ekleyin.</p>}

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:hidden">
        {machines?.map((m) => (
          <li key={m.id} className={`kart p-4 ${m.state === 'stopped' ? 'kart-durdu pt-5' : ''}`}>
            <Link to={`/makineler/${m.id}`} className="block">
              <div className="flex items-start justify-between gap-2">
                <p className="plaka text-lg underline-offset-4 hover:underline">{m.name}</p>
                <Lamp state={m.state} size={18} />
              </div>
              {m.location && <p className="text-sm text-gri">{m.location}</p>}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <StateBadge state={m.state} />
                <span className="text-sm text-gri">
                  {m.openCount ? `${m.openCount} açık arıza` : m.lastTicketAt ? `Son arıza ${timeAgo(m.lastTicketAt)}` : 'Hiç arıza yok'}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <ul className={`yazdir mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-3 ${showLabels ? '' : 'hidden print:hidden'}`}>
        {machines?.map((m) => <Label key={m.id} name={m.name} token={m.qrToken} />)}
      </ul>
    </Shell>
  );
}
