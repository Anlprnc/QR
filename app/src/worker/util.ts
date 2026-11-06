export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken(bytes = 32): string {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function sixDigitCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return n.toString().padStart(6, '0');
}

// Pencere başına en fazla `limit` istek. Sınır aşıldıysa false döner.
export async function allow(db: D1Database, key: string, limit: number, windowMs: number): Promise<boolean> {
  const row = await db.prepare(
    `INSERT INTO rate_limits (key, window_start, hits) VALUES (?1, ?2, 1)
     ON CONFLICT(key) DO UPDATE SET
       hits = CASE WHEN ?2 - window_start > ?3 THEN 1 ELSE hits + 1 END,
       window_start = CASE WHEN ?2 - window_start > ?3 THEN ?2 ELSE window_start END
     RETURNING hits`,
  ).bind(key, Date.now(), windowMs).first<{ hits: number }>();
  return (row?.hits ?? 1) <= limit;
}

export const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
