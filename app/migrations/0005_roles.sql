ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member';
-- Her kurumun ilk kullanıcısı yöneticidir
UPDATE users SET role = 'owner'
 WHERE id IN (SELECT u.id FROM users u WHERE u.created_at = (SELECT MIN(created_at) FROM users WHERE org_id = u.org_id));
