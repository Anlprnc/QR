import { useState, type ReactElement } from 'react';

type Step = {
  lamp: 'yesil' | 'kirmizi' | 'amber';
  status: string;
  button: string;
  phone: 'none' | 'form' | 'sent';
  ticket: string | null;
};

const STEPS: Step[] = [
  { lamp: 'yesil', status: 'Çalışıyor', button: 'Telefonla QR’ı okut', phone: 'none', ticket: null },
  { lamp: 'yesil', status: 'Çalışıyor', button: 'Arızayı bildir', phone: 'form', ticket: null },
  { lamp: 'kirmizi', status: 'Arızalı', button: 'Üstlen', phone: 'sent', ticket: 'Açık · az önce' },
  { lamp: 'amber', status: 'Müdahale ediliyor', button: 'Çözüldü yap', phone: 'none', ticket: 'İşlemde · Kemal Usta' },
  { lamp: 'yesil', status: 'Çalışıyor', button: 'Baştan oynat', phone: 'none', ticket: 'Çözüldü · 14 dk' },
];

// Süslü örnek desen; gerçek bir QR kod değildir.
function Pattern() {
  const n = 17;
  const cells: ReactElement[] = [];
  const finder = (x: number, y: number) =>
    (x < 5 && y < 5) || (x > n - 6 && y < 5) || (x < 5 && y > n - 6);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (finder(x, y)) continue;
      if (((x * 7 + y * 13 + x * y) % 5) < 2) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
    }
  const eye = (x: number, y: number) => (
    <g key={`e${x}${y}`}>
      <rect x={x} y={y} width="5" height="5" />
      <rect x={x + 1} y={y + 1} width="3" height="3" fill="var(--color-sac)" />
      <rect x={x + 2} y={y + 2} width="1" height="1" />
    </g>
  );
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className="h-28 w-28" fill="var(--color-dokum)" aria-hidden="true">
      {cells}{eye(0, 0)}{eye(n - 5, 0)}{eye(0, n - 5)}
    </svg>
  );
}

export default function AndonDemo() {
  const [i, setI] = useState(0);
  const s = STEPS[i];
  const lamps: Array<[Step['lamp'], string]> = [
    ['kirmizi', 'bg-kirmizi'],
    ['amber', 'bg-amber'],
    ['yesil', 'bg-yesil'],
  ];

  return (
    <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-end">
      {/* Andon lambası */}
      <div className="flex flex-col items-center sm:items-start">
        <div className="flex w-16 flex-col gap-2 rounded-md bg-dokum p-2" role="img" aria-label={`Makine durumu: ${s.status}`}>
          {lamps.map(([k, bg]) => (
            <div key={k} data-on={s.lamp === k}
              className={`lamba aspect-square rounded-full ${bg}`}
              style={s.lamp === k ? { boxShadow: `0 0 22px 4px var(--color-${k})` } : undefined} />
          ))}
        </div>
        <div className="ml-0 h-14 w-3 self-center bg-dokum" aria-hidden="true" />
      </div>

      {/* Makine plakası */}
      <div className="levha rounded-sm border-2 border-dokum bg-sac p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="seri text-sm text-gri">Seri no 0417</p>
            <p className="plaka mt-1 text-2xl">CNC Torna 1</p>
            <p aria-live="polite" className="mt-3 font-semibold">{s.status}</p>
            <p aria-live="polite" className="min-h-6 text-sm text-gri">{s.ticket ?? 'Açık arıza yok'}</p>
          </div>
          <Pattern />
        </div>

        {s.phone !== 'none' && (
          <div className="mt-4 rounded-lg border border-dokum/30 bg-boya p-3 text-sm" aria-live="polite">
            {s.phone === 'form'
              ? <><p className="text-gri">Sorun nedir?</p><p className="mt-1 font-medium">Mil dönmüyor, ses geliyor</p></>
              : <p className="font-medium">Bildirim alındı. Bakım ekibine iletildi.</p>}
          </div>
        )}

        <button type="button" onClick={() => setI((i + 1) % STEPS.length)}
          className="mt-5 w-full rounded-sm bg-dokum px-4 py-3 font-semibold text-sac hover:bg-black sm:w-auto">
          {s.button}
        </button>
      </div>
    </div>
  );
}
