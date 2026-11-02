import { Hono } from 'hono';

type Env = { DB: D1Database };
const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) => c.json({ ok: true }));

export default app;
