-- Privilegii pentru cererile de concediu + backfill pe rolurile de sistem existente.
INSERT INTO permission (code, description) VALUES
    ('LEAVE_REQUEST',        'Cereri de concediu proprii'),
    ('LEAVE_APPROVE',        'Aprobare cereri de concediu ale echipei directe'),
    ('LEAVE_APPROVE_ALL',    'Decizie asupra oricărei cereri de concediu din companie'),
    ('LEAVE_READ_ALL',       'Vizualizare toate cererile de concediu'),
    ('LEAVE_BALANCE_MANAGE', 'Administrare solduri de concediu');

INSERT INTO role_permission (role_id, permission_code)
SELECT r.id, p.code FROM role r
CROSS JOIN (VALUES ('LEAVE_REQUEST'), ('LEAVE_APPROVE'), ('LEAVE_APPROVE_ALL'), ('LEAVE_READ_ALL'),
                   ('LEAVE_BALANCE_MANAGE')) AS p (code)
WHERE r.is_system AND r.name = 'HR_ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO role_permission (role_id, permission_code)
SELECT r.id, p.code FROM role r
CROSS JOIN (VALUES ('LEAVE_REQUEST'), ('LEAVE_APPROVE')) AS p (code)
WHERE r.is_system AND r.name = 'MANAGER'
ON CONFLICT DO NOTHING;

INSERT INTO role_permission (role_id, permission_code)
SELECT r.id, 'LEAVE_REQUEST' FROM role r
WHERE r.is_system AND r.name = 'EMPLOYEE'
ON CONFLICT DO NOTHING;
