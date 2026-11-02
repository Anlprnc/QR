CREATE TABLE organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE areas (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, name TEXT NOT NULL);
CREATE TABLE machines (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, area_id TEXT, name TEXT NOT NULL, qr_token TEXT NOT NULL UNIQUE
);
CREATE TABLE tickets (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, machine_id TEXT NOT NULL, description TEXT NOT NULL,
  reporter_name TEXT, status TEXT NOT NULL DEFAULT 'open', created_at INTEGER NOT NULL
);
CREATE TABLE ticket_events (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, ticket_id TEXT NOT NULL, type TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX idx_machines_org ON machines(org_id);
CREATE INDEX idx_tickets_org_status ON tickets(org_id, status, created_at);
