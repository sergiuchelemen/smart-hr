-- Legătura angajat-cont și ierarhia de manageri, cu FK compuse care păstrează izolarea pe companie.
ALTER TABLE app_user ADD CONSTRAINT uq_app_user_company_id UNIQUE (company_id, id);
ALTER TABLE employee ADD CONSTRAINT uq_employee_company_id UNIQUE (company_id, id);

ALTER TABLE employee ADD COLUMN user_id UUID NULL;
ALTER TABLE employee ADD CONSTRAINT fk_employee_user
    FOREIGN KEY (company_id, user_id) REFERENCES app_user (company_id, id);
ALTER TABLE employee ADD CONSTRAINT uq_employee_user UNIQUE (user_id);

ALTER TABLE employee ADD COLUMN manager_id UUID NULL;
ALTER TABLE employee ADD CONSTRAINT fk_employee_manager
    FOREIGN KEY (company_id, manager_id) REFERENCES employee (company_id, id);
ALTER TABLE employee ADD CONSTRAINT ck_employee_manager_not_self CHECK (manager_id <> id);
CREATE INDEX ix_employee_company_manager ON employee (company_id, manager_id);
