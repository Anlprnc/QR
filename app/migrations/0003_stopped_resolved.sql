ALTER TABLE tickets ADD COLUMN machine_stopped INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tickets ADD COLUMN resolved_at INTEGER;
CREATE INDEX idx_tickets_org_machine ON tickets(org_id, machine_id, created_at);
