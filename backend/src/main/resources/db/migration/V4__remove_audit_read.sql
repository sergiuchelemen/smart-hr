-- Jurnalul de audit nu se implementează: privilegiul AUDIT_READ nu mai are utilizare.
DELETE FROM role_permission WHERE permission_code = 'AUDIT_READ';
DELETE FROM permission WHERE code = 'AUDIT_READ';
