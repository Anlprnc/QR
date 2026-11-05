import { useEffect, useState } from 'react';
import Shell from '../components/Shell';
import { api, formatDuration } from '../lib/api';

type Stats = {
  days: number;
  summary: { total: number; open: number | null; stopped: number | null; avgResolveMs: number | null };
  machines: Array<{ id: string; name: string; tickets: number; stopped: number | null; avgResolveMs: number | null }>;
};

const RANGES = [7, 30, 90];

export default function Reports() {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => { setStats(null); api<Stats>(`/stats?days=${days}`).then(setStats); }, [days]);

  const max = Math.max(1, ...(stats?.machines.map((m) => m.tickets) ?? [1]));
  const tile = (label: string, value: string) => (
    <div className="border-2 border-dokum bg-sac p-4">
      <p className="text-sm text-gri">{label}</p>
      <p className="plaka seri mt-1 text-3xl">{value}</p>
    </div>
  );

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="plaka text-3xl">Raporlar</h1>
          <p className="mt-2 text-gri">Hangi makine sık bozuluyor, arızalar ne kadar sürede kapanıyor?</p>
        </div>
        <div role="group" aria-label="Zaman aralığı" className="flex">
          {RANGES.map((r) => (
            <button key={r} onClick={() => setDays(r)} aria-pressed={days === r}
              className={`border-2 border-dokum px-3 py-1.5 font-semibold -ml-0.5 first:ml-0 ${days === r ? 'bg-dokum text-sac' : 'bg-sac'}`}>
              Son {r} gün
            </button>
          ))}
        </div>
      </div>

      {!stats ? <p className="mt-8 text-gri">Yükleniyor…</p> : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {tile('Bildirilen arıza', String(stats.summary.total))}
            {tile('Makineyi durduran arıza', String(stats.summary.stopped ?? 0))}
            {tile('Ortalama çözüm süresi', formatDuration(stats.summary.avgResolveMs))}
          </div>

          <h2 className="plaka mt-12 text-2xl">Makine bazında arızalar</h2>
          {stats.machines.length === 0 ? (
            <p className="mt-4 text-gri">Henüz makine yok. Makineler sayfasından ilk makinenizi ekleyin.</p>
          ) : stats.summary.total === 0 ? (
            <p className="mt-4 text-gri">Bu dönemde arıza bildirilmedi.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {stats.machines.map((m) => (
                <li key={m.id} className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[12rem_1fr_9rem]">
                  <span className="font-semibold">{m.name}</span>
                  <span className="h-6 border-2 border-dokum bg-sac" role="img" aria-label={`${m.tickets} arıza`}>
                    <span className="block h-full bg-kirmizi" style={{ width: `${(m.tickets / max) * 100}%` }} />
                  </span>
                  <span className="seri text-sm text-gri">
                    {m.tickets} arıza · {formatDuration(m.avgResolveMs)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-8 max-w-xl text-sm text-gri">
            Çözüm süresi, arızanın bildirilmesinden "Çözüldü" yapılmasına kadar geçen süredir. Henüz çözülmemiş arızalar ortalamaya girmez.
          </p>
        </>
      )}
    </Shell>
  );
}
