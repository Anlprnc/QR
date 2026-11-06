import { useEffect, useState } from 'react';
import Shell from '../components/Shell';
import { Tile, delta } from '../components/ui';
import { api, formatDuration } from '../lib/api';

type Stats = {
  days: number;
  summary: { total: number; open: number | null; stopped: number | null; avgResolveMs: number | null; downtimeMs: number | null };
  prev: { total: number; avgResolveMs: number | null };
  daily: Array<{ day: string; tickets: number; stopped: number | null }>;
  machines: Array<{ id: string; name: string; tickets: number; stopped: number | null; avgResolveMs: number | null; downtimeMs: number | null }>;
};

const RANGES = [7, 30, 90];

// Boş günleri sıfırla doldurur; en eski gün solda
function series(days: number, daily: Stats['daily']) {
  const by = new Map(daily.map((d) => [d.day, d]));
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(Date.now() + 3 * 3600_000 - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    const d = by.get(day);
    return { day, tickets: d?.tickets ?? 0, stopped: d?.stopped ?? 0 };
  });
}

function Trend({ days, daily }: { days: number; daily: Stats['daily'] }) {
  const s = series(days, daily);
  const max = Math.max(1, ...s.map((d) => d.tickets));
  const w = 100 / s.length;
  return (
    <figure>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-40 w-full border-2 border-dokum bg-sac" role="img"
        aria-label={`Son ${days} günde günlük arıza sayısı, en çok bir günde ${max}`}>
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2="100" y1={40 * g} y2={40 * g} stroke="#1b2024" strokeOpacity=".1" strokeWidth=".3" />)}
        {s.map((d, i) => d.tickets > 0 && (
          <g key={d.day}>
            <title>{`${d.day}: ${d.tickets} arıza${d.stopped ? `, ${d.stopped} durdu` : ''}`}</title>
            <rect x={i * w + w * 0.12} width={w * 0.76} y={40 - (d.tickets / max) * 38} height={(d.tickets / max) * 38}
              fill={d.stopped ? 'var(--color-kirmizi)' : 'var(--color-amber)'} />
          </g>
        ))}
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-gri">
        <span>{s[0].day.slice(5).split('-').reverse().join('.')}</span>
        <span><i className="mr-1 inline-block h-2 w-2 bg-kirmizi" />makine durdu <i className="ml-2 mr-1 inline-block h-2 w-2 bg-amber" />diğer</span>
        <span>bugün</span>
      </figcaption>
    </figure>
  );
}

export default function Reports() {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => { setStats(null); api<Stats>(`/stats?days=${days}`).then(setStats); }, [days]);

  const max = Math.max(1, ...(stats?.machines.map((m) => m.tickets) ?? [1]));
  const maxDown = Math.max(1, ...(stats?.machines.map((m) => m.downtimeMs ?? 0) ?? [1]));
  const d = stats && delta(stats.summary.total, stats.prev.total);

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="plaka text-3xl">Raporlar</h1>
          <p className="mt-2 text-gri">Hangi makine sık bozuluyor, ne kadar duruyor, arızalar ne kadar sürede kapanıyor?</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <a href="/api/export/tickets.csv" className="text-sm underline underline-offset-4">Excel’e indir (CSV)</a>
          <div role="group" aria-label="Zaman aralığı" className="flex">
            {RANGES.map((r) => (
              <button key={r} onClick={() => setDays(r)} aria-pressed={days === r}
                className={`border-2 border-dokum px-3 py-1.5 font-semibold -ml-0.5 first:ml-0 ${days === r ? 'bg-dokum text-sac' : 'bg-sac'}`}>
                Son {r} gün
              </button>
            ))}
          </div>
        </div>
      </div>

      {!stats ? <p className="mt-8 text-gri">Yükleniyor…</p> : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Bildirilen arıza" value={String(stats.summary.total)} hint={d!.hint} tone={d!.tone} />
            <Tile label="Makineyi durduran arıza" value={String(stats.summary.stopped ?? 0)} />
            <Tile label="Toplam duruş süresi" value={stats.summary.downtimeMs ? formatDuration(stats.summary.downtimeMs) : '–'} hint="Makine durdu denen arızaların açık kaldığı süre" />
            <Tile label="Ortalama çözüm süresi" value={formatDuration(stats.summary.avgResolveMs)}
              hint={stats.prev.avgResolveMs ? `Önceki dönem: ${formatDuration(stats.prev.avgResolveMs)}` : undefined} />
          </div>

          <h2 className="plaka mt-12 text-2xl">Günlük arıza sayısı</h2>
          <div className="mt-4"><Trend days={days} daily={stats.daily} /></div>

          <h2 className="plaka mt-12 text-2xl">Makine bazında</h2>
          {stats.machines.length === 0 ? (
            <p className="mt-4 text-gri">Henüz makine yok. Makineler sayfasından ilk makinenizi ekleyin.</p>
          ) : stats.summary.total === 0 ? (
            <p className="mt-4 text-gri">Bu dönemde arıza bildirilmedi.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {stats.machines.map((m) => (
                <li key={m.id} className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[12rem_1fr_11rem]">
                  <span className="font-semibold">{m.name}</span>
                  <span className="space-y-1">
                    <span className="block h-4 border-2 border-dokum bg-sac" role="img" aria-label={`${m.tickets} arıza`}>
                      <span className="block h-full bg-amber" style={{ width: `${(m.tickets / max) * 100}%` }} />
                    </span>
                    <span className="block h-4 border-2 border-dokum bg-sac" role="img" aria-label={`Duruş ${formatDuration(m.downtimeMs)}`}>
                      <span className="block h-full bg-kirmizi" style={{ width: `${((m.downtimeMs ?? 0) / maxDown) * 100}%` }} />
                    </span>
                  </span>
                  <span className="seri text-sm text-gri">
                    {m.tickets} arıza · çözüm {formatDuration(m.avgResolveMs)}<br />duruş {m.downtimeMs ? formatDuration(m.downtimeMs) : '–'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-8 max-w-xl text-sm text-gri">
            Sarı çubuk arıza sayısı, kırmızı çubuk makinenin durduğu süredir. Çözüm süresi, bildirimden “Çözüldü” yapılmasına kadar geçen süredir; çözülmemiş arızalar ortalamaya girmez, duruş süresine ise şimdiye kadar geçen süre eklenir.
          </p>
        </>
      )}
    </Shell>
  );
}
