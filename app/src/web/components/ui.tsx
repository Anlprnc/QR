import type { MachineState } from '../lib/api';

export const STATE: Record<MachineState, { label: string; color: string; cls: string }> = {
  ok: { label: 'Çalışıyor', color: 'var(--color-yesil)', cls: 'bg-yesil' },
  fault: { label: 'Arızalı', color: 'var(--color-amber)', cls: 'bg-amber' },
  stopped: { label: 'Durdu', color: 'var(--color-kirmizi)', cls: 'bg-kirmizi' },
};

export function Lamp({ state, size = 16, pulse = true }: { state: MachineState; size?: number; pulse?: boolean }) {
  const s = STATE[state];
  return (
    <span aria-hidden="true" className={`inline-block shrink-0 rounded-full ${state !== 'ok' && pulse ? 'lamba-nabiz' : ''}`}
      style={{ width: size, height: size, background: s.color, boxShadow: state === 'ok' ? 'none' : `0 0 ${size}px ${size / 5}px ${s.color}` }} />
  );
}

export function StateBadge({ state }: { state: MachineState }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold">
      <Lamp state={state} size={12} />{STATE[state].label}
    </span>
  );
}

export function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'bad' | 'good' }) {
  return (
    <div className="kart p-4">
      <p className="text-sm text-gri">{label}</p>
      <p className="plaka seri mt-1 text-3xl">{value}</p>
      {hint && <p className={`mt-1 text-xs font-semibold ${tone === 'bad' ? 'text-kirmizi' : tone === 'good' ? 'text-yesil' : 'text-gri'}`}>{hint}</p>}
    </div>
  );
}

// Seri bir önceki dönemle karşılaştırma metni; azalma iyidir
export function delta(cur: number, prev: number): { hint: string; tone?: 'bad' | 'good' } {
  if (!prev && !cur) return { hint: '' };
  if (!prev) return { hint: 'Önceki dönemde yoktu', tone: 'bad' };
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return { hint: 'Önceki dönemle aynı' };
  return { hint: `Önceki döneme göre %${Math.abs(pct)} ${pct > 0 ? 'artış' : 'azalış'}`, tone: pct > 0 ? 'bad' : 'good' };
}
