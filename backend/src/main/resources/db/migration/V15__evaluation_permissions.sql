-- Privilegii pentru evaluarea performanței + backfill pe rolurile de sistem existente.
INSERT INTO permission (code, description) VALUES
    ('EVALUATION_SELF',   'Autoevaluare și vizualizarea propriilor evaluări'),
    ('EVALUATION_REVIEW', 'Evaluarea angajaților din echipa directă'),
    ('EVALUATION_MANAGE', 'Gestionarea ciclurilor de evaluare, progres, citire integrală și reasignarea evaluatorului');

INSERT INTO role_permission (role_id, permission_code)
SELECT r.id, p.code FROM role r
CROSS JOIN (VALUES ('EVALUATION_SELF'), ('EVALUATION_REVIEW'), ('EVALUATION_MANAGE')) AS p (code)
WHERE r.is_system AND r.name = 'HR_ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO role_permission (role_id, permission_code)
SELECT r.id, p.code FROM role r
CROSS JOIN (VALUES ('EVALUATION_SELF'), ('EVALUATION_REVIEW')) AS p (code)
WHERE r.is_system AND r.name = 'MANAGER'
ON CONFLICT DO NOTHING;

INSERT INTO role_permission (role_id, permission_code)
SELECT r.id, 'EVALUATION_SELF' FROM role r
WHERE r.is_system AND r.name = 'EMPLOYEE'
ON CONFLICT DO NOTHING;
