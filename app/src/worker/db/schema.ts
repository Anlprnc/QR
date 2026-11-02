import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

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
});

export const tickets = sqliteTable('tickets', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  machineId: text('machine_id').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('open'),
  createdAt: integer('created_at').notNull(),
});

export const ticketEvents = sqliteTable('ticket_events', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  ticketId: text('ticket_id').notNull(),
  type: text('type').notNull(),
  createdAt: integer('created_at').notNull(),
});
