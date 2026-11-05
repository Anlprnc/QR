import { useState } from 'react';

type Status = 'ok' | 'open' | 'wip';
type Machine = { id: string; name: string; zone: string; status: Status; issue?: string; stopped?: boolean };

const INITIAL: Machine[] = [
  { id: 'torna1', name: 'CNC Torna 1', zone: 'Talaşlı imalat', status: 'ok' },
  { id: 'torna2', name: 'CNC Torna 2', zone: 'Talaşlı imalat', status: 'ok' },
  { id: 'freze', name: 'CNC Freze', zone: 'Talaşlı imalat', status: 'ok' },
  { id: 'abkant', name: 'Abkant Pres', zone: 'Sac', status: 'ok' },
  { id: 'pres', name: 'Hidrolik Pres', zone: 'Sac', status: 'ok' },
  { id: 'kompresor', name: 'Kompresör', zone: 'Yardımcı tesis', status: 'ok' },
];
const ISSUES = ['Yağ kaçırıyor', 'Ses yapıyor', 'Çalışmıyor'];

const LAMP: Record<Status, string> = { ok: 'var(--color-yesil)', open: 'var(--color-kirmizi)', wip: 'var(--color-amber)' };
const LABEL: Record<Status, string> = { ok: 'Çalışıyor', open: 'Arızalı', wip: 'Müdahale ediliyor' };

export default function FloorDemo() {
  const [machines, setMachines] = useState<Machine[]>(INITIAL);
  const [selected, setSelected] = useState<string | null>(null);
  const [issue, setIssue] = useState(ISSUES[0]);
  const [stopped, setStopped] = useState(true);

  const update = (id: string, patch: Partial<Machine>) =>
    setMachines((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const sel = machines.find((m) => m.id === selected && m.status === 'ok');
  const faults = machines.filter((m) => m.status !== 'ok');
  const running = machines.filter((m) => m.status === 'ok').length;

  function send() {
    if (!sel) return;
    update(sel.id, { status: 'open', issue, stopped });
    setSelected(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      {/* Zemin planı */}
      <div className="zemin rounded-sm border-2 border-boya/30 p-4 sm:p-6">
        <div className="flex items-baseline justify-between text-sac">
          <p className="plaka text-lg">Atölye zemini</p>
          <p className="seri text-sm text-sac/70" aria-live="polite">{running} / {machines.length} makine çalışıyor</p>
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {machines.map((m) => {
            const active = selected === m.id;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={m.status !== 'ok'}
                  onClick={() => setSelected(active ? null : m.id)}
                  aria-pressed={active}
                  aria-label={`${m.name}, ${LABEL[m.status]}${m.status === 'ok' ? '. Arıza bildirmek için seç.' : ''}`}
                  className={`makine h-full w-full border-2 p-3 text-left ${active ? 'border-sac bg-sac/10' : 'border-sac/30'} ${m.status === 'ok' ? 'hover:border-sac' : 'cursor-default'}`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-xs text-sac/60">{m.zone}</span>
                    <span className={`lamba-mini ${m.status === 'open' ? 'nabiz' : ''}`}
                      style={{ background: LAMP[m.status], boxShadow: `0 0 14px 2px ${LAMP[m.status]}` }} aria-hidden="true" />
                  </span>
                  <span className="plaka mt-3 block text-base text-sac">{m.name}</span>
                  <span className="mt-1 block text-sm text-sac/70">{LABEL[m.status]}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-sm text-sac/70">Bir makineye dokunun, operatör gibi arıza bildirin.</p>
      </div>

      {/* Sağ kolon: telefon ya da pano */}
      <div className="space-y-4">
        {sel ? (
          <div className="border-2 border-sac bg-boya p-4 text-dokum">
            <p className="text-sm text-gri">Telefonda açılan form</p>
            <p className="plaka mt-1 text-xl">{sel.name}</p>
            <fieldset className="mt-3">
              <legend className="text-sm font-semibold">Sorun nedir?</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {ISSUES.map((i) => (
                  <button key={i} type="button" onClick={() => setIssue(i)} aria-pressed={issue === i}
                    className={`border-2 border-dokum px-3 py-1.5 text-sm font-semibold ${issue === i ? 'bg-dokum text-sac' : 'bg-sac'}`}>{i}</button>
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-3">
              <legend className="text-sm font-semibold">Makine durdu mu?</legend>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {([[true, 'Evet'], [false, 'Hayır']] as const).map(([v, l]) => (
                  <button key={l} type="button" onClick={() => setStopped(v)} aria-pressed={stopped === v}
                    className={`border-2 border-dokum px-3 py-1.5 text-sm font-semibold ${stopped === v ? 'bg-dokum text-sac' : 'bg-sac'}`}>{l}</button>
                ))}
              </div>
            </fieldset>
            <button type="button" onClick={send} className="mt-4 w-full bg-dokum px-4 py-2.5 font-semibold text-sac hover:bg-black">Arızayı bildir</button>
          </div>
        ) : (
          <div className="border-2 border-sac/30 p-4 text-sac">
            <p className="plaka text-lg">Bakım panosu</p>
            {faults.length === 0 ? (
              <p className="mt-2 text-sac/70">Bekleyen arıza yok. Soldan bir makine seçip arıza bildirin.</p>
            ) : (
              <ul className="mt-3 space-y-3" aria-live="polite">
                {faults.map((m) => (
                  <li key={m.id} className="border-2 border-sac/40 p-3" style={{ borderColor: m.status === 'open' && m.stopped ? 'var(--color-kirmizi)' : undefined }}>
                    <p className="flex items-center justify-between gap-2">
                      <span className="plaka">{m.name}</span>
                      {m.stopped && <span className="rounded-sm bg-kirmizi px-2 py-0.5 text-xs font-bold text-white">Makine durdu</span>}
                    </p>
                    <p className="mt-1 text-sm text-sac/80">{m.issue} · {LABEL[m.status]}</p>
                    <button type="button" onClick={() => update(m.id, m.status === 'open' ? { status: 'wip' } : { status: 'ok', issue: undefined, stopped: undefined })}
                      className="mt-2 border-2 border-sac px-3 py-1 text-sm font-semibold text-sac hover:bg-sac hover:text-dokum">
                      {m.status === 'open' ? 'Üstlen' : 'Çözüldü yap'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
