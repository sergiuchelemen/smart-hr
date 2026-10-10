-- Privilegii pentru pontaj + backfill pe rolurile de sistem existente.
INSERT INTO permission (code, description) VALUES
    ('TIMESHEET_SUBMIT',      'Pontaj propriu: completare și trimitere spre aprobare'),
    ('TIMESHEET_APPROVE',     'Aprobare pontaj pentru echipa directă'),
    ('TIMESHEET_APPROVE_ALL', 'Decizie asupra pontajului oricărui angajat din companie'),
    ('TIMESHEET_READ_ALL',    'Vizualizare pontaj pentru toți angajații');

INSERT INTO role_permission (role_id, permission_code)
SELECT r.id, p.code FROM role r
CROSS JOIN (VALUES ('TIMESHEET_SUBMIT'), ('TIMESHEET_APPROVE'), ('TIMESHEET_APPROVE_ALL'),
                   ('TIMESHEET_READ_ALL')) AS p (code)
WHERE r.is_system AND r.name = 'HR_ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO role_permission (role_id, permission_code)
SELECT r.id, p.code FROM role r
CROSS JOIN (VALUES ('TIMESHEET_SUBMIT'), ('TIMESHEET_APPROVE')) AS p (code)
WHERE r.is_system AND r.name = 'MANAGER'
ON CONFLICT DO NOTHING;

INSERT INTO role_permission (role_id, permission_code)
SELECT r.id, 'TIMESHEET_SUBMIT' FROM role r
WHERE r.is_system AND r.name = 'EMPLOYEE'
ON CONFLICT DO NOTHING;
