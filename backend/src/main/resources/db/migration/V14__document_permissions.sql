-- Privilegiu pentru biblioteca de documente + backfill pe rolul de sistem HR_ADMIN existent.
INSERT INTO permission (code, description) VALUES
    ('DOCUMENT_MANAGE', 'Încarcă și gestionează documentele companiei');

INSERT INTO role_permission (role_id, permission_code)
SELECT r.id, 'DOCUMENT_MANAGE' FROM role r
WHERE r.is_system AND r.name = 'HR_ADMIN'
ON CONFLICT DO NOTHING;
