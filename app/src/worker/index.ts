import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { auth, requireOwner, requireSession, type AppEnv } from './auth';
import { allow, csvCell, randomToken } from './util';
import { sendMail } from './mail';

const DAY = 86_400_000;
const app = new Hono<AppEnv>();
app.route('/api/auth', auth);

app.get('/api/health', (c) => c.json({ ok: true }));

// Herkese açık QR sayfası: yalnızca makine adı ve açık arıza sayısı döner (org bilgisi sızdırılmaz)
app.get('/api/q/:token', async (c) => {
  const m = await c.env.DB.prepare(
    `SELECT m.name, (SELECT COUNT(*) FROM tickets t WHERE t.machine_id = m.id AND t.status != 'resolved') AS openCount
       FROM machines m WHERE m.qr_token = ? AND m.archived_at IS NULL`,
  ).bind(c.req.param('token')).first<{ name: string; openCount: number }>();
  if (!m) return c.json({ error: 'not_found' }, 404);
  return c.json({ machine: m.name, openCount: m.openCount, turnstileSiteKey: c.env.TURNSTILE_SITE_KEY ?? null });
});

// Cloudflare Turnstile (ücretsiz). Anahtarlar tanımlı değilse doğrulama atlanır (yerel geliştirme).
async function turnstileOk(env: AppEnv['Bindings'], token: string | undefined, ip: string) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }),
  }).catch(() => null);
  return !!r && ((await r.json().catch(() => ({}))) as { success?: boolean }).success === true;
}

const reportSchema = z.object({
  description: z.string().trim().min(3).max(1000),
  reporterName: z.string().trim().max(80).optional(),
  machineStopped: z.boolean().optional(),
  turnstileToken: z.string().max(2048).optional(),
});

app.post('/api/q/:token/tickets', zValidator('json', reportSchema), async (c) => {
  const token = c.req.param('token');
  const ip = c.req.header('cf-connecting-ip') ?? 'local';
  if (!(await allow(c.env.DB, `qip:${ip}`, 15, 10 * 60_000))) return c.json({ error: 'too_many_requests' }, 429);

  const m = await c.env.DB.prepare('SELECT id, org_id, name FROM machines WHERE qr_token = ? AND archived_at IS NULL')
    .bind(token).first<{ id: string; org_id: string; name: string }>();
  if (!m) return c.json({ error: 'not_found' }, 404);
  if (!(await allow(c.env.DB, `qtk:${token}`, 40, 3600_000))) return c.json({ error: 'too_many_requests' }, 429);
  if (Math.random() < 0.02) c.executionCtx.waitUntil(c.env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(Date.now() - 86_400_000).run().then(() => {}));
  const { description, reporterName, machineStopped, turnstileToken } = c.req.valid('json');
  if (!(await turnstileOk(c.env, turnstileToken, ip))) return c.json({ error: 'captcha_failed' }, 403);
  const id = crypto.randomUUID();
  const now = Date.now();
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO tickets (id, org_id, machine_id, description, reporter_name, machine_stopped, created_at) VALUES (?,?,?,?,?,?,?)',
    ).bind(id, m.org_id, m.id, description, reporterName ?? null, machineStopped ? 1 : 0, now),
    c.env.DB.prepare(
      'INSERT INTO ticket_events (id, org_id, ticket_id, type, created_at) VALUES (?,?,?,?,?)',
    ).bind(crypto.randomUUID(), m.org_id, id, 'created', now),
  ]);

  // Bakım ekibine e-posta: yanıtı geciktirmez, hata verirse bildirim kaybolur ama kayıt durur
  c.executionCtx.waitUntil((async () => {
    const { results } = await c.env.DB.prepare('SELECT email FROM users WHERE org_id = ?').bind(m.org_id).all<{ email: string }>();
    if (!results.length) return;
    await sendMail(c.env, results.map((u) => u.email),
      `${machineStopped ? '🔴 Makine durdu' : 'Yeni arıza'}: ${m.name}`,
      `${m.name}\n${machineStopped ? 'Makine durmuş durumda.\n' : ''}\n${description}\n\n${reporterName ? `Bildiren: ${reporterName}\n` : ''}Panel: ${new URL(c.req.url).origin}/panel`);
  })().catch(() => {}));
  return c.json({ id }, 201);
});

// ---- Oturum gerektiren, kuruma (org) bağlı uçlar. Her sorguda org_id süzülür. ----
const api = new Hono<AppEnv>();
api.use('*', requireSession);

api.get('/me', async (c) => {
  const { userId, orgId } = c.get('session');
  const row = await c.env.DB.prepare(
    'SELECT u.email, u.role, o.name AS org FROM users u JOIN organizations o ON o.id = u.org_id WHERE u.id = ? AND o.id = ?',
  ).bind(userId, orgId).first();
  return c.json(row);
});

api.patch('/org', requireOwner, zValidator('json', z.object({ name: z.string().trim().min(2).max(80) })), async (c) => {
  const { orgId } = c.get('session');
  await c.env.DB.prepare('UPDATE organizations SET name = ? WHERE id = ?').bind(c.req.valid('json').name, orgId).run();
  return c.json({ ok: true });
});

// ---- Ekip ----
api.get('/team', async (c) => {
  const { orgId, userId } = c.get('session');
  const { results } = await c.env.DB.prepare('SELECT id, email, role, created_at AS createdAt FROM users WHERE org_id = ? ORDER BY created_at')
    .bind(orgId).all<{ id: string }>();
  return c.json(results.map((u) => ({ ...u, you: u.id === userId })));
});

api.post('/team', requireOwner, zValidator('json', z.object({ email: z.string().trim().toLowerCase().email().max(200) })), async (c) => {
  const { orgId } = c.get('session');
  const { email } = c.req.valid('json');
  const existing = await c.env.DB.prepare('SELECT org_id FROM users WHERE email = ?').bind(email).first<{ org_id: string }>();
  if (existing) return c.json({ error: existing.org_id === orgId ? 'already_member' : 'email_taken' }, 409);
  const org = await c.env.DB.prepare('SELECT name FROM organizations WHERE id = ?').bind(orgId).first<{ name: string }>();
  await c.env.DB.prepare('INSERT INTO users (id, email, org_id, role, created_at) VALUES (?,?,?,\'member\',?)')
    .bind(crypto.randomUUID(), email, orgId, Date.now()).run();
  c.executionCtx.waitUntil(sendMail(c.env, email, `${org?.name ?? 'Atölye'} sizi ArızaQR'a ekledi`,
    `Giriş yapmak için ${new URL(c.req.url).origin}/giris adresinde bu e-posta adresini yazın; size tek kullanımlık kod gelecek.`).catch(() => {}));
  return c.json({ ok: true }, 201);
});

api.delete('/team/:id', requireOwner, async (c) => {
  const { orgId, userId } = c.get('session');
  const id = c.req.param('id');
  if (id === userId) return c.json({ error: 'cannot_remove_self' }, 409);
  const r = await c.env.DB.prepare('DELETE FROM users WHERE id = ? AND org_id = ?').bind(id, orgId).run();
  if (!r.meta.changes) return c.json({ error: 'not_found' }, 404);
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND org_id = ?').bind(id, orgId).run();
  return c.json({ ok: true });
});

// ---- Makineler ----
// durum: 'stopped' (durmuş arıza açık) > 'fault' (açık/işlemde arıza) > 'ok'
const MACHINE_SELECT = `
  SELECT m.id, m.name, m.location, m.qr_token AS qrToken,
         (SELECT COUNT(*) FROM tickets t WHERE t.machine_id = m.id AND t.org_id = m.org_id AND t.status != 'resolved') AS openCount,
         (SELECT COUNT(*) FROM tickets t WHERE t.machine_id = m.id AND t.org_id = m.org_id AND t.status = 'open') AS unclaimed,
         (SELECT COUNT(*) FROM tickets t WHERE t.machine_id = m.id AND t.org_id = m.org_id AND t.status != 'resolved' AND t.machine_stopped = 1) AS stoppedCount,
         (SELECT MAX(created_at) FROM tickets t WHERE t.machine_id = m.id AND t.org_id = m.org_id) AS lastTicketAt
    FROM machines m`;

type MachineRow = { stoppedCount: number; openCount: number };
const withState = <T extends MachineRow>(m: T) => ({ ...m, state: m.stoppedCount ? 'stopped' : m.openCount ? 'fault' : 'ok' });

api.get('/machines', async (c) => {
  const { orgId } = c.get('session');
  const { results } = await c.env.DB.prepare(`${MACHINE_SELECT} WHERE m.org_id = ? AND m.archived_at IS NULL ORDER BY m.name`)
    .bind(orgId).all<MachineRow>();
  return c.json(results.map(withState));
});

const machineSchema = z.object({
  name: z.string().trim().min(2).max(80),
  location: z.string().trim().max(80).optional(),
});

api.post('/machines', zValidator('json', machineSchema), async (c) => {
  const { orgId } = c.get('session');
  const { name, location } = c.req.valid('json');
  const id = crypto.randomUUID();
  const qrToken = randomToken(12);
  await c.env.DB.prepare('INSERT INTO machines (id, org_id, name, location, qr_token) VALUES (?,?,?,?,?)')
    .bind(id, orgId, name, location || null, qrToken).run();
  return c.json({ id, qrToken }, 201);
});

api.get('/machines/:id', async (c) => {
  const { orgId } = c.get('session');
  const id = c.req.param('id');
  const m = await c.env.DB.prepare(`${MACHINE_SELECT} WHERE m.id = ? AND m.org_id = ? AND m.archived_at IS NULL`)
    .bind(id, orgId).first<MachineRow>();
  if (!m) return c.json({ error: 'not_found' }, 404);
  const now = Date.now();
  const stats = await c.env.DB.prepare(
    `SELECT COUNT(*) AS total, SUM(machine_stopped) AS stopped,
            AVG(CASE WHEN resolved_at IS NOT NULL THEN resolved_at - created_at END) AS avgResolveMs,
            SUM(CASE WHEN machine_stopped = 1 THEN COALESCE(resolved_at, ?3) - created_at ELSE 0 END) AS downtimeMs,
            MIN(created_at) AS firstAt
       FROM tickets WHERE machine_id = ?1 AND org_id = ?2 AND created_at >= ?4`,
  ).bind(id, orgId, now, now - 90 * DAY).first();
  const { results: tickets } = await c.env.DB.prepare(
    `SELECT id, description, status, reporter_name AS reporterName, assignee, resolution,
            machine_stopped AS machineStopped, created_at AS createdAt, resolved_at AS resolvedAt
       FROM tickets WHERE machine_id = ? AND org_id = ? ORDER BY created_at DESC LIMIT 50`,
  ).bind(id, orgId).all();
  return c.json({ ...withState(m), stats, tickets });
});

api.patch('/machines/:id', zValidator('json', machineSchema.partial()), async (c) => {
  const { orgId } = c.get('session');
  const { name, location } = c.req.valid('json');
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (name !== undefined) { sets.push('name = ?'); vals.push(name); }
  if (location !== undefined) { sets.push('location = ?'); vals.push(location || null); }
  if (!sets.length) return c.json({ ok: true });
  const r = await c.env.DB.prepare(`UPDATE machines SET ${sets.join(', ')} WHERE id = ? AND org_id = ? AND archived_at IS NULL`)
    .bind(...vals, c.req.param('id'), orgId).run();
  return c.json(r.meta.changes ? { ok: true } : { error: 'not_found' }, r.meta.changes ? 200 : 404);
});

// Silme yerine arşivleme: geçmiş arızalar ve raporlar korunur, QR kod geçersiz olur
api.delete('/machines/:id', async (c) => {
  const { orgId } = c.get('session');
  const r = await c.env.DB.prepare('UPDATE machines SET archived_at = ? WHERE id = ? AND org_id = ? AND archived_at IS NULL')
    .bind(Date.now(), c.req.param('id'), orgId).run();
  return c.json(r.meta.changes ? { ok: true } : { error: 'not_found' }, r.meta.changes ? 200 : 404);
});

// ---- Arızalar ----
api.get('/tickets', async (c) => {
  const { orgId } = c.get('session');
  const status = c.req.query('status');
  const where = status && ['open', 'in_progress', 'resolved'].includes(status) ? 'AND t.status = ?' : '';
  const stmt = c.env.DB.prepare(
    `SELECT t.id, t.description, t.status, t.reporter_name AS reporterName, t.created_at AS createdAt,
            t.machine_stopped AS machineStopped, t.resolved_at AS resolvedAt, t.assignee, t.resolution,
            m.id AS machineId, m.name AS machine
       FROM tickets t JOIN machines m ON m.id = t.machine_id AND m.org_id = t.org_id
      WHERE t.org_id = ? ${where}
      ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, t.machine_stopped DESC, t.created_at DESC
      LIMIT 200`,
  );
  const { results } = await (where ? stmt.bind(orgId, status) : stmt.bind(orgId)).all();
  return c.json(results);
});

const transitions: Record<string, string[]> = { open: ['in_progress', 'resolved'], in_progress: ['resolved'], resolved: ['open'] };

const patchSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved']).optional(),
  assignee: z.string().trim().max(80).nullable().optional(),
  resolution: z.string().trim().max(500).optional(),
});

api.patch('/tickets/:id', zValidator('json', patchSchema), async (c) => {
  const { orgId } = c.get('session');
  const id = c.req.param('id');
  const { status: next, assignee, resolution } = c.req.valid('json');
  const t = await c.env.DB.prepare('SELECT status FROM tickets WHERE id = ? AND org_id = ?')
    .bind(id, orgId).first<{ status: string }>();
  if (!t) return c.json({ error: 'not_found' }, 404);
  if (next && next !== t.status && !transitions[t.status]?.includes(next)) return c.json({ error: 'invalid_transition' }, 409);

  const now = Date.now();
  const stmts: D1PreparedStatement[] = [];
  if (assignee !== undefined) {
    stmts.push(c.env.DB.prepare('UPDATE tickets SET assignee = ? WHERE id = ? AND org_id = ?').bind(assignee || null, id, orgId));
  }
  if (next && next !== t.status) {
    stmts.push(
      c.env.DB.prepare('UPDATE tickets SET status = ?, resolved_at = ?, resolution = CASE WHEN ? = \'resolved\' THEN COALESCE(?, resolution) ELSE resolution END WHERE id = ? AND org_id = ?')
        .bind(next, next === 'resolved' ? now : null, next, resolution || null, id, orgId),
      c.env.DB.prepare('INSERT INTO ticket_events (id, org_id, ticket_id, type, note, created_at) VALUES (?,?,?,?,?,?)')
        .bind(crypto.randomUUID(), orgId, id, next, (next === 'resolved' && resolution) || null, now),
    );
  }
  if (stmts.length) await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

api.post('/tickets/:id/notes', zValidator('json', z.object({ note: z.string().trim().min(1).max(500) })), async (c) => {
  const { orgId } = c.get('session');
  const id = c.req.param('id');
  const t = await c.env.DB.prepare('SELECT 1 AS x FROM tickets WHERE id = ? AND org_id = ?').bind(id, orgId).first();
  if (!t) return c.json({ error: 'not_found' }, 404);
  await c.env.DB.prepare('INSERT INTO ticket_events (id, org_id, ticket_id, type, note, created_at) VALUES (?,?,?,?,?,?)')
    .bind(crypto.randomUUID(), orgId, id, 'note', c.req.valid('json').note, Date.now()).run();
  return c.json({ ok: true }, 201);
});

api.get('/tickets/:id/events', async (c) => {
  const { orgId } = c.get('session');
  const { results } = await c.env.DB.prepare(
    `SELECT e.type, e.note, e.created_at AS createdAt FROM ticket_events e
       JOIN tickets t ON t.id = e.ticket_id AND t.org_id = e.org_id
      WHERE e.ticket_id = ? AND e.org_id = ? ORDER BY e.created_at`,
  ).bind(c.req.param('id'), orgId).all();
  return c.json(results);
});

// Excel (TR) için ; ayraçlı, BOM'lu CSV
api.get('/export/tickets.csv', async (c) => {
  const { orgId } = c.get('session');
  const { results } = await c.env.DB.prepare(
    `SELECT m.name AS machine, t.description, t.status, t.machine_stopped AS stopped, t.reporter_name AS reporter,
            t.assignee, t.resolution, t.created_at AS createdAt, t.resolved_at AS resolvedAt
       FROM tickets t JOIN machines m ON m.id = t.machine_id AND m.org_id = t.org_id
      WHERE t.org_id = ? ORDER BY t.created_at DESC LIMIT 5000`,
  ).bind(orgId).all<Record<string, unknown>>();
  const fmt = (ms: unknown) => (ms ? new Date(Number(ms) + 3 * 3600_000).toISOString().slice(0, 16).replace('T', ' ') : '');
  const label: Record<string, string> = { open: 'Açık', in_progress: 'İşlemde', resolved: 'Çözüldü' };
  const head = ['Makine', 'Arıza', 'Durum', 'Makine durdu mu', 'Bildiren', 'Üstlenen', 'Çözüm notu', 'Bildirim zamanı', 'Çözüm zamanı', 'Çözüm süresi (dk)'];
  const rows = results.map((r) => [
    r.machine, r.description, label[String(r.status)], r.stopped ? 'Evet' : 'Hayır', r.reporter, r.assignee, r.resolution,
    fmt(r.createdAt), fmt(r.resolvedAt), r.resolvedAt ? Math.round((Number(r.resolvedAt) - Number(r.createdAt)) / 60000) : '',
  ]);
  const body = [head, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');
  return new Response('﻿' + body, {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="arizalar.csv"' },
  });
});

// Son N gün: özet, önceki dönemle karşılaştırma, günlük seri ve makine bazlı sayılar
api.get('/stats', async (c) => {
  const { orgId } = c.get('session');
  const days = Math.min(365, Math.max(1, Number(c.req.query('days')) || 30));
  const now = Date.now();
  const since = now - days * DAY;
  const summary = await c.env.DB.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status != 'resolved' THEN 1 ELSE 0 END) AS open,
            SUM(machine_stopped) AS stopped,
            AVG(CASE WHEN resolved_at IS NOT NULL THEN resolved_at - created_at END) AS avgResolveMs,
            SUM(CASE WHEN machine_stopped = 1 THEN COALESCE(resolved_at, ?3) - created_at ELSE 0 END) AS downtimeMs
       FROM tickets WHERE org_id = ?1 AND created_at >= ?2`,
  ).bind(orgId, since, now).first();
  const prev = await c.env.DB.prepare(
    `SELECT COUNT(*) AS total, AVG(CASE WHEN resolved_at IS NOT NULL THEN resolved_at - created_at END) AS avgResolveMs
       FROM tickets WHERE org_id = ? AND created_at >= ? AND created_at < ?`,
  ).bind(orgId, since - days * DAY, since).first();
  // Türkiye saati (UTC+3) gününe göre
  const { results: daily } = await c.env.DB.prepare(
    `SELECT date((created_at + 10800000) / 1000, 'unixepoch') AS day, COUNT(*) AS tickets, SUM(machine_stopped) AS stopped
       FROM tickets WHERE org_id = ? AND created_at >= ? GROUP BY day ORDER BY day`,
  ).bind(orgId, since).all();
  const { results: machines } = await c.env.DB.prepare(
    `SELECT m.id, m.name, COUNT(t.id) AS tickets, SUM(t.machine_stopped) AS stopped,
            AVG(CASE WHEN t.resolved_at IS NOT NULL THEN t.resolved_at - t.created_at END) AS avgResolveMs,
            SUM(CASE WHEN t.machine_stopped = 1 THEN COALESCE(t.resolved_at, ?3) - t.created_at ELSE 0 END) AS downtimeMs
       FROM machines m LEFT JOIN tickets t
         ON t.machine_id = m.id AND t.org_id = m.org_id AND t.created_at >= ?1
      WHERE m.org_id = ?2 AND m.archived_at IS NULL
      GROUP BY m.id ORDER BY tickets DESC, m.name`,
  ).bind(since, orgId, now).all();
  return c.json({ days, summary, prev, daily, machines });
});

// ---- Planlı bakım ----
api.get('/maintenance', async (c) => {
  const { orgId } = c.get('session');
  const { results } = await c.env.DB.prepare(
    `SELECT k.id, k.title, k.interval_days AS intervalDays, k.last_done_at AS lastDoneAt,
            COALESCE(k.last_done_at, k.created_at) + k.interval_days * 86400000 AS dueAt,
            m.id AS machineId, m.name AS machine
       FROM maintenance_tasks k JOIN machines m ON m.id = k.machine_id AND m.org_id = k.org_id
      WHERE k.org_id = ? AND m.archived_at IS NULL ORDER BY dueAt`,
  ).bind(orgId).all();
  return c.json(results);
});

api.post('/maintenance', zValidator('json', z.object({
  machineId: z.string().min(1).max(64),
  title: z.string().trim().min(2).max(120),
  intervalDays: z.number().int().min(1).max(730),
})), async (c) => {
  const { orgId } = c.get('session');
  const { machineId, title, intervalDays } = c.req.valid('json');
  const m = await c.env.DB.prepare('SELECT 1 AS x FROM machines WHERE id = ? AND org_id = ? AND archived_at IS NULL').bind(machineId, orgId).first();
  if (!m) return c.json({ error: 'not_found' }, 404);
  const id = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO maintenance_tasks (id, org_id, machine_id, title, interval_days, created_at) VALUES (?,?,?,?,?,?)')
    .bind(id, orgId, machineId, title, intervalDays, Date.now()).run();
  return c.json({ id }, 201);
});

api.post('/maintenance/:id/done', zValidator('json', z.object({ doneBy: z.string().trim().max(80).optional() })), async (c) => {
  const { orgId } = c.get('session');
  const id = c.req.param('id');
  const now = Date.now();
  const r = await c.env.DB.prepare('UPDATE maintenance_tasks SET last_done_at = ? WHERE id = ? AND org_id = ?').bind(now, id, orgId).run();
  if (!r.meta.changes) return c.json({ error: 'not_found' }, 404);
  await c.env.DB.prepare('INSERT INTO maintenance_logs (id, org_id, task_id, done_at, done_by) VALUES (?,?,?,?,?)')
    .bind(crypto.randomUUID(), orgId, id, now, c.req.valid('json').doneBy ?? null).run();
  return c.json({ ok: true });
});

api.delete('/maintenance/:id', async (c) => {
  const { orgId } = c.get('session');
  const id = c.req.param('id');
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM maintenance_logs WHERE task_id = ? AND org_id = ?').bind(id, orgId),
    c.env.DB.prepare('DELETE FROM maintenance_tasks WHERE id = ? AND org_id = ?').bind(id, orgId),
  ]);
  return c.json({ ok: true });
});

app.route('/api', api);

export default app;
