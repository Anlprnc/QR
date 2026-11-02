import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

type Env = { DB: D1Database };
const app = new Hono<{ Bindings: Env }>();

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

export default app;
