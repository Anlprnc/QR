import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

type State = 'loading' | 'ready' | 'notfound' | 'sending' | 'done' | 'error';

export default function QrReport() {
  const { token } = useParams();
  const [state, setState] = useState<State>('loading');
  const [machine, setMachine] = useState('');
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    fetch(`/api/q/${token}`)
      .then(async (r) => {
        if (!r.ok) return setState('notfound');
        setMachine(((await r.json()) as { machine: string }).machine);
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
        body: JSON.stringify({ description, reporterName: name || undefined }),
      });
      setState(r.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  }

  if (state === 'loading') return <p className="p-6">Yükleniyor…</p>;
  if (state === 'notfound') return <p className="p-6">Bu QR kod geçerli değil.</p>;
  if (state === 'done')
    return (
      <main className="p-6 text-center">
        <h1 className="text-2xl font-bold">Bildirim alındı</h1>
        <p className="mt-2 text-neutral-400">{machine} için arıza kaydı bakım ekibine iletildi.</p>
      </main>
    );

  return (
    <main className="mx-auto max-w-md p-6">
      <p className="text-sm text-neutral-400">Arıza bildir</p>
      <h1 className="text-2xl font-bold">{machine}</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm">Sorun nedir?</span>
          <textarea required minLength={3} maxLength={1000} rows={4} value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 p-3" />
        </label>
        <label className="block">
          <span className="text-sm">Adınız (isteğe bağlı)</span>
          <input maxLength={80} value={name} onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 p-3" />
        </label>
        {state === 'error' && <p className="text-red-400">Gönderilemedi, tekrar deneyin.</p>}
        <button disabled={state === 'sending'}
          className="w-full rounded-lg bg-white py-3 font-semibold text-neutral-950 disabled:opacity-50">
          {state === 'sending' ? 'Gönderiliyor…' : 'Arızayı bildir'}
        </button>
      </form>
    </main>
  );
}
