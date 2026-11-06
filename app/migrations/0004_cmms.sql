ALTER TABLE machines ADD COLUMN location TEXT;
ALTER TABLE machines ADD COLUMN archived_at INTEGER;
ALTER TABLE tickets ADD COLUMN assignee TEXT;
ALTER TABLE tickets ADD COLUMN resolution TEXT;
ALTER TABLE ticket_events ADD COLUMN note TEXT;
CREATE TABLE maintenance_tasks (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, machine_id TEXT NOT NULL, title TEXT NOT NULL,
  interval_days INTEGER NOT NULL, last_done_at INTEGER, created_at INTEGER NOT NULL
);
CREATE INDEX idx_maint_org ON maintenance_tasks(org_id);
CREATE TABLE maintenance_logs (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, task_id TEXT NOT NULL, done_at INTEGER NOT NULL, done_by TEXT
);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, hits INTEGER NOT NULL);
