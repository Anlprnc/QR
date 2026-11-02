import { FormEvent, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import Shell from '../components/Shell';
import { api } from '../lib/api';

type Machine = { id: string; name: string; qrToken: string };

function Label({ m }: { m: Machine }) {
  const [svg, setSvg] = useState('');
  const url = `${location.origin}/q/${m.qrToken}`;
  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then(setSvg);
  }, [url]);
  return (
    <li className="etiket border-2 border-dokum bg-sac p-4">
      <p className="plaka text-lg">{m.name}</p>
      <p className="text-sm font-semibold">Arıza mı var? QR kodu okutun.</p>
      <div className="mx-auto mt-2 h-40 w-40" role="img" aria-label={`${m.name} için QR kod`} dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="mt-1 break-all text-xs text-gri print:hidden">{url}</p>
    </li>
  );
}

export default function Machines() {
  const [machines, setMachines] = useState<Machine[] | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api<Machine[]>('/machines').then(setMachines);
  useEffect(() => { load(); }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/machines', { method: 'POST', body: { name } });
      setName('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="plaka text-3xl">Makineler</h1>
          <p className="mt-2 text-gri">Her makine için bir etiket yazdırın ve makinenin görünür bir yerine yapıştırın.</p>
        </div>
        {machines && machines.length > 0 && <button onClick={() => window.print()} className="btn">Etiketleri yazdır</button>}
      </div>

      <form onSubmit={add} className="mt-6 flex max-w-lg gap-3 print:hidden">
        <label className="grow">
          <span className="sr-only">Makine adı</span>
          <input required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Örn. Hidrolik Pres 2" className="alan" />
        </label>
        <button disabled={busy} className="btn">Makine ekle</button>
      </form>

      {machines?.length === 0 && <p className="mt-8 text-gri print:hidden">Henüz makine yok. İlk makinenizin adını yazıp ekleyin.</p>}
      <ul className="yazdir mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-3">
        {machines?.map((m) => <Label key={m.id} m={m} />)}
      </ul>
    </Shell>
  );
}
