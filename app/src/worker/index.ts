import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { auth, requireSession, type AppEnv } from './auth';
import { randomToken } from './util';

const app = new Hono<AppEnv>();
app.route('/api/auth', auth);

app.get('/api/health', (c) => c.json({ ok: true }));

// Herkese açık QR sayfası: yalnızca makine adı döner (org bilgisi sızdırılmaz)
app.get('/api/q/:token', async (c) => {
  const m = await c.env.DB.prepare('SELECT name FROM machines WHERE qr_token = ?')
    .bind(c.req.param('token')).first<{ name: string }>();
  if (!m) return c.json({ error: 'not_found' }, 404);
  return c.json({ machine: m.name });
});

const reportSchema = z.object({
  description: z.string().trim().min(3).max(1000),
  reporterName: z.string().trim().max(80).optional(),
});

app.post('/api/q/:token/tickets', zValidator('json', reportSchema), async (c) => {
  const m = await c.env.DB.prepare('SELECT id, org_id FROM machines WHERE qr_token = ?')
    .bind(c.req.param('token')).first<{ id: string; org_id: string }>();
  if (!m) return c.json({ error: 'not_found' }, 404);
  const { description, reporterName } = c.req.valid('json');
  const id = crypto.randomUUID();
  const now = Date.now();
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO tickets (id, org_id, machine_id, description, reporter_name, created_at) VALUES (?,?,?,?,?,?)',
    ).bind(id, m.org_id, m.id, description, reporterName ?? null, now),
    c.env.DB.prepare(
      'INSERT INTO ticket_events (id, org_id, ticket_id, type, created_at) VALUES (?,?,?,?,?)',
    ).bind(crypto.randomUUID(), m.org_id, id, 'created', now),
  ]);
  return c.json({ id }, 201);
});

// ---- Oturum gerektiren, kuruma (org) bağlı uçlar. Her sorguda org_id süzülür. ----
const api = new Hono<AppEnv>();
api.use('*', requireSession);

api.get('/me', async (c) => {
  const { userId, orgId } = c.get('session');
  const row = await c.env.DB.prepare(
    'SELECT u.email, o.name AS org FROM users u JOIN organizations o ON o.id = u.org_id WHERE u.id = ? AND o.id = ?',
  ).bind(userId, orgId).first();
  return c.json(row);
});

api.get('/machines', async (c) => {
  const { orgId } = c.get('session');
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, qr_token AS qrToken FROM machines WHERE org_id = ? ORDER BY name',
  ).bind(orgId).all();
  return c.json(results);
});

api.post('/machines', zValidator('json', z.object({ name: z.string().trim().min(2).max(80) })), async (c) => {
  const { orgId } = c.get('session');
  const id = crypto.randomUUID();
  const qrToken = randomToken(12);
  await c.env.DB.prepare('INSERT INTO machines (id, org_id, name, qr_token) VALUES (?,?,?,?)')
    .bind(id, orgId, c.req.valid('json').name, qrToken).run();
  return c.json({ id, qrToken }, 201);
});

api.get('/tickets', async (c) => {
  const { orgId } = c.get('session');
  const status = c.req.query('status');
  const where = status && ['open', 'in_progress', 'resolved'].includes(status) ? 'AND t.status = ?' : '';
  const stmt = c.env.DB.prepare(
    `SELECT t.id, t.description, t.status, t.reporter_name AS reporterName, t.created_at AS createdAt,
            m.name AS machine
       FROM tickets t JOIN machines m ON m.id = t.machine_id AND m.org_id = t.org_id
      WHERE t.org_id = ? ${where}
      ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, t.created_at DESC
      LIMIT 200`,
  );
  const { results } = await (where ? stmt.bind(orgId, status) : stmt.bind(orgId)).all();
  return c.json(results);
});

const transitions: Record<string, string[]> = { open: ['in_progress', 'resolved'], in_progress: ['resolved'], resolved: ['open'] };

api.patch('/tickets/:id', zValidator('json', z.object({ status: z.enum(['open', 'in_progress', 'resolved']) })), async (c) => {
  const { orgId } = c.get('session');
  const next = c.req.valid('json').status;
  const t = await c.env.DB.prepare('SELECT status FROM tickets WHERE id = ? AND org_id = ?')
    .bind(c.req.param('id'), orgId).first<{ status: string }>();
  if (!t) return c.json({ error: 'not_found' }, 404);
  if (!transitions[t.status]?.includes(next)) return c.json({ error: 'invalid_transition' }, 409);
  const now = Date.now();
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE tickets SET status = ? WHERE id = ? AND org_id = ?').bind(next, c.req.param('id'), orgId),
    c.env.DB.prepare('INSERT INTO ticket_events (id, org_id, ticket_id, type, created_at) VALUES (?,?,?,?,?)')
      .bind(crypto.randomUUID(), orgId, c.req.param('id'), next, now),
  ]);
  return c.json({ ok: true });
});

app.route('/api', api);

export default app;
