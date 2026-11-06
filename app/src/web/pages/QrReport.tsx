import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

type State = 'loading' | 'ready' | 'notfound' | 'sending' | 'done' | 'error' | 'limited';

const QUICK = ['Çalışmıyor', 'Ses yapıyor', 'Yağ kaçırıyor', 'Isınıyor', 'Hata kodu veriyor', 'Ürün kalitesi bozuk'];

export default function QrReport() {
  const { token } = useParams();
  const [state, setState] = useState<State>('loading');
  const [machine, setMachine] = useState('');
  const [openCount, setOpenCount] = useState(0);
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [stopped, setStopped] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(`/api/q/${token}`)
      .then(async (r) => {
        if (!r.ok) return setState('notfound');
        const j = (await r.json()) as { machine: string; openCount: number };
        setMachine(j.machine);
        setOpenCount(j.openCount);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, [token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState('sending');
    try {
      const r = await fetch(`/api/q/${token}/tickets`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ description, reporterName: name || undefined, machineStopped: stopped === true }),
      });
      setState(r.ok ? 'done' : r.status === 429 ? 'limited' : 'error');
    } catch {
      setState('error');
    }
  }

  const lamp = (on: 'kirmizi' | 'amber' | 'yesil') => (
    <div className="flex w-12 flex-col gap-1.5 rounded-md bg-dokum p-1.5" aria-hidden="true">
      {(['kirmizi', 'amber', 'yesil'] as const).map((k) => (
        <div key={k} className="aspect-square rounded-full"
          style={{ background: `var(--color-${k})`, opacity: k === on ? 1 : 0.16, boxShadow: k === on ? `0 0 16px 3px var(--color-${k})` : 'none' }} />
      ))}
    </div>
  );

  if (state === 'loading') return <p className="p-6 text-gri">Yükleniyor…</p>;
  if (state === 'notfound')
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="plaka text-2xl">Bu QR kod geçerli değil</h1>
        <p className="mt-2 text-gri">Etiket değişmiş olabilir. Bakım ekibinize haber verin.</p>
      </main>
    );
  if (state === 'done')
    return (
      <main className="mx-auto flex max-w-md items-center gap-5 p-6">
        {lamp('kirmizi')}
        <div>
          <h1 className="plaka text-2xl">Bildirim alındı</h1>
          <p className="mt-2 text-gri">{machine} için arıza kaydı bakım ekibine iletildi.</p>
          <button onClick={() => { setDescription(''); setStopped(null); setState('ready'); setOpenCount((n) => n + 1); }}
            className="mt-4 text-sm underline underline-offset-4">Başka bir arıza bildir</button>
        </div>
      </main>
    );

  return (
    <main className="mx-auto max-w-md p-5">
      <div className="flex items-center gap-4">
        {lamp('yesil')}
        <div>
          <p className="text-sm text-gri">Arıza bildir</p>
          <h1 className="plaka text-3xl">{machine}</h1>
        </div>
      </div>
      <form onSubmit={submit} className="mt-6 space-y-4 border-2 border-dokum bg-sac p-5">
        {openCount > 0 && (
          <p role="status" className="border-l-4 border-amber bg-boya px-3 py-2 text-sm">
            Bu makine için zaten <b>{openCount} açık arıza</b> var. Aynı sorunsa tekrar bildirmenize gerek yok; farklıysa devam edin.
          </p>
        )}
        <label className="block">
          <span className="font-semibold">Sorun nedir?</span>
          <textarea required minLength={3} maxLength={1000} rows={4} value={description}
            onChange={(e) => setDescription(e.target.value)} className="alan mt-1" />
          <span className="mt-2 flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => setDescription((d) => (d ? `${d.replace(/[.\s]+$/, '')}. ${q}` : q))}
                className="border-2 border-dokum bg-boya px-2 py-1 text-sm font-semibold hover:bg-dokum hover:text-sac">{q}</button>
            ))}
          </span>
        </label>
        <fieldset>
          <legend className="font-semibold">Makine durdu mu?</legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {([[true, 'Evet, durdu'], [false, 'Hayır, çalışıyor']] as const).map(([v, label]) => (
              <button key={String(v)} type="button" onClick={() => setStopped(v)} aria-pressed={stopped === v}
                className={`border-2 border-dokum px-3 py-3 font-semibold ${stopped === v ? (v ? 'bg-kirmizi text-white' : 'bg-dokum text-sac') : 'bg-sac'}`}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="font-semibold">Adınız (isteğe bağlı)</span>
          <input maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className="alan mt-1" />
        </label>
        {stopped === null && <p className="text-sm text-gri">Makinenin durup durmadığını seçin.</p>}
        {state === 'limited' && <p role="alert" className="font-medium text-kirmizi">Kısa sürede çok fazla bildirim gönderildi. Biraz bekleyip tekrar deneyin.</p>}
        {state === 'error' && <p role="alert" className="font-medium text-kirmizi">Gönderilemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.</p>}
        <button disabled={state === 'sending' || stopped === null} className="btn w-full">
          {state === 'sending' ? 'Gönderiliyor…' : 'Arızayı bildir'}
        </button>
      </form>
    </main>
  );
}
