import { Hono, type MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { randomToken, sha256, sixDigitCode } from './util';
import { sendMail } from './mail';

export type Env = {
  DB: D1Database; RESEND_API_KEY?: string; MAIL_FROM?: string; AUTH_PEPPER?: string;
  TURNSTILE_SITE_KEY?: string; TURNSTILE_SECRET?: string;
};
export type Session = { userId: string; orgId: string; role: 'owner' | 'member' };
export type AppEnv = { Bindings: Env; Variables: { session: Session } };

const CODE_TTL = 10 * 60_000;
const SESSION_TTL = 30 * 24 * 3600_000;
const MAX_ATTEMPTS = 5;
const MAX_REQUESTS_PER_HOUR = 5;
const COOKIE = 'sid';

const pepper = (env: Env) => env.AUTH_PEPPER ?? 'dev-only-pepper';

async function sendCode(env: Env, email: string, code: string) {
  if (!env.RESEND_API_KEY) console.log(`[dev] giriş kodu ${email}: ${code}`);
  await sendMail(env, email, 'ArızaQR giriş kodunuz',
    `Giriş kodunuz: ${code}\nKod 10 dakika geçerlidir. Siz istemediyseniz bu e-postayı yok sayın.`);
}

export const requireSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, COOKIE);
  if (!token) return c.json({ error: 'unauthorized' }, 401);
  const row = await c.env.DB.prepare(
    `SELECT s.user_id, s.org_id, s.expires_at, u.role FROM sessions s
       JOIN users u ON u.id = s.user_id AND u.org_id = s.org_id WHERE s.token_hash = ?`,
  ).bind(await sha256(token)).first<{ user_id: string; org_id: string; expires_at: number; role: 'owner' | 'member' }>();
  if (!row || row.expires_at < Date.now()) return c.json({ error: 'unauthorized' }, 401);
  c.set('session', { userId: row.user_id, orgId: row.org_id, role: row.role });
  await next();
};

const emailSchema = z.string().trim().toLowerCase().email().max(200);

export const requireOwner: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.get('session').role !== 'owner') return c.json({ error: 'forbidden' }, 403);
  await next();
};

export const auth = new Hono<AppEnv>();

auth.post('/request', zValidator('json', z.object({ email: emailSchema })), async (c) => {
  const { email } = c.req.valid('json');
  const now = Date.now();
  const prev = await c.env.DB.prepare('SELECT window_start, requests FROM login_codes WHERE email = ?')
    .bind(email).first<{ window_start: number; requests: number }>();
  let windowStart = now, requests = 1;
  if (prev && now - prev.window_start < 3600_000) {
    if (prev.requests >= MAX_REQUESTS_PER_HOUR) return c.json({ error: 'too_many_requests' }, 429);
    windowStart = prev.window_start;
    requests = prev.requests + 1;
  }
  const code = sixDigitCode();
  await c.env.DB.prepare(
    `INSERT INTO login_codes (email, code_hash, expires_at, attempts, window_start, requests)
     VALUES (?,?,?,0,?,?)
     ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash, expires_at=excluded.expires_at,
       attempts=0, window_start=excluded.window_start, requests=excluded.requests`,
  ).bind(email, await sha256(`${code}:${email}:${pepper(c.env)}`), now + CODE_TTL, windowStart, requests).run();
  await sendCode(c.env, email, code);
  return c.json({ ok: true });
});

auth.post('/verify', zValidator('json', z.object({ email: emailSchema, code: z.string().regex(/^\d{6}$/) })), async (c) => {
  const { email, code } = c.req.valid('json');
  const now = Date.now();
  const row = await c.env.DB.prepare('SELECT code_hash, expires_at, attempts FROM login_codes WHERE email = ?')
    .bind(email).first<{ code_hash: string; expires_at: number; attempts: number }>();
  if (!row || row.expires_at < now || row.attempts >= MAX_ATTEMPTS) return c.json({ error: 'invalid_code' }, 400);
  if (row.code_hash !== (await sha256(`${code}:${email}:${pepper(c.env)}`))) {
    await c.env.DB.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?').bind(email).run();
    return c.json({ error: 'invalid_code' }, 400);
  }
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM login_codes WHERE email = ?').bind(email),
    c.env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
    c.env.DB.prepare('DELETE FROM login_codes WHERE expires_at < ? AND window_start < ?').bind(now, now - 3600_000),
  ]);

  let user = await c.env.DB.prepare('SELECT id, org_id FROM users WHERE email = ?')
    .bind(email).first<{ id: string; org_id: string }>();
  if (!user) {
    const orgId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO organizations (id, name, created_at) VALUES (?,?,?)').bind(orgId, 'Yeni atölye', now),
      c.env.DB.prepare("INSERT INTO users (id, email, org_id, role, created_at) VALUES (?,?,?,'owner',?)").bind(userId, email, orgId, now),
    ]);
    user = { id: userId, org_id: orgId };
  }
  const token = randomToken();
  await c.env.DB.prepare('INSERT INTO sessions (token_hash, user_id, org_id, expires_at) VALUES (?,?,?,?)')
    .bind(await sha256(token), user.id, user.org_id, now + SESSION_TTL).run();
  setCookie(c, COOKIE, token, {
    httpOnly: true, sameSite: 'Lax', path: '/', maxAge: SESSION_TTL / 1000,
    secure: new URL(c.req.url).protocol === 'https:',
  });
  return c.json({ ok: true });
});

auth.post('/logout', async (c) => {
  const token = getCookie(c, COOKIE);
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  deleteCookie(c, COOKIE, { path: '/' });
  return c.json({ ok: true });
});
