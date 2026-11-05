export class ApiError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const r = await fetch(`/api${path}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    credentials: 'same-origin',
  });
  const data = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new ApiError(r.status, data.error ?? 'error');
  return data as T;
}

export function timeAgo(ms: number): string {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (m < 1) return 'az önce';
  if (m < 60) return `${m} dk önce`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} sa önce`;
  return `${Math.round(h / 24)} gün önce`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '–';
  const m = Math.round(ms / 60000);
  if (m < 1) return '1 dakikadan az';
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h} sa ${m % 60} dk` : `${h} sa`;
  return `${Math.round(h / 24)} gün`;
}
