// Migrasyonlarla (migrations/*.sql) birebir tutulur. Uygulama şu an ham D1 sorguları kullanır;
// bu dosya drizzle-kit ve ileride tipli sorgular içindir.
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const areas = sqliteTable('areas', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  name: text('name').notNull(),
});

export const machines = sqliteTable('machines', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  areaId: text('area_id'),
  name: text('name').notNull(),
  qrToken: text('qr_token').notNull().unique(),
  location: text('location'),
  archivedAt: integer('archived_at'),
}, (t) => ({ org: index('idx_machines_org').on(t.orgId) }));

export const tickets = sqliteTable('tickets', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  machineId: text('machine_id').notNull(),
  description: text('description').notNull(),
  reporterName: text('reporter_name'),
  status: text('status').notNull().default('open'),
  createdAt: integer('created_at').notNull(),
  machineStopped: integer('machine_stopped').notNull().default(0),
  resolvedAt: integer('resolved_at'),
  assignee: text('assignee'),
  resolution: text('resolution'),
}, (t) => ({
  orgStatus: index('idx_tickets_org_status').on(t.orgId, t.status, t.createdAt),
  orgMachine: index('idx_tickets_org_machine').on(t.orgId, t.machineId, t.createdAt),
}));

export const ticketEvents = sqliteTable('ticket_events', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  ticketId: text('ticket_id').notNull(),
  type: text('type').notNull(),
  note: text('note'),
  createdAt: integer('created_at').notNull(),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  orgId: text('org_id').notNull(),
  role: text('role').notNull().default('member'),
  createdAt: integer('created_at').notNull(),
});

export const loginCodes = sqliteTable('login_codes', {
  email: text('email').primaryKey(),
  codeHash: text('code_hash').notNull(),
  expiresAt: integer('expires_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  windowStart: integer('window_start').notNull(),
  requests: integer('requests').notNull().default(1),
});

export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id').notNull(),
  orgId: text('org_id').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, (t) => ({ user: index('idx_sessions_user').on(t.userId) }));

export const maintenanceTasks = sqliteTable('maintenance_tasks', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  machineId: text('machine_id').notNull(),
  title: text('title').notNull(),
  intervalDays: integer('interval_days').notNull(),
  lastDoneAt: integer('last_done_at'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ org: index('idx_maint_org').on(t.orgId) }));

export const maintenanceLogs = sqliteTable('maintenance_logs', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  taskId: text('task_id').notNull(),
  doneAt: integer('done_at').notNull(),
  doneBy: text('done_by'),
});

export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(),
  windowStart: integer('window_start').notNull(),
  hits: integer('hits').notNull(),
});
